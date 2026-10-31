// Admin > All products > Delete. Mounted at /catalog/admin/products:  POST /delete-check  and  POST /delete  (admin only, and only for admins who may open Products).
//   * A product can be deleted only when NOTHING points at it: no order, no quote request, nothing else. Every table that points at products is looked up in the database itself (every foreign key), so a table added later is protected
//     too, and as a last safety net each deletion is tried on its own: one the database refuses stays, and the answer says what was REALLY deleted.
//   * What goes with a deleted product: its pictures (the files too, unless another product uses them), reviews, wishlist entries, recently-viewed entries, fitment records, and its lines in shoppers' carts.
//   * One product needs `confirm: true`; several at once need the typed sentence DELETE PRODUCTS. The check (delete-check) changes nothing.
//   * A product that cannot be deleted can be HIDDEN instead (Reject, which sets it inactive): the screen offers it. Hidden products are listed under "Hidden products" and can be sent back to review (POST /send-to-review).
const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');
const { blockers, tablesText } = require('../catalogImport/replace');
const { removeIfUnused } = require('../uploads/unusedPictures');

const router = express.Router();
const guard = [requireAuth, requireRole('admin'), requirePageAccess('products')];
const MAX_IDS = 200;
const PHRASE = 'DELETE PRODUCTS';
const STILL_USED = 'it is still used by something else (the database would not let it go)';
const WENT_WITH = { product_images: 'pictures', product_reviews: 'reviews', wishlist_items: 'wishlist entries', recently_viewed_products: 'recently viewed entries', product_fitment: 'fitment records', product_fitment_entries: 'fitment records', cart_items: "lines in shoppers' carts" };

// A buyer is still WAITING for a product while any order line with it is not finished (migration 119). Finished = the order or that
// supplier's part was cancelled (refused and cancelled too), or the part was delivered AND its return period is over (the return window
// set by the admin, platform setting return_window_days, default 7) with no return or fault case still open, or the hub closed the
// shipment's problem (flag resolved, unit returned to the supplier or discarded). Everything else (to pay, to ship, shipped, a delivery
// still inside its return period, an open return or dispute) keeps the product. Returns a Map: product id -> [{ orderId, stage }].
async function waitingOrders(q, ids) {
  if (ids.length === 0) return new Map();
  const { rows: setting } = await q.query("SELECT value FROM platform_settings WHERE key = 'return_window_days'");
  const windowDays = Number(setting[0]?.value ?? 7);
  const days = Number.isFinite(windowDays) && windowDays > 0 ? Math.round(windowDays) : 7;
  const openReturn = "EXISTS (SELECT 1 FROM return_cases rc WHERE rc.sub_order_id = so.id AND rc.status IN ('awaiting', 'in_progress', 'approved'))";
  const openFault = "EXISTS (SELECT 1 FROM fault_cases fc WHERE fc.sub_order_id = so.id AND fc.status <> 'completed')";
  const { rows } = await q.query(
    `SELECT oli.product_id, o.id AS order_id,
            CASE
              WHEN ${openReturn} THEN 'return open'
              WHEN ${openFault} OR (hs.status = 'flagged' AND hs.resolved_at IS NULL) THEN 'dispute'
              WHEN hs.status = 'shipped_to_buyer' THEN 'shipped'
              WHEN hs.status = 'delivered' THEN 'delivered, return period not over'
              WHEN o.status = 'to_pay' THEN 'to pay'
              ELSE 'to ship'
            END AS stage
     FROM order_line_items oli
     JOIN supplier_sub_orders so ON so.id = oli.sub_order_id      -- an order line belongs to a supplier's part of the order
     JOIN orders o ON o.id = so.order_id
     LEFT JOIN hub_shipments hs ON hs.sub_order_id = so.id
     WHERE oli.product_id = ANY($1)
       AND o.status <> 'cancelled' AND (so.id IS NULL OR so.status <> 'cancelled')
       AND (${openReturn} OR ${openFault} OR NOT COALESCE((
             (hs.status = 'delivered' AND hs.delivered_at IS NOT NULL AND hs.delivered_at + make_interval(days => $2::int) < now())
             OR hs.status IN ('returned_to_supplier', 'discarded_at_hub')
             OR (hs.status = 'flagged' AND hs.resolved_at IS NOT NULL)
             OR (so.id IS NULL AND o.status IN ('delivered', 'to_review'))
           ), false))
     ORDER BY oli.product_id, o.id`,
    [ids, days]
  );
  const byProduct = new Map();
  for (const r of rows) {
    const list = byProduct.get(r.product_id) || [];
    if (!list.some((x) => x.orderId === r.order_id)) list.push({ orderId: r.order_id, stage: r.stage });
    byProduct.set(r.product_id, list);
  }
  return byProduct;
}

/** A product that has history (orders, quote requests...) is not removed from the database: it is marked deleted and goes from everywhere
 *  else (the shop, both portals' lists, carts, wishlists, recently viewed; its pictures go too). Its old orders keep it, and opening it
 *  shows "This product is no longer available". Returns the ids it marked. */
