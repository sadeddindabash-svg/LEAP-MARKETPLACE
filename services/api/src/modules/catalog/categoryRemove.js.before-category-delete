// Categories: "Cannot delete this category - real products still reference it". Mounted at /catalog/admin/categories:
//   GET  /:id/in-use   shows exactly which products still use the category (by state: live, hidden, waiting for review, drafts), which of them could be deleted and which could not (and why). Changes nothing.
//   POST /:id/remove   { confirm: "DELETE CATEGORY" }: deletes those products (the ones nothing points at), the category's sub-categories, and the category itself, in ONE step.
// The same protections as deleting a product: a product that an order, a quote request or any other record points at is NEVER deleted (every table is looked up in the database itself), and each deletion is tried on its own as a
// last safety net. If a product has to stay, so does its category (the answer says so and why). Admin only, and only for admins who may open Categories.
const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');
const { blockers, tablesText } = require('../catalogImport/replace');
const { removeIfUnused } = require('../uploads/unusedPictures');
const { planDelete, attempt } = require('./productDelete');

const router = express.Router();
const guard = [requireAuth, requireRole('admin'), requirePageAccess('categories')];
const PHRASE = 'DELETE CATEGORY';
const STILL_USED = 'it is still used by something else (the database would not let it go)';
const STATES = { active: 'live', inactive: 'hidden', translating: 'waiting for review', draft: 'supplier drafts' };
const CHUNK = 500;

const productsOf = async (q, id) => (await q.query('SELECT id, name, status, part FROM products WHERE category = $1 ORDER BY status, name, id', [id])).rows;
/** The plan for all the products of the category (in chunks, so a large category is fine). */
async function planAll(q, products) {
  const out = { deletable: [], held: [], alsoRemoved: new Map() };
  for (let i = 0; i < products.length; i += CHUNK) {
    const p = await planDelete(q, products.slice(i, i + CHUNK).map((x) => x.id)); out.deletable.push(...p.deletable); out.held.push(...p.held);
    for (const r of p.alsoRemoved) out.alsoRemoved.set(r.what, (out.alsoRemoved.get(r.what) || 0) + r.count);
  }
  return { ...out, alsoRemoved: [...out.alsoRemoved].map(([what, count]) => ({ what, count })) };
}

router.get('/:id/in-use', ...guard, async (req, res, next) => {
  try {
    const cat = (await db.query('SELECT id, name_en FROM product_categories WHERE id = $1', [req.params.id])).rows[0]; if (!cat) return res.status(404).json({ error: 'Category not found' });
    const products = await productsOf(db, cat.id); const plan = await planAll(db, products);
    const byState = {}; for (const [status, label] of Object.entries(STATES)) byState[label] = products.filter((p) => p.status === status).length;
    const parts = Number((await db.query('SELECT count(*) AS n FROM category_parts WHERE category_id = $1', [cat.id])).rows[0].n);
    res.json({ category: { id: cat.id, name: cat.name_en }, total: products.length, byState, parts, deletable: plan.deletable.length, sample: plan.deletable.slice(0, 10).map(({ id, name, status }) => ({ id, name, status })),
      held: plan.held.slice(0, 20).map(({ id, name, status, reason }) => ({ id, name, status, reason })), heldTotal: plan.held.length, alsoRemoved: plan.alsoRemoved, phrase: PHRASE });
  } catch (err) { next(err); }
});

