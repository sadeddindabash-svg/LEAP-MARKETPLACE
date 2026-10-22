// "Make the catalog exactly the sheet": everything the sheet does not mention is OLD and is removed. ONE function decides what (planRemoval, which only READS: the check uses it and removes nothing), and the real import runs the same
// function and then removes exactly what it found (applyRemoval), inside the same transaction as the import: all of it or none of it.
//   * "in the sheet" = every category and part a valid row of the sheet matches (an existing one) or creates (a new one). Anything else is old: made by hand, or by an earlier import.
//   * a part is removed only when no product uses it; a category only when it has no parts left and no product uses it (a product refers to its category and part by NAME).
//   * optionally ("alsoProducts") the products that use the old catalog are deleted first, but NEVER a product that other records point at (an order, a quote request, ...): that history keeps its products, and so do its part and category.
//   * NOTHING is assumed about which tables point at products, categories and parts: they are looked up in the database itself (every foreign key), so a table added later is protected too. And as a last safety net each deletion is tried on its
//     own: one the database refuses for any reason keeps its item, and the answer says what was REALLY removed.
//   * what is NOT removed is reported with the reason, so the result is never a surprise.
const { isPlaceholder } = require('./placeholders');

const REPLACE_PHRASE = 'REPLACE CATALOG';
const key = (s) => String(s ?? '').trim().toLowerCase();
const count = (map, k) => map.get(k) || 0;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const FRIENDLY = { order_line_items: 'an order', quote_request_items: 'a quote request' };
const tablesText = (set) => [...set].map((t) => FRIENDLY[t] || `the table ${t}`).join(' and ');
const history = (set) => (set.size === 1 && set.has('order_line_items') ? 'order history' : 'that history');      // "order history keeps its products" when only orders are involved
const STILL_USED = 'it is still used by something else (the database would not let it go)';

/** For each id of `ids` in `parent` (a table name), the set of OTHER tables that point at it with a foreign key that would block its deletion (no cascade). Looked up in the database itself. */
async function blockers(q, parent, ids, { ignore = [] } = {}) {
  const out = new Map(); if (ids.length === 0) return out;
  const { rows } = await q.query(
    `SELECT c.conrelid::regclass::text AS tbl, a.attname AS col FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.confrelid = $1::regclass AND c.confdeltype IN ('a', 'r') AND array_length(c.conkey, 1) = 1`, [parent]);
  for (const { tbl, col } of rows) {
    const bare = tbl.replace(/^public\./, '').replace(/"/g, '');
    if (ignore.includes(bare) || !/^[A-Za-z0-9_]+$/.test(bare) || !/^[A-Za-z0-9_]+$/.test(col)) continue;      // an unusual name is left to the safety net in applyRemoval
    const found = await q.query(`SELECT DISTINCT "${col}" AS id FROM "${bare}" WHERE "${col}" = ANY($1)`, [ids]);
    for (const r of found.rows) { if (!out.has(r.id)) out.set(r.id, new Set()); out.get(r.id).add(bare); }
  }
  return out;
}

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
  const pointedAt = await blockers(q, 'products', using.map((p) => p.id), { ignore: ['cart_items'] });          // orders, quote requests, anything else that points at a product (a shopper's cart lines are simply removed with it)
  const holdTables = (p) => { const t = new Set(pointedAt.get(p.id) || []); if (p.ordered) t.add('order_line_items'); return t; };
  const isHeld = (p) => holdTables(p).size > 0;
  const heldBy = (list) => { const t = new Set(); for (const p of list) for (const x of holdTables(p)) t.add(x); return t.size ? history(t) : null; };      // the words for "what keeps it" when some of its products are held by other records
  const doomed = alsoProducts ? using.filter((p) => !isHeld(p)) : [];
  const doomedIds = new Set(doomed.map((p) => p.id));
  const staying = using.filter((p) => !doomedIds.has(p.id));
  const usersOfPart = new Map(); const usersOfCategory = new Map();
  for (const p of staying) { const pk = `${p.category}|${key(p.part)}`; usersOfPart.set(pk, count(usersOfPart, pk) + 1); usersOfCategory.set(p.category, count(usersOfCategory, p.category) + 1); }
  const why = (n, held) => `${plural(n, 'product uses', 'products use')} it${held ? ` (and ${held} keeps it)` : ''}`;

  const partBlockers = await blockers(q, 'category_parts', oldParts.map((p) => p.id));
  const removedParts = []; const keptParts = [];
  for (const p of oldParts) {
    const n = count(usersOfPart, `${p.category_id}|${key(p.name_en)}`); const other = partBlockers.get(p.id);
    if (n === 0 && !other) removedParts.push({ id: p.id, name: p.name_en, category: p.category_id, code: p.code, photoUrl: p.photo_url });
    else keptParts.push({ id: p.id, name: p.name_en, category: p.category_id, reason: n > 0 ? why(n, heldBy(staying.filter((s) => s.category === p.category_id && key(s.part) === key(p.name_en)))) : `it is used in ${tablesText(other)}` });
  }
  const removedPartIds = new Set(removedParts.map((p) => p.id));
  const partsLeft = new Map(); for (const p of parts) if (!removedPartIds.has(p.id)) partsLeft.set(p.category_id, count(partsLeft, p.category_id) + 1);
  const catBlockers = await blockers(q, 'product_categories', oldCats.map((c) => c.id), { ignore: ['category_parts'] });
  const removedCategories = []; const keptCategories = [];
  for (const c of oldCats) {
    const n = count(usersOfCategory, c.id); const other = catBlockers.get(c.id);
    if (n === 0 && count(partsLeft, c.id) === 0 && !other) removedCategories.push({ id: c.id, name: c.name_en, code: c.code, photoUrl: c.photo_url });
    else keptCategories.push({ id: c.id, name: c.name_en, reason: n > 0 ? why(n, heldBy(staying.filter((s) => s.category === c.id))) : other ? `it is used in ${tablesText(other)}` : `it still has ${plural(count(partsLeft, c.id), 'part that stays', 'parts that stay')}` });
  }
  const real = (url) => (url && !isPlaceholder(url) ? url : null);
  const plan = {
    alsoProducts: Boolean(alsoProducts),
    counts: { categories: removedCategories.length, parts: removedParts.length, products: doomed.length },
    categories: removedCategories.map(({ photoUrl, ...c }) => c), parts: removedParts.map(({ photoUrl, ...p }) => p), products: doomed.map((p) => ({ id: p.id, name: p.name, category: p.category, part: p.part })),
    kept: { categories: keptCategories, parts: keptParts, products: staying.filter(isHeld).map((p) => ({ id: p.id, name: p.name, category: p.category, part: p.part, reason: holdTables(p).size === 1 && holdTables(p).has('order_line_items') ? 'it has been in an order: order history keeps its products' : `it is used in ${tablesText(holdTables(p))}: that history keeps its products` })) },
  };
  // the pictures of what is removed, kept out of the answer sent to the screen (not enumerable)
  Object.defineProperty(plan, 'photos', { value: { categories: new Map(removedCategories.map((c) => [c.id, real(c.photoUrl)])), parts: new Map(removedParts.map((p) => [p.id, real(p.photoUrl)])) }, enumerable: false });
  return plan;
}

