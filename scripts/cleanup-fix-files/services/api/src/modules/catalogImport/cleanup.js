// "Start clean": removes the OLD catalog (the categories and parts made by hand before the parts catalog was imported), so the imported catalog stands alone.
//   * "old" = a category or part that no import created (no import batch) and that has no catalog code. Anything the import created, or filled with a catalog code, is never touched.
//   * a part is removed only when no product uses it; a category only when it has no parts left and no product uses it. (A product refers to its category and part by name.)
//   * optionally ("alsoProducts") the products that use the old catalog are deleted first, but NEVER a product that other records point at: an order, a quote request, anything else (order history keeps its products). A deleted
//     product's images, reviews and wishlist entries go with it; its lines in shoppers' carts are removed.
//   * NOTHING is assumed about which tables point at products, categories and parts: they are looked up in the database itself (every foreign key), and as a last safety net each deletion is tried on its own, so one the database
//     refuses keeps its item instead of failing the whole cleanup (this used to end in "Internal server error" when a quote request pointed at a product). The answer says what was REALLY removed.
//   * ONE function serves the preview and the real removal: the preview runs it inside a transaction and rolls it back, so it can never promise something the removal does differently.
const { blockers, tablesText } = require('./replace');

const STILL_USED = 'it is still used by something else (the database would not let it go)';

/** Runs a delete that RETURNs ids, with a savepoint: -1 when the database refuses because something still points at a row (nothing is changed then). */
async function attempt(client, sql, params) {
  await client.query('SAVEPOINT cleanup_step');
  try { const r = await client.query(sql, params); await client.query('RELEASE SAVEPOINT cleanup_step'); return r.rows; }
  catch (err) { await client.query('ROLLBACK TO SAVEPOINT cleanup_step'); if (err.code === '23503') return -1; throw err; }
}
/** Deletes by id: all at once, and if the database refuses, one by one. Returns the ids really deleted. */
async function deleteByIds(client, sql, ids) {
  if (ids.length === 0) return [];
  const all = await attempt(client, sql, [ids]); if (all !== -1) return all.map((r) => r.id);
  const done = []; for (const id of ids) { const one = await attempt(client, sql, [[id]]); if (one !== -1) done.push(...one.map((r) => r.id)); }
  return done;
}

