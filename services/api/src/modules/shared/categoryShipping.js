/**
 * The weight and package size the shipping cost uses for a product.
 *
 *   - a product with its OWN complete set (weight, length, width, height all present) uses it: nothing that already has one changes;
 *   - otherwise it uses its CATEGORY's set (the admin sets one per category, migration 103);
 *   - otherwise there is none, and the shipping fee cannot be worked out (the pricing engine reports it, as it always did).
 *
 * Works on a product row as it comes from the database (snake_case: weight_kg, length_cm, width_cm, height_cm, category) and returns a COPY whose four columns
 * are the effective ones, plus `shipping_source` ('product' | 'category' | null). Every place that prices a product or shows its weight goes through here, so
 * they can never disagree.
 */
const db = require('../../../db/pool');

const COLUMNS = ['weight_kg', 'length_cm', 'width_cm', 'height_cm'];
const present = (v) => v !== null && v !== undefined;

// The categories that have a complete set, by id. A tiny table, so one small query is cheaper than any cache that could go stale.
async function loadCategoryShippingMap(client = db) {
  const { rows } = await client.query(
    `SELECT id, weight_kg, length_cm, width_cm, height_cm FROM product_categories
     WHERE weight_kg IS NOT NULL AND length_cm IS NOT NULL AND width_cm IS NOT NULL AND height_cm IS NOT NULL`
  );
  return new Map(rows.map((r) => [r.id, { weight_kg: r.weight_kg, length_cm: r.length_cm, width_cm: r.width_cm, height_cm: r.height_cm }]));
}

const hasOwnShipping = (row) => COLUMNS.every((c) => present(row[c]));

// Pure: `map` comes from loadCategoryShippingMap.
function effectiveShipping(row, map) {
  if (hasOwnShipping(row)) return { ...row, shipping_source: 'product' };
  const fromCategory = row.category ? map.get(row.category) : null;
  if (fromCategory) return { ...row, ...fromCategory, shipping_source: 'category' };
  return { ...row, shipping_source: null };
}

async function withEffectiveShipping(row, client = db) {
  if (!row) return row;
  if (hasOwnShipping(row)) return { ...row, shipping_source: 'product' };          // no lookup needed
  return effectiveShipping(row, await loadCategoryShippingMap(client));
}

async function withEffectiveShippingRows(rows, client = db) {
  if (rows.every(hasOwnShipping)) return rows.map((r) => ({ ...r, shipping_source: 'product' }));
  const map = await loadCategoryShippingMap(client);
  return rows.map((r) => effectiveShipping(r, map));
}

// The category's own set (for validating a new product): null when the category has none.
async function getCategoryShipping(categoryId, client = db) {
  if (!categoryId) return null;
  const map = await loadCategoryShippingMap(client);
  return map.get(categoryId) || null;
}

module.exports = { loadCategoryShippingMap, effectiveShipping, withEffectiveShipping, withEffectiveShippingRows, getCategoryShipping, hasOwnShipping };