/** Deletes with a savepoint: -1 when the database refuses because something still points at it (nothing is changed then), otherwise the ids it removed. */
async function attempt(client, sql, params) {
  await client.query('SAVEPOINT replace_step');
  try { const r = await client.query(sql, params); await client.query('RELEASE SAVEPOINT replace_step'); return r.rows.map((x) => x.id); }
  catch (err) { await client.query('ROLLBACK TO SAVEPOINT replace_step'); if (err.code === '23503') return -1; throw err; }
}
/** Removes what planRemoval found (inside the import's transaction), the whole lot at once and, if the database refuses, one by one: whatever it refuses stays. The plan is then CORRECTED to what really happened (counts, lists, what stays and why).
 *  Returns the pictures that can now be deleted: those of the removed categories and parts, and of the deleted products. */
async function applyRemoval(client, plan) {
  const removed = { products: [], parts: [], categories: [] }; const refused = { products: [], parts: [], categories: [] }; const imageUrls = [];
  const imagesOf = async (ids) => (await client.query('SELECT product_id, url FROM product_images WHERE product_id = ANY($1)', [ids])).rows;
  const delProducts = (ids) => attempt(client, 'WITH carts AS (DELETE FROM cart_items WHERE product_id = ANY($1)) DELETE FROM products pr WHERE pr.id = ANY($1) AND NOT EXISTS (SELECT 1 FROM order_line_items o WHERE o.product_id = pr.id) RETURNING pr.id', [ids]);
  const delParts = (ids) => attempt(client, 'DELETE FROM category_parts p WHERE p.id = ANY($1) AND NOT EXISTS (SELECT 1 FROM products pr WHERE pr.category = p.category_id AND lower(btrim(pr.part)) = lower(btrim(p.name_en))) RETURNING p.id', [ids]);
  const delCats = (ids) => attempt(client, 'DELETE FROM product_categories c WHERE c.id = ANY($1) AND NOT EXISTS (SELECT 1 FROM category_parts p WHERE p.category_id = c.id) AND NOT EXISTS (SELECT 1 FROM products pr WHERE pr.category = c.id) RETURNING c.id', [ids]);
  const run = async (list, del, into, refusedInto) => {
    if (list.length === 0) return; let out = await del(list.map((x) => x.id));
    if (out === -1) { out = []; for (const x of list) { const one = await del([x.id]); if (one === -1) refusedInto.push(x); else out.push(...one); } }
    into.push(...out);
  };
  const productImages = plan.products.length ? await imagesOf(plan.products.map((p) => p.id)) : [];
  await run(plan.products, delProducts, removed.products, refused.products);
  const gone = new Set(removed.products); for (const i of productImages) if (gone.has(i.product_id)) imageUrls.push(i.url);
  await run(plan.parts, delParts, removed.parts, refused.parts);
  await run(plan.categories, delCats, removed.categories, refused.categories);

  // the plan is corrected to what REALLY happened
  const keepWhy = (x, extra) => ({ id: x.id, name: x.name, ...(extra || {}), reason: STILL_USED });
  const was = { products: plan.products, parts: plan.parts, categories: plan.categories };
  const didSet = (ids) => new Set(ids);
  const photoUrls = [...removed.categories.map((id) => plan.photos.categories.get(id)), ...removed.parts.map((id) => plan.photos.parts.get(id))].filter(Boolean);
  for (const x of was.products) if (!didSet(removed.products).has(x.id)) plan.kept.products.push({ ...x, reason: STILL_USED });
  for (const x of was.parts) if (!didSet(removed.parts).has(x.id)) plan.kept.parts.push(keepWhy(x, { category: x.category }));
  for (const x of was.categories) if (!didSet(removed.categories).has(x.id)) plan.kept.categories.push(keepWhy(x));
  plan.products = was.products.filter((x) => didSet(removed.products).has(x.id)); plan.parts = was.parts.filter((x) => didSet(removed.parts).has(x.id)); plan.categories = was.categories.filter((x) => didSet(removed.categories).has(x.id));
  plan.counts = { categories: plan.categories.length, parts: plan.parts.length, products: plan.products.length };
  return { imageUrls, photoUrls };
}
module.exports = { planRemoval, applyRemoval, REPLACE_PHRASE };
