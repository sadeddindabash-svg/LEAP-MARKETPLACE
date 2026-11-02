// Categories and sub-categories: "Cannot delete this ... - real products still reference it". Mounted at /catalog/admin/categories and /catalog/admin/parts:
//   GET  /:id/in-use   shows exactly which products still use the category (or sub-category), by state (live, hidden, waiting for review, drafts), which of them will be deleted and which cannot be (and why). Changes nothing.
//   POST /:id/remove   { confirm: "DELETE CATEGORY" | "DELETE SUB-CATEGORY" }: deletes those products, then (a category) its sub-categories and the category itself, or (a sub-category) the sub-category, in ONE step.
// The products follow EXACTLY the rule of Products > Delete (productDelete.js):
//   * a product a buyer is still WAITING for (an order not finished: to pay, to ship, shipped, delivered but still inside its return period, an open return or dispute) is NEVER deleted, and while it exists its
//     sub-category and category stay too (the answer says which orders);
//   * a product with no history at all is removed completely (with its pictures, reviews, cart lines...);
//   * a product with history (finished orders, quote requests...) is MARKED deleted: it goes from the shop and both portals, its old orders still show it ("This product is no longer available").
// A product already marked deleted no longer counts as using anything. Admin only, and only for admins who may open Categories.
const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');
const { blockers, tablesText } = require('../catalogImport/replace');
const { removeIfUnused } = require('../uploads/unusedPictures');
const { planDelete, attempt, retire } = require('./productDelete');

const guard = [requireAuth, requireRole('admin'), requirePageAccess('categories')];
const PHRASES = { category: 'DELETE CATEGORY', part: 'DELETE SUB-CATEGORY' };
const WORD = { category: 'category', part: 'sub-category' };
const STILL_USED = 'it is still used by something else (the database would not let it go)';
const STATES = { active: 'live', inactive: 'hidden', translating: 'waiting for review', draft: 'supplier drafts' };
const CHUNK = 500;
const LIVE = 'deleted_at IS NULL';              // a product marked deleted no longer uses anything
const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/** The category or sub-category (null when not found), and the products that use it. */
async function scopeOf(q, kind, id) {
  if (kind === 'category') {
    const row = (await q.query('SELECT id, name_en FROM product_categories WHERE id = $1', [id])).rows[0]; if (!row) return null;
    const products = (await q.query(`SELECT id, name, status, part FROM products WHERE category = $1 AND ${LIVE} ORDER BY status, name, id`, [id])).rows;
    return { id: row.id, name: row.name_en, categoryId: row.id, products };
  }
  const row = (await q.query('SELECT id, category_id, name_en FROM category_parts WHERE id = $1', [id])).rows[0]; if (!row) return null;
  const products = (await q.query(`SELECT id, name, status, part FROM products WHERE category = $1 AND lower(btrim(part)) = lower(btrim($2)) AND ${LIVE} ORDER BY status, name, id`, [row.category_id, row.name_en])).rows;
  return { id: row.id, name: row.name_en, categoryId: row.category_id, products };
}

/** The plan for all the products (in chunks, so a large category is fine). */
async function planAll(q, products) {
  const out = { deletable: [], held: [], alsoRemoved: new Map() };
  for (let i = 0; i < products.length; i += CHUNK) {
    const p = await planDelete(q, products.slice(i, i + CHUNK).map((x) => x.id)); out.deletable.push(...p.deletable); out.held.push(...p.held);
    for (const r of p.alsoRemoved) out.alsoRemoved.set(r.what, (out.alsoRemoved.get(r.what) || 0) + r.count);
  }
  return { ...out, alsoRemoved: [...out.alsoRemoved].map(([what, count]) => ({ what, count })) };
}

