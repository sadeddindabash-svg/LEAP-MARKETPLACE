/**
 * The weight and package size the shipping cost uses for a product.
 *
 *   - a product with its OWN complete set (weight, length, width, height all present) uses it: nothing that already has one changes;
 *   - otherwise it uses its PART's set (the admin sets one per part, the sub-category such as "Front Brake Disc"; migration 104);
 *   - otherwise there is none, and the shipping fee cannot be worked out (the pricing engine reports it, as it always did).
 *
 * A product refers to its part by NAME: products.category + products.part (plain text), and a category cannot have two parts with the same name (migration 101),
 * so the part is found by (category, name) ignoring capitals and extra spaces.
 *
 * Works on a product row as it comes from the database (snake_case: weight_kg, length_cm, width_cm, height_cm, category, part) and returns a COPY whose four
 * columns are the effective ones, plus `shipping_source` ('product' | 'part' | null). Every place that prices a product or shows its weight goes through here,
 * so they can never disagree.
 */
const db = require('../../../db/pool');

const COLUMNS = ['weight_kg', 'length_cm', 'width_cm', 'height_cm'];
const present = (v) => v !== null && v !== undefined;
const partKey = (category, part) => `${category}|${String(part).trim().toLowerCase()}`;

// The parts that have a complete set, by (category, name). One small query is cheaper than any cache that could go stale.
async function loadPartShippingMap(client = db) {
  const { rows } = await client.query(
    `SELECT category_id, name_en, weight_kg, length_cm, width_cm, height_cm FROM category_parts
     WHERE weight_kg IS NOT NULL AND length_cm IS NOT NULL AND width_cm IS NOT NULL AND height_cm IS NOT NULL`
  );
  return new Map(rows.map((r) => [partKey(r.category_id, r.name_en), { weight_kg: r.weight_kg, length_cm: r.length_cm, width_cm: r.width_cm, height_cm: r.height_cm }]));
}

const hasOwnShipping = (row) => COLUMNS.every((c) => present(row[c]));

// Pure: `map` comes from loadPartShippingMap.
function effectiveShipping(row, map) {
  if (hasOwnShipping(row)) return { ...row, shipping_source: 'product' };
  const fromPart = row.category && row.part ? map.get(partKey(row.category, row.part)) : null;
  if (fromPart) return { ...row, ...fromPart, shipping_source: 'part' };
  return { ...row, shipping_source: null };
}

async function withEffectiveShipping(row, client = db) {
  if (!row) return row;
  if (hasOwnShipping(row)) return { ...row, shipping_source: 'product' };          // no lookup needed
  return effectiveShipping(row, await loadPartShippingMap(client));
}

async function withEffectiveShippingRows(rows, client = db) {
  if (rows.every(hasOwnShipping)) return rows.map((r) => ({ ...r, shipping_source: 'product' }));
  const map = await loadPartShippingMap(client);
  return rows.map((r) => effectiveShipping(r, map));
}

// The part's own set (for validating a new product): null when the part has none, or is not known.
async function getPartShipping(categoryId, partName, client = db) {
  if (!categoryId || !partName) return null;
  const map = await loadPartShippingMap(client);
  return map.get(partKey(categoryId, partName)) || null;
}

module.exports = { loadPartShippingMap, effectiveShipping, withEffectiveShipping, withEffectiveShippingRows, getPartShipping, hasOwnShipping, partKey };