async function runCleanup(client, { alsoProducts = false } = {}) {
  const removed = { products: [], parts: [], categories: [] };
  const kept = { products: [], categories: [] };

  const { rows: users } = await client.query(`
    SELECT pr.id, pr.name, pr.category, pr.part, EXISTS (SELECT 1 FROM order_line_items o WHERE o.product_id = pr.id) AS ordered
    FROM products pr
    WHERE pr.category IN (SELECT id FROM product_categories WHERE import_batch_id IS NULL AND code IS NULL)
       OR EXISTS (SELECT 1 FROM category_parts p WHERE p.import_batch_id IS NULL AND p.code IS NULL AND p.category_id = pr.category AND lower(btrim(p.name_en)) = lower(btrim(pr.part)))
    ORDER BY pr.id`);
  const describe = (u) => ({ id: u.id, name: u.name, category: u.category, part: u.part });
  const pointedAt = await blockers(client, 'products', users.map((u) => u.id), { ignore: ['cart_items'] });     // orders, quote requests, anything else that points at a product (a shopper's cart lines go with it)
  const holders = (u) => { const t = new Set(pointedAt.get(u.id) || []); if (u.ordered) t.add('order_line_items'); return t; };
  const heldReason = (u) => { const t = holders(u); return t.size === 1 && t.has('order_line_items') ? 'it has been in an order: order history keeps its products' : `it is used in ${tablesText(t)}: that history keeps its products`; };
  if (alsoProducts) {
    const deletable = users.filter((u) => holders(u).size === 0);
    const gone = new Set(await deleteByIds(client, 'WITH carts AS (DELETE FROM cart_items WHERE product_id = ANY($1)) DELETE FROM products pr WHERE pr.id = ANY($1) AND NOT EXISTS (SELECT 1 FROM order_line_items o WHERE o.product_id = pr.id) RETURNING pr.id', deletable.map((u) => u.id)));
    removed.products = deletable.filter((u) => gone.has(u.id)).map(describe);
    kept.products = [...users.filter((u) => holders(u).size > 0).map((u) => ({ ...describe(u), reason: heldReason(u) })), ...deletable.filter((u) => !gone.has(u.id)).map((u) => ({ ...describe(u), reason: STILL_USED }))];
  }

  const candParts = (await client.query(`
    SELECT p.id, p.name_en AS name, p.category_id AS category FROM category_parts p WHERE p.import_batch_id IS NULL AND p.code IS NULL
      AND NOT EXISTS (SELECT 1 FROM products pr WHERE pr.category = p.category_id AND lower(btrim(pr.part)) = lower(btrim(p.name_en)))`)).rows;
  const partHeld = await blockers(client, 'category_parts', candParts.map((p) => p.id));
  const partsGone = new Set(await deleteByIds(client, `DELETE FROM category_parts p WHERE p.id = ANY($1) AND p.import_batch_id IS NULL AND p.code IS NULL
      AND NOT EXISTS (SELECT 1 FROM products pr WHERE pr.category = p.category_id AND lower(btrim(pr.part)) = lower(btrim(p.name_en))) RETURNING p.id`, candParts.filter((p) => !partHeld.has(p.id)).map((p) => p.id)));
  removed.parts = candParts.filter((p) => partsGone.has(p.id));

  const candCats = (await client.query(`
    SELECT c.id, c.name_en AS name FROM product_categories c WHERE c.import_batch_id IS NULL AND c.code IS NULL
      AND NOT EXISTS (SELECT 1 FROM category_parts p WHERE p.category_id = c.id) AND NOT EXISTS (SELECT 1 FROM products pr WHERE pr.category = c.id)`)).rows;
  const catHeld = await blockers(client, 'product_categories', candCats.map((c) => c.id), { ignore: ['category_parts'] });
  const catsGone = new Set(await deleteByIds(client, `DELETE FROM product_categories c WHERE c.id = ANY($1) AND c.import_batch_id IS NULL AND c.code IS NULL
      AND NOT EXISTS (SELECT 1 FROM category_parts p WHERE p.category_id = c.id) AND NOT EXISTS (SELECT 1 FROM products pr WHERE pr.category = c.id) RETURNING c.id`, candCats.filter((c) => !catHeld.has(c.id)).map((c) => c.id)));
  removed.categories = candCats.filter((c) => catsGone.has(c.id));

  const heldParts = new Set((await client.query('SELECT category_id FROM category_parts WHERE id = ANY($1)', [[...partHeld.keys()]])).rows.map((r) => r.category_id));
  kept.categories = (await client.query(`
    SELECT c.id, c.name_en AS name, (SELECT count(*) FROM products pr WHERE pr.category = c.id)::int AS products, (SELECT count(*) FROM category_parts p WHERE p.category_id = c.id)::int AS parts
    FROM product_categories c WHERE c.${'import_batch_id IS NULL AND c.code IS NULL'} ORDER BY c.sort_order, c.name_en`)).rows
    .map((c) => ({ ...c, reason: c.products > 0 ? `${c.products} product(s) still use it` : c.parts > 0 ? (heldParts.has(c.id) ? `${c.parts} part(s) that other records use stay in it` : `${c.parts} part(s) that products use stay in it`) : catHeld.has(c.id) ? `it is used in ${tablesText(catHeld.get(c.id))}` : STILL_USED }));
  const { rows: [imports] } = await client.query('SELECT count(*)::int AS n FROM catalog_import_batches WHERE undone_at IS NULL');
  return {
    removed, kept, hasImports: imports.n > 0,
    counts: { categories: removed.categories.length, parts: removed.parts.length, products: removed.products.length, categoriesKept: kept.categories.length, productsKept: kept.products.length },
  };
}

module.exports = { runCleanup };
