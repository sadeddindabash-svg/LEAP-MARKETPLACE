/**
 * Finds and removes TEST orders (and refused test orders) from the database.
 *
 *   node scripts\test-orders.js find               lists the orders that look like tests and writes test-orders.csv (changes nothing)
 *   node scripts\test-orders.js delete             DRY RUN: what would be deleted for the rows marked yes in test-orders.csv
 *   node scripts\test-orders.js delete --write     deletes them, all in ONE transaction (if anything fails, nothing is deleted)
 *   node scripts\test-orders.js delete --all       every order in the database (dry run; add --write to do it)
 *
 * An order looks like a test when: the buyer's or guest's email has example.com / test / demo / fake in it, the buyer's name has
 * "test", a product in it is a test product (OEM BI-..., test categories, "test" in its name), its supplier has "test" in its name,
 * or a supplier refused it. Open test-orders.csv in Excel, set "delete" to no for any order to keep, save (keep it CSV), then delete.
 * Deleting an order also deletes what belongs to it: its supplier parts, lines, hub shipments, returns, fault cases, payments,
 * replacement orders and the like (found from the database's own links). Products, suppliers and buyers are NOT deleted.
 */
const fs = require('fs');
const path = require('path');
const api = path.resolve(__dirname, '..', 'services', 'api');
process.chdir(api);
const db = require(path.join(api, 'db', 'pool'));
const CSV = path.resolve(__dirname, '..', 'test-orders.csv');
const mode = process.argv[2];
const WRITE = process.argv.includes('--write');
const ALL = process.argv.includes('--all');