router.post('/:id/remove', ...guard, async (req, res, next) => {
  let client;
  try {
    if (String((req.body || {}).confirm || '').trim() !== PHRASE) return res.status(400).json({ error: `To delete the category together with its products, type ${PHRASE} to confirm. Nothing was deleted.` });
    client = await db.getPool().connect(); await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['catalog_import']);                    // never at the same moment as an import
    const cat = (await client.query('SELECT id, name_en FROM product_categories WHERE id = $1', [req.params.id])).rows[0];
    if (!cat) { await client.query('ROLLBACK'); client.release(); client = null; return res.status(404).json({ error: 'Category not found' }); }
    const products = await productsOf(client, cat.id); const plan = await planAll(client, products); const names = new Map(products.map((p) => [p.id, p]));
    const imageRows = plan.deletable.length ? (await client.query('SELECT product_id, url FROM product_images WHERE product_id = ANY($1)', [plan.deletable.map((p) => p.id)])).rows : [];
    const gone = new Set();
    for (let i = 0; i < plan.deletable.length; i += CHUNK) {
      const ids = plan.deletable.slice(i, i + CHUNK).map((p) => p.id); let done = await attempt(client, ids);
      if (done === -1) { done = []; for (const id of ids) { const one = await attempt(client, [id]); if (one !== -1) done.push(...one); } }
      done.forEach((id) => gone.add(id));
    }
    const stay = products.filter((p) => !gone.has(p.id)).map((p) => ({ id: p.id, name: p.name, status: p.status, reason: (plan.held.find((h) => h.id === p.id) || { reason: STILL_USED }).reason }));
    // the sub-categories: removed when no product still uses them and no other record points at them
    const parts = (await client.query('SELECT id, name_en FROM category_parts WHERE category_id = $1', [cat.id])).rows; const partHeld = await blockers(client, 'category_parts', parts.map((p) => p.id)); const partsGone = new Set();
    const delPart = async (ids) => { await client.query('SAVEPOINT remove_step'); try { const r = await client.query('DELETE FROM category_parts p WHERE p.id = ANY($1) AND NOT EXISTS (SELECT 1 FROM products pr WHERE pr.category = p.category_id AND lower(btrim(pr.part)) = lower(btrim(p.name_en))) RETURNING p.id', [ids]); await client.query('RELEASE SAVEPOINT remove_step'); return r.rows.map((x) => x.id); } catch (err) { await client.query('ROLLBACK TO SAVEPOINT remove_step'); if (err.code === '23503') return -1; throw err; } };
    const free = parts.filter((p) => !partHeld.has(p.id)).map((p) => p.id); let pdone = free.length ? await delPart(free) : [];
    if (pdone === -1) { pdone = []; for (const id of free) { const one = await delPart([id]); if (one !== -1) pdone.push(...one); } } pdone.forEach((id) => partsGone.add(id));
    const partsStay = parts.filter((p) => !partsGone.has(p.id)).map((p) => ({ id: p.id, name: p.name_en, reason: partHeld.has(p.id) ? `it is used in ${tablesText(partHeld.get(p.id))}` : stay.some((x) => String(products.find((q2) => q2.id === x.id).part || '').trim().toLowerCase() === String(p.name_en).trim().toLowerCase()) ? 'a product that has to stay uses it' : STILL_USED }));
    // the category itself, only when nothing is left in it
    let categoryRemoved = false; let categoryReason = null;
    if (stay.length > 0) categoryReason = `${stay.length === 1 ? '1 product has' : `${stay.length} products have`} to stay, so the category stays`;
    else if (partsStay.length > 0) categoryReason = `${partsStay.length === 1 ? '1 sub-category has' : `${partsStay.length} sub-categories have`} to stay, so the category stays`;
    else {
      const other = await blockers(client, 'product_categories', [cat.id], { ignore: ['category_parts'] });
      if (other.has(cat.id)) categoryReason = `it is used in ${tablesText(other.get(cat.id))}`;
      else {
        await client.query('SAVEPOINT remove_step');
        try { await client.query('DELETE FROM product_categories WHERE id = $1', [cat.id]); await client.query('RELEASE SAVEPOINT remove_step'); categoryRemoved = true; }
        catch (err) { await client.query('ROLLBACK TO SAVEPOINT remove_step'); if (err.code !== '23503') throw err; categoryReason = STILL_USED; }
      }
    }
    await client.query('COMMIT'); client.release(); client = null;
    let picturesRemoved = 0; try { picturesRemoved = await removeIfUnused(db, imageRows.filter((r) => gone.has(r.product_id)).map((r) => r.url)); } catch (err) { console.error('Removing the pictures of the deleted products failed:', err.message); }
    await logAdminAction(req, 'category_removed_with_products', 'category', cat.id, { name: cat.name_en, products: gone.size, subCategories: partsGone.size, categoryRemoved });
    res.json({ category: { id: cat.id, name: cat.name_en }, removedProducts: gone.size, removedSubCategories: partsGone.size, categoryRemoved, kept: { products: stay, subCategories: partsStay, category: categoryReason }, picturesRemoved, deletedNames: [...gone].slice(0, 20).map((id) => names.get(id).name) });
  } catch (err) {
    if (client) { await client.query('ROLLBACK').catch(() => {}); client.release(); }
    next(err);
  }
});

module.exports = router;
