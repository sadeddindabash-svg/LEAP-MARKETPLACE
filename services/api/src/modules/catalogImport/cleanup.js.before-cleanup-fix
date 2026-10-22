// "Start clean": removes the OLD catalog (the categories and parts made by hand before the parts catalog was imported), so the imported catalog stands alone.
//   * "old" = a category or part that no import created (no import batch) and that has no catalog code. Anything the import created, or filled with a catalog code, is never touched.
//   * a part is removed only when no product uses it; a category only when it has no parts left and no product uses it. (A product refers to its category and part by name.)
//   * optionally ("alsoProducts") the products that use the old catalog are deleted first, but NEVER a product that has been in an order (order history keeps its products). A deleted
//     product's images, reviews and wishlist entries go with it; its lines in shoppers' carts are removed.
//   * ONE function serves the preview and the real removal: the preview runs it inside a transaction and rolls it back, so it can never promise something the removal does differently.
const OLD_CATEGORY = 'import_batch_id IS NULL AND code IS NULL';

async function runCleanup(client, { alsoProducts = false } = {}) {
  const removed = { products: [], parts: [], categories: [] };
  const kept = { products: [], categories: [] };

  const { rows: users } = await client.query(`
    SELECT pr.id, pr.name, pr.category, pr.part, EXISTS (SELECT 1 FROM order_line_items o WHERE o.product_id = pr.id) AS ordered
    FROM products pr
    WHERE pr.category IN (SELECT id FROM product_categories WHERE ${OLD_CATEGORY})
       OR EXISTS (SELECT 1 FROM category_parts p WHERE p.import_batch_id IS NULL AND p.code IS NULL AND p.category_id = pr.category AND lower(btrim(p.name_en)) = lower(btrim(pr.part)))
    ORDER BY pr.id`);
  const describe = (u) => ({ id: u.id, name: u.name, category: u.category, part: u.part });
  if (alsoProducts) {
    const deletable = users.filter((u) => !u.ordered);
    if (deletable.length) {
      const ids = deletable.map((u) => u.id);
      await client.query('DELETE FROM cart_items WHERE product_id = ANY($1)', [ids]);
      await client.query('DELETE FROM products WHERE id = ANY($1)', [ids]);
      removed.products = deletable.map(describe);
    }
    kept.products = users.filter((u) => u.ordered).map((u) => ({ ...describe(u), reason: 'it has been in an order: order history keeps its products' }));
  }

  removed.parts = (await client.query(`
    DELETE FROM category_parts p WHERE p.import_batch_id IS NULL AND p.code IS NULL
      AND NOT EXISTS (SELECT 1 FROM products pr WHERE pr.category = p.category_id AND lower(btrim(pr.part)) = lower(btrim(p.name_en)))
    RETURNING p.id, p.name_en AS name, p.category_id AS category`)).rows;
  removed.categories = (await client.query(`
    DELETE FROM product_categories c WHERE c.import_batch_id IS NULL AND c.code IS NULL
      AND NOT EXISTS (SELECT 1 FROM category_parts p WHERE p.category_id = c.id) AND NOT EXISTS (SELECT 1 FROM products pr WHERE pr.category = c.id)
    RETURNING c.id, c.name_en AS name`)).rows;

  kept.categories = (await client.query(`
    SELECT c.id, c.name_en AS name, (SELECT count(*) FROM products pr WHERE pr.category = c.id)::int AS products, (SELECT count(*) FROM category_parts p WHERE p.category_id = c.id)::int AS parts
    FROM product_categories c WHERE c.${OLD_CATEGORY.replace(' AND ', ' AND c.')} ORDER BY c.sort_order, c.name_en`)).rows
    .map((c) => ({ ...c, reason: c.products > 0 ? `${c.products} product(s) still use it` : `${c.parts} part(s) that products use stay in it` }));
  const { rows: [imports] } = await client.query('SELECT count(*)::int AS n FROM catalog_import_batches WHERE undone_at IS NULL');
  return {
    removed, kept, hasImports: imports.n > 0,
    counts: { categories: removed.categories.length, parts: removed.parts.length, products: removed.products.length, categoriesKept: kept.categories.length, productsKept: kept.products.length },
  };
}

module.exports = { runCleanup };
