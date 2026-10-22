// "Make the catalog exactly the sheet": everything the sheet does not mention is OLD and is removed. ONE function decides what (planRemoval, which only READS: the check uses it and removes nothing), and the real import runs the same
// function and then removes exactly what it found (applyRemoval), inside the same transaction as the import: all of it or none of it.
//   * "in the sheet" = every category and part a valid row of the sheet matches (an existing one) or creates (a new one). Anything else is old: made by hand, or by an earlier import.
//   * a part is removed only when no product uses it; a category only when it has no parts left and no product uses it (a product refers to its category and part by NAME).
//   * optionally ("alsoProducts") the products that use the old catalog are deleted first, but NEVER a product that has been in an order (order history keeps its products): its part and category stay.
//   * what is NOT removed is reported with the reason, so the result is never a surprise.
const { isPlaceholder } = require('./placeholders');

const REPLACE_PHRASE = 'REPLACE CATALOG';
const key = (s) => String(s ?? '').trim().toLowerCase();
const count = (map, k) => map.get(k) || 0;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** keep: { categoryIds: Set, partIds: Set } (what the sheet matches or creates). Returns what would be removed and what stays, and why. Reads only. */
async function planRemoval(q, keep, { alsoProducts = false } = {}) {
  const cats = (await q.query('SELECT id, name_en, code, photo_url FROM product_categories ORDER BY sort_order, id')).rows;
  const parts = (await q.query('SELECT id, category_id, name_en, code, photo_url FROM category_parts ORDER BY category_id, sort_order, id')).rows;
  const oldCats = cats.filter((c) => !keep.categoryIds.has(c.id));
  const oldParts = parts.filter((p) => !keep.partIds.has(p.id));
  const oldCatIds = new Set(oldCats.map((c) => c.id));
  const oldPartKeys = new Set(oldParts.map((p) => `${p.category_id}|${key(p.name_en)}`));

  const products = (await q.query('SELECT pr.id, pr.name, pr.category, pr.part, EXISTS (SELECT 1 FROM order_line_items o WHERE o.product_id = pr.id) AS ordered FROM products pr ORDER BY pr.id')).rows;
  const using = products.filter((p) => oldCatIds.has(p.category) || oldPartKeys.has(`${p.category}|${key(p.part)}`));
  const doomed = alsoProducts ? using.filter((p) => !p.ordered) : [];
  const doomedIds = new Set(doomed.map((p) => p.id));
  const staying = using.filter((p) => !doomedIds.has(p.id));
  const usersOfPart = new Map(); const usersOfCategory = new Map();
  for (const p of staying) { const pk = `${p.category}|${key(p.part)}`; usersOfPart.set(pk, count(usersOfPart, pk) + 1); usersOfCategory.set(p.category, count(usersOfCategory, p.category) + 1); }
  const why = (n, ordered) => `${plural(n, 'product uses', 'products use')} it${ordered ? ' (and order history keeps it)' : ''}`;

  const removedParts = []; const keptParts = [];
  for (const p of oldParts) {
    const n = count(usersOfPart, `${p.category_id}|${key(p.name_en)}`);
    if (n === 0) removedParts.push({ id: p.id, name: p.name_en, category: p.category_id, code: p.code, photoUrl: p.photo_url });
    else keptParts.push({ id: p.id, name: p.name_en, category: p.category_id, reason: why(n, staying.some((s) => s.ordered && s.category === p.category_id && key(s.part) === key(p.name_en))) });
  }
  const removedPartIds = new Set(removedParts.map((p) => p.id));
  const partsLeft = new Map(); for (const p of parts) if (!removedPartIds.has(p.id)) partsLeft.set(p.category_id, count(partsLeft, p.category_id) + 1);
  const removedCategories = []; const keptCategories = [];
  for (const c of oldCats) {
    const n = count(usersOfCategory, c.id);
    if (n === 0 && count(partsLeft, c.id) === 0) removedCategories.push({ id: c.id, name: c.name_en, code: c.code, photoUrl: c.photo_url });
    else keptCategories.push({ id: c.id, name: c.name_en, reason: n > 0 ? why(n, staying.some((s) => s.ordered && s.category === c.id)) : `it still has ${plural(count(partsLeft, c.id), 'part', 'parts')} that products use` });
  }
  const real = (url) => (url && !isPlaceholder(url) ? url : null);
  return {
    alsoProducts: Boolean(alsoProducts),
    counts: { categories: removedCategories.length, parts: removedParts.length, products: doomed.length },
    categories: removedCategories.map(({ photoUrl, ...c }) => c), parts: removedParts.map(({ photoUrl, ...p }) => p), products: doomed.map((p) => ({ id: p.id, name: p.name, category: p.category, part: p.part })),
    kept: { categories: keptCategories, parts: keptParts, products: staying.filter((p) => p.ordered).map((p) => ({ id: p.id, name: p.name, category: p.category, part: p.part, reason: 'it has been in an order: order history keeps its products' })) },
    photoUrls: [...removedCategories, ...removedParts].map((x) => real(x.photoUrl)).filter(Boolean),
  };
}

/** Removes exactly what planRemoval found (inside the import's transaction). Each delete is guarded again, so a product added a moment ago can never be orphaned. Returns the product pictures that went with the products. */
async function applyRemoval(client, plan) {
  let imageUrls = [];
  const productIds = plan.products.map((p) => p.id);
  if (productIds.length) {
    imageUrls = (await client.query('SELECT url FROM product_images WHERE product_id = ANY($1)', [productIds])).rows.map((r) => r.url);
    await client.query('DELETE FROM cart_items WHERE product_id = ANY($1)', [productIds]);
    await client.query('DELETE FROM products pr WHERE pr.id = ANY($1) AND NOT EXISTS (SELECT 1 FROM order_line_items o WHERE o.product_id = pr.id)', [productIds]);
  }
  if (plan.parts.length) await client.query(`DELETE FROM category_parts p WHERE p.id = ANY($1) AND NOT EXISTS (SELECT 1 FROM products pr WHERE pr.category = p.category_id AND lower(btrim(pr.part)) = lower(btrim(p.name_en)))`, [plan.parts.map((p) => p.id)]);
  if (plan.categories.length) await client.query('DELETE FROM product_categories c WHERE c.id = ANY($1) AND NOT EXISTS (SELECT 1 FROM category_parts p WHERE p.category_id = c.id) AND NOT EXISTS (SELECT 1 FROM products pr WHERE pr.category = c.id)', [plan.categories.map((c) => c.id)]);
  return { imageUrls };
}
module.exports = { planRemoval, applyRemoval, REPLACE_PHRASE };