/** Deletes products the way Products > Delete does: removed completely when nothing points at them, otherwise marked deleted. Returns the ids that are gone. */
async function removeProducts(client, deletable) {
  const gone = new Set();
  const hard = deletable.filter((p) => !p.keepsHistory).map((p) => p.id);
  for (let i = 0; i < hard.length; i += CHUNK) {
    const ids = hard.slice(i, i + CHUNK); let done = await attempt(client, ids);
    if (done === -1) { done = []; for (const id of ids) { const one = await attempt(client, [id]); if (one !== -1) done.push(...one); } }
    done.forEach((id) => gone.add(id));
  }
  const toRetire = [...deletable.filter((p) => p.keepsHistory).map((p) => p.id), ...hard.filter((id) => !gone.has(id))];      // something the check could not see still points at it: marked deleted instead
  for (let i = 0; i < toRetire.length; i += CHUNK) (await retire(client, toRetire.slice(i, i + CHUNK))).forEach((id) => gone.add(id));
  return gone;
}

/** Deletes one or more sub-categories that no live product uses and no other record points at (a savepoint per try). Returns -1 when the database refuses. */
async function deleteParts(client, ids) {
  await client.query('SAVEPOINT remove_step');
  try {
    const r = await client.query(`DELETE FROM category_parts p WHERE p.id = ANY($1) AND NOT EXISTS (SELECT 1 FROM products pr WHERE pr.category = p.category_id AND lower(btrim(pr.part)) = lower(btrim(p.name_en)) AND pr.${LIVE}) RETURNING p.id`, [ids]);
    await client.query('RELEASE SAVEPOINT remove_step'); return r.rows.map((x) => x.id);
  } catch (err) { await client.query('ROLLBACK TO SAVEPOINT remove_step'); if (err.code === '23503') return -1; throw err; }
}