const csvCell = (v) => { const t = v === null || v === undefined ? '' : String(v); return /[",\n\r;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === ',' || ch === ';') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
async function columns(table) {
  const { rows } = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = current_schema()", [table]);
  return new Set(rows.map((r) => r.column_name));
}
const looksTest = (s) => /example\.com|\btest|test\b|demo|fake|dummy/i.test(String(s || ''));

async function find() {
  const oc = await columns('orders');
  const sc = await columns('supplier_sub_orders');
  const placedCol = ['placed_at', 'created_at'].find((c) => oc.has(c));
  const { rows: orders } = await db.query(`SELECT o.*, u.email AS buyer_email, u.name AS buyer_name FROM orders o LEFT JOIN users u ON u.id = o.buyer_id ORDER BY ${placedCol ? `o.${placedCol}` : 'o.id'}`);
  const refusedCol = ['refused_at', 'refuse_reason', 'refusal_reason'].find((c) => sc.has(c));
  const { rows: lines } = await db.query(
    `SELECT so.order_id, so.status AS part_status, ${refusedCol ? `so.${refusedCol} IS NOT NULL` : 'false'} AS refused, s.name AS supplier_name,
            p.id AS product_id, p.name AS product_name, p.oem_number, p.category, p.part
     FROM supplier_sub_orders so
     LEFT JOIN suppliers s ON s.id = so.supplier_id
     LEFT JOIN order_line_items oli ON oli.sub_order_id = so.id
     LEFT JOIN products p ON p.id = oli.product_id`
  );
  const byOrder = new Map();
  for (const l of lines) { if (!byOrder.has(l.order_id)) byOrder.set(l.order_id, []); byOrder.get(l.order_id).push(l); }
  const out = [];
  for (const o of orders) {
    const ls = byOrder.get(o.id) || [];
    const reasons = new Set();
    const email = o.buyer_email || o.guest_email || '';
    if (looksTest(email)) reasons.add(`email ${email}`);
    if (looksTest(o.buyer_name)) reasons.add(`buyer "${o.buyer_name}"`);
    for (const l of ls) {
      if (/^BI-/i.test(l.oem_number || '') || /test_cat|^Part 179/i.test(`${l.category} ${l.part}`) || looksTest(l.product_name)) reasons.add(`test product ${l.product_name || l.product_id}`);
      if (looksTest(l.supplier_name)) reasons.add(`test supplier ${l.supplier_name}`);
    }
    const refused = ls.some((l) => l.refused);
    if (refused) reasons.add('refused by a supplier');
    if (ls.length === 0) reasons.add('no items');
    out.push({ id: o.id, placed: placedCol ? o[placedCol] : '', buyer: email || o.buyer_id || '', total: o.total, currency: o.currency_code, status: o.status,
      items: ls.filter((l) => l.product_id).length, refused: refused ? 'yes' : '', reasons: [...reasons].join('; '), delete: reasons.size > 0 ? 'yes' : 'no' });
  }
  const header = ['delete', 'id', 'placed', 'buyer', 'total', 'currency', 'status', 'items', 'refused', 'reasons'];
  fs.writeFileSync(CSV, '﻿' + [header.join(','), ...out.map((r) => header.map((h) => csvCell(h === 'placed' && r.placed ? new Date(r.placed).toISOString().slice(0, 16).replace('T', ' ') : r[h])).join(','))].join('\r\n') + '\r\n', 'utf8');
  const flagged = out.filter((r) => r.delete === 'yes');
  console.log(`orders in the database: ${out.length}`);
  console.log(`look like tests (marked delete = yes): ${flagged.length}   (of them refused by a supplier: ${flagged.filter((r) => r.refused).length})`);
  console.log(`look real (marked delete = no): ${out.length - flagged.length}`);
  for (const r of out.filter((x) => x.delete === 'no').slice(0, 15)) console.log(`  kept: ${r.id}  ${r.buyer}  ${r.total} ${r.currency || ''}  ${r.status}`);
  console.log(`\nThe full list: ${CSV}\nCheck it (set delete to no for any order to keep), then: node scripts\\test-orders.js delete`);
}

const q = (sql, p) => db.query(sql, p);
async function primaryKey(client, table) {
  const { rows } = await client.query(`SELECT a.attname AS col FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) WHERE i.indrelid = $1::regclass AND i.indisprimary`, [table]);
  return rows.length === 1 ? rows[0].col : null;
}
async function referencing(client, table) {
  const { rows } = await client.query(`SELECT c.conrelid::regclass::text AS tbl, a.attname AS col, af.attname AS refcol, array_length(c.conkey, 1) AS n, c.confdeltype AS ondelete
    FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = c.confkey[1]
    WHERE c.contype = 'f' AND c.confrelid = $1::regclass`, [table]);
  return rows;
}

async function remove() {
  let ids;
  if (ALL) ids = (await q('SELECT id::text AS id FROM orders')).rows.map((r) => r.id);
  else {
    if (!fs.existsSync(CSV)) { console.log('No test-orders.csv yet: run  node scripts\\test-orders.js find  first.'); return; }
    const rows = parseCsv(fs.readFileSync(CSV, 'utf8').replace(/^﻿/, ''));
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const di = head.indexOf('delete'); const ii = head.indexOf('id');
    if (di < 0 || ii < 0) { console.log('test-orders.csv must keep its "delete" and "id" columns.'); return; }
    ids = rows.slice(1).filter((r) => (r[di] || '').trim().toLowerCase() === 'yes' && (r[ii] || '').trim()).map((r) => r[ii].trim());
  }
  if (ids.length === 0) { console.log('No order is marked delete = yes. Nothing to do.'); return; }
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    const plan = new Map(); const order = []; const edges = new Set(); const problems = [];
    const add = (table, key, list) => {
      if (!plan.has(table)) { plan.set(table, { key, ids: new Set() }); order.push(table); }
      const e = plan.get(table); const fresh = list.filter((x) => !e.ids.has(String(x)));
      fresh.forEach((x) => e.ids.add(String(x))); return fresh;
    };
    async function walk(table, key, list, depth) {
      if (depth > 12 || list.length === 0) return;
      for (const fk of await referencing(client, table)) {
        if (fk.n !== 1) { problems.push(`${fk.tbl} points at ${table} with a key of several columns: not handled`); continue; }
        if (fk.ondelete === 'n') continue;      // ON DELETE SET NULL: the row stays, only its link is cleared by the database
        const refIds = fk.refcol === key ? list : (await client.query(`SELECT "${fk.refcol}"::text AS v FROM ${table} WHERE "${key}"::text = ANY($1)`, [list])).rows.map((r) => r.v);
        if (refIds.length === 0) continue;
        const pk = await primaryKey(client, fk.tbl);
        const { rows } = await client.query(`SELECT ${pk ? `"${pk}"::text` : 'ctid::text'} AS id FROM ${fk.tbl} WHERE "${fk.col}"::text = ANY($1)`, [refIds]);
        if (rows.length === 0) continue;
        if (fk.tbl !== table) edges.add(`${fk.tbl}>${table}`);
        const fresh = add(fk.tbl, pk || 'ctid', rows.map((r) => r.id));
        if (pk) await walk(fk.tbl, pk, fresh, depth + 1);
      }
    }
    const fresh = add('orders', 'id', ids);
    await walk('orders', 'id', fresh, 0);
    console.log(WRITE ? `DELETING ${ids.length} orders and what belongs to them:` : `DRY RUN (nothing is changed). ${ids.length} orders would be deleted, with:`);
    for (const t of order) console.log(`  ${t}: ${plan.get(t).ids.size}`);
    for (const forbidden of ['products', 'suppliers', 'users']) if (plan.has(forbidden)) problems.push(`it would reach ${forbidden}: stopped to be safe`);
    if (problems.length) { console.log('\nSTOPPED, nothing deleted:'); problems.forEach((p) => console.log('  ' + p)); await client.query('ROLLBACK'); return; }
    if (!WRITE) { await client.query('ROLLBACK'); console.log(`\nDry run only. To delete them: node scripts\\test-orders.js delete${ALL ? ' --all' : ''} --write`); return; }
    const waiting = new Set(order); const sorted = [];
    while (waiting.size) {
      const ready = [...waiting].filter((t) => ![...edges].some((e) => { const [c, par] = e.split('>'); return par === t && waiting.has(c) && c !== t; }));
      if (ready.length === 0) throw new Error('these tables point at each other, so there is no safe order: ' + [...waiting].join(', '));
      ready.forEach((t) => { waiting.delete(t); sorted.push(t); });
    }
    for (const t of sorted) {
      const { key, ids: set } = plan.get(t);
      const res = await client.query(`DELETE FROM ${t} WHERE ${key === 'ctid' ? 'ctid::text' : `"${key}"::text`} = ANY($1)`, [[...set]]);
      console.log(`  deleted ${res.rowCount} from ${t}`);
    }
    await client.query('COMMIT');
    console.log('\nDone. Reload the portals with Ctrl+F5.');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.log('\nERROR, nothing was deleted:', e.message);
  } finally { client.release(); }
}

(async () => {
  try {
    if (mode === 'find') await find();
    else if (mode === 'delete') await remove();
    else console.log('Use:  node scripts\\test-orders.js find   |   delete   |   delete --write   |   delete --all');
  } catch (e) { console.log('ERROR:', e.message); }
  try { await db.getPool().end(); } catch (_) { /* closing */ }
  process.exit(0);
})();