async function retire(client, ids) {
  if (ids.length === 0) return [];
  const { rows } = await client.query("UPDATE products SET status = 'inactive', deleted_at = now() WHERE id = ANY($1) AND deleted_at IS NULL RETURNING id", [ids]);
  const gone = rows.map((r) => r.id);
  if (gone.length > 0) {
    await client.query('DELETE FROM cart_items WHERE product_id = ANY($1)', [gone]);
    for (const table of ['wishlist_items', 'recently_viewed_products']) {
      const { rows: t } = await client.query('SELECT to_regclass($1) AS t', [table]);
      if (t[0].t) await client.query(`DELETE FROM ${table} WHERE product_id = ANY($1)`, [gone]);
    }
    await client.query('DELETE FROM product_images WHERE product_id = ANY($1)', [gone]);
  }
  return gone;
}

const idsOf = (body) => (Array.isArray(body && body.ids) ? [...new Set(body.ids.filter((x) => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()))] : null);

/** What would happen to these products: which can go, which cannot (and why), and what goes with the ones that can. Reads only. */
async function planDelete(q, ids) {
  const { rows: found } = await q.query('SELECT id, name, status FROM products WHERE id = ANY($1) AND deleted_at IS NULL ORDER BY name, id', [ids]);      // a deleted product counts as not found
  const there = new Set(found.map((p) => p.id));
  const pointedAt = await blockers(q, 'products', found.map((p) => p.id), { ignore: ['cart_items'] });
  const ordered = new Set((await q.query('SELECT DISTINCT product_id FROM order_line_items WHERE product_id = ANY($1)', [found.map((p) => p.id)])).rows.map((r) => r.product_id));
  const waiting = await waitingOrders(q, found.map((p) => p.id));
  const held = []; const deletable = [];
  for (const p of found) {
    const w = waiting.get(p.id);
    if (w && w.length > 0) {      // a buyer is still waiting for it: it cannot go now
      const shown = w.slice(0, 4).map((x) => `${x.orderId} (${x.stage})`).join(', ');
      held.push({ ...p, orders: w, reason: `a buyer is still waiting for it: ${shown}${w.length > 4 ? ` and ${w.length - 4} more` : ''}. It can be deleted when ${w.length === 1 ? 'that order is' : 'those orders are'} finished (delivered and the return period over, or cancelled)` });
      continue;
    }
    const tables = new Set(pointedAt.get(p.id) || []); if (ordered.has(p.id)) tables.add('order_line_items');
    // no history at all: removed completely; with history (finished orders, quote requests...): marked deleted, the history keeps it
    deletable.push({ ...p, keepsHistory: tables.size > 0, usedIn: tables.size > 0 ? tablesText(tables) : null });
  }
  // what goes with the products that can be deleted: the rows of every table that cascades from products, plus the cart lines
  const counts = new Map(); const deletableIds = deletable.filter((p) => !p.keepsHistory).map((p) => p.id);      // what CASCADES applies to the ones removed completely
  if (deletableIds.length) {
    const { rows: cascading } = await q.query(`SELECT c.conrelid::regclass::text AS tbl, a.attname AS col FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1] WHERE c.contype = 'f' AND c.confrelid = 'products'::regclass AND (c.confdeltype = 'c' OR c.conrelid = 'cart_items'::regclass) AND array_length(c.conkey, 1) = 1`);
    for (const { tbl, col } of cascading) {
      const bare = tbl.replace(/^public\./, '').replace(/"/g, ''); if (!/^[A-Za-z0-9_]+$/.test(bare) || !/^[A-Za-z0-9_]+$/.test(col)) continue;
      const n = Number((await q.query(`SELECT count(*) AS n FROM "${bare}" WHERE "${col}" = ANY($1)`, [deletableIds])).rows[0].n);
      if (n > 0) { const label = WENT_WITH[bare] || bare; counts.set(label, (counts.get(label) || 0) + n); }
    }
  }
  // the ones marked deleted lose their pictures, cart lines, wishlist and recently viewed entries (their orders and reviews stay)
  const retiredIds = deletable.filter((p) => p.keepsHistory).map((p) => p.id);
  if (retiredIds.length) {
    for (const [table, label] of [['product_images', 'pictures'], ['cart_items', "lines in shoppers' carts"], ['wishlist_items', 'wishlist entries'], ['recently_viewed_products', 'recently viewed entries']]) {
      const { rows: t } = await q.query('SELECT to_regclass($1) AS t', [table]);
      if (!t[0].t) continue;
      const n = Number((await q.query(`SELECT count(*) AS n FROM ${table} WHERE product_id = ANY($1)`, [retiredIds])).rows[0].n);
      if (n > 0) counts.set(label, (counts.get(label) || 0) + n);
    }
  }
  return { deletable, held, missing: ids.filter((id) => !there.has(id)), alsoRemoved: [...counts].map(([what, count]) => ({ what, count })) };
}

/** A delete with a savepoint: -1 when the database refuses because something still points at the row (nothing is changed then), otherwise the ids it removed. */
async function attempt(client, ids) {
  await client.query('SAVEPOINT delete_step');
  try {
    const r = await client.query('WITH carts AS (DELETE FROM cart_items WHERE product_id = ANY($1)) DELETE FROM products pr WHERE pr.id = ANY($1) AND NOT EXISTS (SELECT 1 FROM order_line_items o WHERE o.product_id = pr.id) RETURNING pr.id', [ids]);
    await client.query('RELEASE SAVEPOINT delete_step'); return r.rows.map((x) => x.id);
  } catch (err) { await client.query('ROLLBACK TO SAVEPOINT delete_step'); if (err.code === '23503') return -1; throw err; }
}

const badIds = (res, ids) => res.status(400).json({ error: ids === null ? 'Expected { ids: [product ids] }' : ids.length === 0 ? 'No product was chosen' : `At most ${MAX_IDS} products at a time` });

router.post('/delete-check', ...guard, async (req, res, next) => {
  try {
    const ids = idsOf(req.body); if (ids === null || ids.length === 0 || ids.length > MAX_IDS) return badIds(res, ids);
    const p = await planDelete(db, ids);
    res.json({ ...p, needsPhrase: ids.length > 1, phrase: PHRASE });
  } catch (err) { next(err); }
});

router.post('/delete', ...guard, async (req, res, next) => {
  let client;
  try {
    const ids = idsOf(req.body); if (ids === null || ids.length === 0 || ids.length > MAX_IDS) return badIds(res, ids);
    const confirm = req.body.confirm;
    if (ids.length > 1 && String(confirm || '').trim() !== PHRASE) return res.status(400).json({ error: `To delete several products at once, type ${PHRASE} to confirm. Nothing was deleted.` });
    if (ids.length === 1 && confirm !== true && String(confirm || '').trim() !== PHRASE) return res.status(400).json({ error: 'Confirm the deletion (confirm: true). Nothing was deleted.' });
    client = await db.getPool().connect(); await client.query('BEGIN');
    const p = await planDelete(client, ids); const names = new Map(p.deletable.map((x) => [x.id, x]));
    const imageRows = p.deletable.length ? (await client.query('SELECT product_id, url FROM product_images WHERE product_id = ANY($1)', [p.deletable.map((x) => x.id)])).rows : [];
    const toDelete = p.deletable.filter((x) => !x.keepsHistory).map((x) => x.id); let gone = toDelete.length ? await attempt(client, toDelete) : [];
    if (gone === -1) { gone = []; for (const id of toDelete) { const one = await attempt(client, [id]); if (one !== -1) gone.push(...one); } }
    // removed completely is not possible (something still points at it): mark it deleted instead, like the ones with history
    const refusedHard = toDelete.filter((id) => !gone.includes(id));
    gone.push(...await retire(client, [...p.deletable.filter((x) => x.keepsHistory).map((x) => x.id), ...refusedHard]));
    await client.query('COMMIT'); client.release(); client = null;
    const goneSet = new Set(gone); const deleted = gone.map((id) => ({ id, name: names.get(id).name }));
    const refused = p.deletable.filter((x) => !goneSet.has(x.id)).map((x) => ({ ...x, reason: STILL_USED }));
    let picturesRemoved = 0; try { picturesRemoved = await removeIfUnused(db, imageRows.filter((r) => goneSet.has(r.product_id)).map((r) => r.url)); } catch (err) { console.error('Removing the pictures of deleted products failed:', err.message); }
    if (deleted.length > 0) await logAdminAction(req, 'products_deleted', 'product', deleted.map((d) => d.id).slice(0, 20).join(','), { count: deleted.length, names: deleted.map((d) => d.name).slice(0, 20) });
    res.json({ deleted, kept: [...p.held, ...refused], missing: p.missing, alsoRemoved: p.alsoRemoved, picturesRemoved });
  } catch (err) {
    if (client) { await client.query('ROLLBACK').catch(() => {}); client.release(); }
    next(err);
  }
});

// POST /send-to-review { ids }: hidden (inactive) products go back to the moderation queue (status 'translating'), NOT straight to live: a product that was rejected for bad text must pass the review again. Live products are left alone.
router.post('/send-to-review', ...guard, async (req, res, next) => {
  try {
    const ids = idsOf(req.body); if (ids === null || ids.length === 0 || ids.length > MAX_IDS) return badIds(res, ids);
    const { rows } = await db.query("UPDATE products SET status = 'translating' WHERE id = ANY($1) AND status = 'inactive' AND deleted_at IS NULL RETURNING id, name", [ids]);
    if (rows.length > 0) await logAdminAction(req, 'products_sent_to_review', 'product', rows.map((r) => r.id).slice(0, 20).join(','), { count: rows.length, names: rows.map((r) => r.name).slice(0, 20) });
    const sent = new Set(rows.map((r) => r.id));
    res.json({ sent: rows, skipped: ids.filter((id) => !sent.has(id)) });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.planDelete = planDelete;
module.exports.attempt = attempt;
module.exports.waitingOrders = waitingOrders;
module.exports.retire = retire;