function makeRouter(kind) {
  const router = express.Router();
  const PHRASE = PHRASES[kind]; const word = WORD[kind]; const notFound = kind === 'category' ? 'Category not found' : 'Sub-category not found';

  router.get('/:id/in-use', ...guard, async (req, res, next) => {
    try {
      const scope = await scopeOf(db, kind, req.params.id); if (!scope) return res.status(404).json({ error: notFound });
      const plan = await planAll(db, scope.products);
      const byState = {}; for (const [status, label] of Object.entries(STATES)) byState[label] = scope.products.filter((p) => p.status === status).length;
      const parts = kind === 'category' ? Number((await db.query('SELECT count(*) AS n FROM category_parts WHERE category_id = $1', [scope.id])).rows[0].n) : 0;
      res.json({
        kind, category: { id: scope.id, name: scope.name }, total: scope.products.length, byState, parts,
        deletable: plan.deletable.length, keepsHistory: plan.deletable.filter((p) => p.keepsHistory).length,
        sample: plan.deletable.slice(0, 10).map(({ id, name, status, keepsHistory }) => ({ id, name, status, keepsHistory })),
        held: plan.held.slice(0, 20).map(({ id, name, status, reason }) => ({ id, name, status, reason })), heldTotal: plan.held.length, alsoRemoved: plan.alsoRemoved, phrase: PHRASE,
      });
    } catch (err) { next(err); }
  });

  router.post('/:id/remove', ...guard, async (req, res, next) => {
    let client;
    try {
      if (String((req.body || {}).confirm || '').trim() !== PHRASE) return res.status(400).json({ error: `To delete the ${word} together with its products, type ${PHRASE} to confirm. Nothing was deleted.` });
      client = await db.getPool().connect(); await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['catalog_import']);                    // never at the same moment as an import
      const scope = await scopeOf(client, kind, req.params.id);
      if (!scope) { await client.query('ROLLBACK'); client.release(); client = null; return res.status(404).json({ error: notFound }); }
      const plan = await planAll(client, scope.products); const names = new Map(scope.products.map((p) => [p.id, p]));
      const imageRows = plan.deletable.length ? (await client.query('SELECT product_id, url FROM product_images WHERE product_id = ANY($1)', [plan.deletable.map((p) => p.id)])).rows : [];
      const gone = await removeProducts(client, plan.deletable);
      const stay = scope.products.filter((p) => !gone.has(p.id)).map((p) => ({ id: p.id, name: p.name, status: p.status, reason: (plan.held.find((h) => h.id === p.id) || { reason: STILL_USED }).reason }));
      const stayUses = (partName) => stay.some((x) => sameText(names.get(x.id).part, partName));

      // the sub-categories: removed when no product still uses them and no other record points at them
      const parts = kind === 'category'
        ? (await client.query('SELECT id, name_en FROM category_parts WHERE category_id = $1', [scope.id])).rows
        : (await client.query('SELECT id, name_en FROM category_parts WHERE id = $1', [scope.id])).rows;
      const partHeld = await blockers(client, 'category_parts', parts.map((p) => p.id)); const partsGone = new Set();
      const free = parts.filter((p) => !partHeld.has(p.id) && !stayUses(p.name_en)).map((p) => p.id); let pdone = free.length ? await deleteParts(client, free) : [];
      if (pdone === -1) { pdone = []; for (const id of free) { const one = await deleteParts(client, [id]); if (one !== -1) pdone.push(...one); } }
      pdone.forEach((id) => partsGone.add(id));
      const partsStay = parts.filter((p) => !partsGone.has(p.id)).map((p) => ({ id: p.id, name: p.name_en, reason: partHeld.has(p.id) ? `it is used in ${tablesText(partHeld.get(p.id))}` : stayUses(p.name_en) ? 'a product that has to stay uses it' : STILL_USED }));

      // a category itself, only when nothing is left in it
      let categoryRemoved = false; let categoryReason = null;
      if (kind === 'category') {
        if (stay.length > 0) categoryReason = `${stay.length === 1 ? '1 product has' : `${stay.length} products have`} to stay, so the category stays`;
        else if (partsStay.length > 0) categoryReason = `${partsStay.length === 1 ? '1 sub-category has' : `${partsStay.length} sub-categories have`} to stay, so the category stays`;
        else {
          const other = await blockers(client, 'product_categories', [scope.id], { ignore: ['category_parts'] });
          if (other.has(scope.id)) categoryReason = `it is used in ${tablesText(other.get(scope.id))}`;
          else {
            await client.query('SAVEPOINT remove_step');
            try { await client.query('DELETE FROM product_categories WHERE id = $1', [scope.id]); await client.query('RELEASE SAVEPOINT remove_step'); categoryRemoved = true; }
            catch (err) { await client.query('ROLLBACK TO SAVEPOINT remove_step'); if (err.code !== '23503') throw err; categoryReason = STILL_USED; }
          }
        }
      }
      await client.query('COMMIT'); client.release(); client = null;
      let picturesRemoved = 0; try { picturesRemoved = await removeIfUnused(db, imageRows.filter((r) => gone.has(r.product_id)).map((r) => r.url)); } catch (err) { console.error('Removing the pictures of the deleted products failed:', err.message); }
      const markedDeleted = plan.deletable.filter((p) => gone.has(p.id) && p.keepsHistory).length;
      await logAdminAction(req, kind === 'category' ? 'category_removed_with_products' : 'subcategory_removed_with_products', kind === 'category' ? 'category' : 'part', scope.id,
        { name: scope.name, products: gone.size, markedDeleted, subCategories: partsGone.size, categoryRemoved });
      res.json({
        kind, category: { id: scope.id, name: scope.name }, removedProducts: gone.size, markedDeleted, removedSubCategories: partsGone.size,
        categoryRemoved: kind === 'category' ? categoryRemoved : partsGone.has(scope.id),
        kept: { products: stay, subCategories: kind === 'category' ? partsStay : [], category: kind === 'category' ? categoryReason : (partsGone.has(scope.id) ? null : (partsStay[0] && partsStay[0].reason === 'a product that has to stay uses it' ? `${stay.length === 1 ? '1 product has' : `${stay.length} products have`} to stay, so the sub-category stays` : (partsStay[0] ? partsStay[0].reason : null))) },
        picturesRemoved, deletedNames: [...gone].slice(0, 20).map((id) => names.get(id).name),
      });
    } catch (err) {
      if (client) { await client.query('ROLLBACK').catch(() => {}); client.release(); }
      next(err);
    }
  });
  return router;
}

module.exports = makeRouter('category');
module.exports.partsRouter = makeRouter('part');
module.exports.scopeOf = scopeOf;
