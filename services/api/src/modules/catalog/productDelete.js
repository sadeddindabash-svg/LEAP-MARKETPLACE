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

const idsOf = (body) => (Array.isArray(body && body.ids) ? [...new Set(body.ids.filter((x) => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()))] : null);

/** What would happen to these products: which can go, which cannot (and why), and what goes with the ones that can. Reads only. */
async function planDelete(q, ids) {
  const { rows: found } = await q.query('SELECT id, name, status FROM products WHERE id = ANY($1) ORDER BY name, id', [ids]);
  const there = new Set(found.map((p) => p.id));
  const pointedAt = await blockers(q, 'products', found.map((p) => p.id), { ignore: ['cart_items'] });
  const ordered = new Set((await q.query('SELECT DISTINCT product_id FROM order_line_items WHERE product_id = ANY($1)', [found.map((p) => p.id)])).rows.map((r) => r.product_id));
  const held = []; const deletable = [];
  for (const p of found) {
    const tables = new Set(pointedAt.get(p.id) || []); if (ordered.has(p.id)) tables.add('order_line_items');
    if (tables.size === 0) deletable.push(p);
    else held.push({ ...p, reason: tables.size === 1 && tables.has('order_line_items') ? 'it has been in an order: order history keeps its products' : `it is used in ${tablesText(tables)}: that history keeps its products` });
  }
  // what goes with the products that can be deleted: the rows of every table that cascades from products, plus the cart lines
  const counts = new Map(); const deletableIds = deletable.map((p) => p.id);
  if (deletableIds.length) {
    const { rows: cascading } = await q.query(`SELECT c.conrelid::regclass::text AS tbl, a.attname AS col FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1] WHERE c.contype = 'f' AND c.confrelid = 'products'::regclass AND (c.confdeltype = 'c' OR c.conrelid = 'cart_items'::regclass) AND array_length(c.conkey, 1) = 1`);
    for (const { tbl, col } of cascading) {
      const bare = tbl.replace(/^public\./, '').replace(/"/g, ''); if (!/^[A-Za-z0-9_]+$/.test(bare) || !/^[A-Za-z0-9_]+$/.test(col)) continue;
      const n = Number((await q.query(`SELECT count(*) AS n FROM "${bare}" WHERE "${col}" = ANY($1)`, [deletableIds])).rows[0].n);
      if (n > 0) { const label = WENT_WITH[bare] || bare; counts.set(label, (counts.get(label) || 0) + n); }
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
    const toDelete = p.deletable.map((x) => x.id); let gone = toDelete.length ? await attempt(client, toDelete) : [];
    if (gone === -1) { gone = []; for (const id of toDelete) { const one = await attempt(client, [id]); if (one !== -1) gone.push(...one); } }
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
    const { rows } = await db.query("UPDATE products SET status = 'translating' WHERE id = ANY($1) AND status = 'inactive' RETURNING id, name", [ids]);
    if (rows.length > 0) await logAdminAction(req, 'products_sent_to_review', 'product', rows.map((r) => r.id).slice(0, 20).join(','), { count: rows.length, names: rows.map((r) => r.name).slice(0, 20) });
    const sent = new Set(rows.map((r) => r.id));
    res.json({ sent: rows, skipped: ids.filter((id) => !sent.has(id)) });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.planDelete = planDelete;
