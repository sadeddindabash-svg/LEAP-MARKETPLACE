#!/usr/bin/env node
/**
 * Removes the leftovers of the automated tests from the database the app uses: test categories and parts, test vehicle brands, test hubs, and test
 * products (these are HIDDEN from buyers, not deleted). Everything a person created by hand is kept.
 *
 *   node scripts/remove-test-data.js            DRY RUN: shows exactly what it would do and changes NOTHING
 *   node scripts/remove-test-data.js --apply    does it (after saving a backup file of what it removes)
 *
 * Run it from the services/api folder. It uses the same database settings as the backend (services/api/.env). Anything the database says is IN USE
 * (a brand used by a product, a quote request or a buyer's saved vehicle; a hub with shipments or staff; a part a product uses) is kept and reported.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../db/pool');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rules = require('./testDataRules');
const engine = require('./deleteWithDependents');

const apply = process.argv.includes('--apply');
const keepOrders = process.argv.includes('--keep-orders');
const MIXED_PAYOUT_ORDERS_SQL = `
  WITH links AS (
    SELECT ps.payout_id, so.order_id FROM payout_sub_orders ps JOIN supplier_sub_orders so ON so.id = ps.sub_order_id
    UNION ALL
    SELECT a.payout_id, so2.order_id FROM payout_adjustments a LEFT JOIN fault_cases fc ON fc.id = a.fault_case_id LEFT JOIN supplier_sub_orders so2 ON so2.id = fc.sub_order_id WHERE a.payout_id IS NOT NULL
  ), mixed AS (
    SELECT payout_id FROM links GROUP BY payout_id
    HAVING bool_or(order_id = ANY($1::text[])) AND bool_or(order_id IS NULL OR NOT (order_id = ANY($1::text[])))
  )
  SELECT DISTINCT l.order_id FROM links l JOIN mixed m ON m.payout_id = l.payout_id WHERE l.order_id = ANY($1::text[])`;

// Payouts whose every item and adjustment is already marked for deletion: nothing real is left in them, so they go too.
const FULLY_TEST_PAYOUTS_SQL = `
  SELECT p.ctid::text AS id FROM payouts p
  WHERE (EXISTS (SELECT 1 FROM payout_sub_orders ps JOIN _marked m ON m.tbl = 'payout_sub_orders' AND m.id = ps.ctid::text WHERE ps.payout_id = p.id)
      OR EXISTS (SELECT 1 FROM payout_adjustments a JOIN _marked m ON m.tbl = 'payout_adjustments' AND m.id = a.ctid::text WHERE a.payout_id = p.id))
    AND NOT EXISTS (SELECT 1 FROM payout_sub_orders ps WHERE ps.payout_id = p.id AND NOT EXISTS (SELECT 1 FROM _marked m WHERE m.tbl = 'payout_sub_orders' AND m.id = ps.ctid::text))
    AND NOT EXISTS (SELECT 1 FROM payout_adjustments a WHERE a.payout_id = p.id AND NOT EXISTS (SELECT 1 FROM _marked m WHERE m.tbl = 'payout_adjustments' AND m.id = a.ctid::text))`;

const sample = (items, label) => items.slice(0, 4).map(label).join('; ') + (items.length > 4 ? `; ... (+${items.length - 4} more)` : '');

async function tryDelete(client, sql, params) {
  await client.query('SAVEPOINT attempt');
  try {
    await client.query(sql, params);
    await client.query('RELEASE SAVEPOINT attempt');
    return true;
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT attempt');
    if (err.code === '23503') return false; // foreign key: it is in use
    throw err;
  }
}

async function run() {
  const client = await db.getPool().connect();
  const report = { removed: {}, kept: {}, hidden: 0 };
  const backup = { createdAt: new Date().toISOString(), categories: [], parts: [], vehicleBrands: [], hubs: [], hiddenProducts: [], closedFlags: [], removedAdmins: [], deletedOrders: [], heldBackOrders: [], deletedRowCounts: {} };
  try {
    await client.query('BEGIN');

    // ---- test ORDERS, together with everything that hangs off them ----
    // An order is a test order only if its buyer or guest address is @example.com / .org / .net. Its shipments, events, fault cases, return cases, tickets,
    // payments, addresses and so on are found through the database's own foreign keys and removed with it, so nothing is left pointing at a deleted order.
    // A payout that pays ONLY test orders goes too; a payout that ALSO pays a real order stays, and so do the test orders in it (deleting them would make
    // that payout's total wrong). Orders of real-looking addresses are never touched.
    report.orders = { deleted: 0, rows: 0, tables: 0, heldBack: 0, kept: 0, breakdown: {} };
    if (!keepOrders) {
      const foreignKeys = await engine.loadForeignKeys(client);
      const { rows: allOrders } = await client.query('SELECT o.id, COALESCE(u.email, o.guest_email) AS owner FROM orders o LEFT JOIN users u ON u.id = o.buyer_id');
      const chosen = new Set(allOrders.filter((o) => rules.isTestAddress(o.owner)).map((o) => o.id));
      report.orders.kept = allOrders.length - chosen.size;
      const heldBack = new Set();
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const { rows: risky } = await client.query(MIXED_PAYOUT_ORDERS_SQL, [[...chosen]]);
        const more = risky.map((r) => r.order_id).filter((id) => chosen.has(id));
        if (more.length === 0) break;
        more.forEach((id) => { chosen.delete(id); heldBack.add(id); });
      }
      await engine.startMarking(client);
      if (chosen.size > 0) {
        await engine.markRows(client, 'orders', 't.id = ANY($1::text[])', [[...chosen]]);
        await engine.markDependents(client, foreignKeys);
        const { rows: emptyPayouts } = await client.query(FULLY_TEST_PAYOUTS_SQL);
        if (emptyPayouts.length > 0) {
          await engine.markRows(client, 'payouts', 't.ctid::text = ANY($1::text[])', [emptyPayouts.map((r) => r.id)]);
          await engine.markDependents(client, foreignKeys);
        }
        const deletedRows = await engine.deleteMarked(client);
        report.orders.deleted = deletedRows.orders || 0;
        report.orders.rows = Object.values(deletedRows).reduce((sum, n) => sum + n, 0);
        report.orders.tables = Object.keys(deletedRows).length;
        report.orders.breakdown = deletedRows;
        backup.deletedRowCounts = deletedRows;
        backup.deletedOrders = [...chosen];
      }
      report.orders.heldBack = heldBack.size;
      backup.heldBackOrders = [...heldBack];
    }

    // ---- test ADMIN accounts (a security matter: the tests give them KNOWN passwords) ----
    // Deleted when nothing refers to them any more; if something still does (they created a fault case, a payout...), the account is LOCKED instead:
    // its password is replaced by a random one nobody knows, so the known test password stops working. The owner and anything that does not clearly
    // look like a test account are never touched.
    const { rows: admins } = await client.query(`SELECT id, email, is_owner FROM users WHERE role = 'admin' ORDER BY email`);
    const testAdmins = admins.filter(rules.isTestAdmin);
    const keptAdmins = admins.filter((a) => !rules.isTestAdmin(a));
    let deletedAdmins = 0; let lockedAdmins = 0;
    for (const a of testAdmins) {
      if (await tryDelete(client, 'DELETE FROM users WHERE id = $1', [a.id])) { deletedAdmins += 1; backup.removedAdmins.push({ id: a.id, email: a.email, action: 'deleted' }); continue; }
      const unknownPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [unknownPassword, a.id]);
      lockedAdmins += 1; backup.removedAdmins.push({ id: a.id, email: a.email, action: 'locked' });
    }
    report.admins = { deleted: deletedAdmins, locked: lockedAdmins, kept: keptAdmins };

    // ---- open flags that belong to TEST accounts: CLOSED (they leave the admin's Flagged page and the hub's Flagged filter) ----
    // Only flags whose order belongs to an @example.com address are touched: a flag on a real-looking address is left exactly as it is.
    const { rows: openFlags } = await client.query(
      `SELECT hs.id AS shipment_id, so.id AS sub_order_id, COALESCE(u.email, o.guest_email) AS owner, fc.id AS fault_case_id, fc.status AS fault_status
       FROM hub_shipments hs
       JOIN supplier_sub_orders so ON so.id = hs.sub_order_id
       JOIN orders o ON o.id = so.order_id
       LEFT JOIN users u ON u.id = o.buyer_id
       LEFT JOIN fault_cases fc ON fc.shipment_id = hs.id
       WHERE hs.resolved_at IS NULL AND hs.status IN ('flagged', 'returned_to_supplier', 'discarded_at_hub')`);
    const testFlags = openFlags.filter((f) => rules.isTestAddress(f.owner));
    const realFlags = openFlags.filter((f) => !rules.isTestAddress(f.owner));
    const openFaultCases = testFlags.filter((f) => f.fault_case_id && f.fault_status !== 'completed');
    let closedReturnCases = 0;
    if (testFlags.length > 0) {
      const subOrderIds = testFlags.map((f) => f.sub_order_id);
      const { rows: returns } = await client.query(`SELECT id, sub_order_id, status FROM return_cases WHERE sub_order_id = ANY($1::int[]) AND status NOT IN ('completed', 'rejected')`, [subOrderIds]);
      backup.closedFlags = testFlags.map((f) => ({ shipmentId: f.shipment_id, faultCaseId: f.fault_case_id, faultStatus: f.fault_status, returnCases: returns.filter((x) => x.sub_order_id === f.sub_order_id).map((x) => ({ id: x.id, status: x.status })) }));
      if (openFaultCases.length > 0) {
        await client.query(`UPDATE fault_cases SET status = 'completed', completed_at = now(), updated_at = now(), closed_manually_note = 'Closed by the test-data cleanup' WHERE id = ANY($1::int[])`, [openFaultCases.map((f) => f.fault_case_id)]);
      }
      await client.query(`UPDATE hub_shipments SET resolution = 'fault_closed_manually', resolved_at = now(), updated_at = now() WHERE id = ANY($1::int[])`, [testFlags.map((f) => f.shipment_id)]);
      closedReturnCases = returns.length;
      if (returns.length > 0) await client.query(`UPDATE return_cases SET status = 'completed', updated_at = now() WHERE id = ANY($1::text[])`, [returns.map((x) => x.id)]);
    }
    report.flags = { closed: testFlags.length, faultCases: openFaultCases.length, returnCases: closedReturnCases, kept: realFlags };

    // ---- products: HIDE (status -> inactive) ----
    const { rows: products } = await client.query(`SELECT id, name, name_zh, name_ar, status FROM products WHERE status = 'active'`);
    const testProducts = products.filter(rules.isTestProduct);
    for (const p of testProducts) backup.hiddenProducts.push({ id: p.id, name: p.name, previousStatus: p.status });
    if (testProducts.length > 0) await client.query(`UPDATE products SET status = 'inactive' WHERE id = ANY($1::text[])`, [testProducts.map((p) => p.id)]);
    report.hidden = testProducts.length;
    report.hiddenSample = sample(testProducts, (p) => p.name);

    // ---- categories (and their parts) ----
    const { rows: categories } = await client.query('SELECT id, name_en FROM product_categories');
    const testCategories = categories.filter(rules.isTestCategory);
    let removedCategories = 0; const keptCategories = [];
    for (const c of testCategories) {
      const { rows: used } = await client.query('SELECT count(*)::int AS n FROM products WHERE category = $1', [c.id]);
      if (used[0].n > 0) { keptCategories.push(`${c.id} (used by ${used[0].n} products)`); continue; }
      const { rows: partRows } = await client.query('SELECT * FROM category_parts WHERE category_id = $1', [c.id]);
      backup.categories.push(c); backup.parts.push(...partRows);
      await client.query('DELETE FROM category_parts WHERE category_id = $1', [c.id]);
      if (await tryDelete(client, 'DELETE FROM product_categories WHERE id = $1', [c.id])) removedCategories += 1;
      else keptCategories.push(`${c.id} (in use)`);
    }
    report.removed.categories = removedCategories; report.kept.categories = keptCategories;

    // ---- parts inside the REAL categories ----
    const { rows: parts } = await client.query('SELECT * FROM category_parts');
    const testParts = parts.filter((p) => rules.isTestPart(p.name_en));
    const keptParts = [];
    for (const part of testParts) {
      // A part is kept only if a REAL product uses it: products that are themselves test leftovers (hidden above) do not count.
      const { rows: users } = await client.query('SELECT id, name, name_zh, name_ar FROM products WHERE category = $1 AND part = $2', [part.category_id, part.name_en]);
      const realUsers = users.filter((u) => !rules.isTestProduct(u));
      if (realUsers.length > 0) { keptParts.push(`${part.name_en} (used by ${realUsers.length} real product${realUsers.length === 1 ? '' : 's'})`); continue; }
      backup.parts.push(part);
      await client.query('DELETE FROM category_parts WHERE id = $1', [part.id]);
    }
    report.kept.parts = keptParts;
    report.removed.parts = backup.parts.length; // the parts of removed test categories too

    // ---- vehicle brands (their models, generations and engines go with them, unless something uses them) ----
    const { rows: brands } = await client.query('SELECT id, name FROM vehicle_brands');
    const testBrands = brands.filter((b) => rules.isTestVehicleBrand(b.name));
    let removedBrands = 0; const keptBrands = [];
    for (const b of testBrands) {
      const { rows: saved } = await client.query(
        `SELECT count(*)::int AS n FROM user_saved_generations usg JOIN vehicle_generations g ON g.id = usg.generation_id JOIN vehicle_models m ON m.id = g.model_id WHERE m.brand_id = $1`, [b.id]);
      if (saved[0].n > 0) { keptBrands.push(`${b.name} (a buyer saved it in their garage)`); continue; }
      // Vehicle links (fitment) of products that are themselves test leftovers do not count as "in use"; a REAL product's link does.
      const { rows: links } = await client.query(
        `SELECT p.id, p.name, p.name_zh, p.name_ar FROM product_fitment_entries e JOIN products p ON p.id = e.product_id
         JOIN vehicle_generations g ON g.id = e.generation_id JOIN vehicle_models m ON m.id = g.model_id WHERE m.brand_id = $1`, [b.id]);
      if (links.some((l) => !rules.isTestProduct(l))) { keptBrands.push(`${b.name} (a real product fits it)`); continue; }
      await client.query('SAVEPOINT brand');
      if (links.length > 0) {
        await client.query(`DELETE FROM product_fitment_entries WHERE generation_id IN (SELECT g.id FROM vehicle_generations g JOIN vehicle_models m ON m.id = g.model_id WHERE m.brand_id = $1)`, [b.id]);
      }
      if (await tryDelete(client, 'DELETE FROM vehicle_brands WHERE id = $1', [b.id])) { backup.vehicleBrands.push(b); removedBrands += 1; await client.query('RELEASE SAVEPOINT brand'); }
      else { await client.query('ROLLBACK TO SAVEPOINT brand'); keptBrands.push(`${b.name} (in use)`); }
    }
    report.removed.vehicleBrands = removedBrands; report.kept.vehicleBrands = keptBrands;

    // ---- hubs ----
    const { rows: hubs } = await client.query('SELECT id, name FROM hubs');
    const testHubs = hubs.filter(rules.isTestHub);
    let removedHubs = 0; let keptHubs = 0;
    for (const h of testHubs) {
      backup.hubs.push(h);
      if (await tryDelete(client, 'DELETE FROM hubs WHERE id = $1', [h.id])) removedHubs += 1;
      else { backup.hubs.pop(); keptHubs += 1; }
    }
    report.removed.hubs = removedHubs; report.kept.hubs = keptHubs ? [`${keptHubs} (have shipments or staff)`] : [];

    // ---- say what happened ----
    const verb = apply ? 'REMOVED' : 'WOULD REMOVE';
    console.log(apply ? '\nRemoving test data...\n' : '\nDRY RUN: nothing is changed. This is what would happen:\n');
    console.log(`  Test products ${apply ? 'HIDDEN from buyers' : 'that would be HIDDEN from buyers'} (not deleted; status set to inactive): ${report.hidden}`);
    if (report.hidden) console.log(`      e.g. ${report.hiddenSample}`);
    const top = Object.entries(report.orders.breakdown).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t, n]) => `${t} ${n}`).join(', ');
    console.log(`  Test ORDERS ${apply ? 'DELETED' : 'that would be DELETED'}, with everything that hangs off them (shipments, events, fault cases, returns, tickets, payments...): ${report.orders.deleted}   (${report.orders.rows} rows in ${report.orders.tables} tables${top ? '; most: ' + top : ''})`);
    console.log(`      orders of real-looking accounts, left exactly as they are: ${report.orders.kept}   test orders held back because a payout ALSO pays a real order: ${report.orders.heldBack}${keepOrders ? '   (--keep-orders: orders skipped)' : ''}`);
    console.log(`  Test ADMIN accounts ${apply ? 'REMOVED' : 'that would be REMOVED'}: ${report.admins.deleted}   ${apply ? 'LOCKED' : 'that would be LOCKED'} (still referenced, so the password is replaced by an unknown one): ${report.admins.locked}`);
    console.log(`      admin accounts kept: ${report.admins.kept.map((a) => a.email + (a.is_owner ? ' (owner)' : '')).join(', ') || 'none'}`);
    console.log(`  Open flagged shipments of TEST accounts ${apply ? 'CLOSED' : 'that would be CLOSED'} (they leave the Flagged lists; nothing is deleted): ${report.flags.closed}   (fault cases closed: ${report.flags.faultCases}, buyer return cases closed: ${report.flags.returnCases})`);
    console.log(`      flagged shipments of real-looking accounts, left as they are: ${report.flags.kept.length}${report.flags.kept.length ? ' (' + sample(report.flags.kept, (f) => f.owner) + ')' : ''}`);
    console.log(`  Test categories ${verb}: ${report.removed.categories}   kept: ${report.kept.categories.length ? report.kept.categories.join(', ') : 0}`);
    console.log(`  Test parts ${verb}: ${report.removed.parts}   kept: ${report.kept.parts.length ? sample(report.kept.parts, (x) => x) : 0}`);
    console.log(`  Test vehicle brands ${verb}: ${report.removed.vehicleBrands}   kept: ${report.kept.vehicleBrands.length ? sample(report.kept.vehicleBrands, (x) => x) : 0}`);
    console.log(`  Test hubs ${verb}: ${report.removed.hubs}   kept: ${report.kept.hubs.length ? report.kept.hubs.join(', ') : 0}`);

    if (!apply) {
      await client.query('ROLLBACK');
      console.log('\nNothing was changed. To do it for real:  node scripts/remove-test-data.js --apply');
      if (report.orders.deleted > 0) console.log('Deleting orders cannot be undone. Take a full backup first if you want one (use the port and user from your services\\api\\.env):\n  & "C:\\Program Files\\PostgreSQL\\14\\bin\\pg_dump.exe" -h localhost -p 5434 -U leap_dev -Fc -f D:\\leap-backup.dump leap_marketplace_dev');
      return;
    }
    const folder = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    const file = path.join(folder, `test-data-removed-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    await client.query('COMMIT');
    console.log(`\nDone. A backup of what was removed (and the ids of the hidden products) is saved in:\n  ${file}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

run()
  .catch((err) => { console.error('FAILED (nothing was changed):', err.message); process.exitCode = 1; })
  .finally(() => db.getPool().end());
