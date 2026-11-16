const db = require('../../../db/pool');

// Confirmed with the person through several rounds of design before
// building the original version of this in catalog/routes.js: the
// admin-controlled bulk discount-rules engine (migration 074).
// Extracted here so the cart endpoint (which needs the exact same
// real matching logic to show a real per-item discount) reuses this
// one, real, shared query instead of a second, separately-maintained
// copy that could silently drift out of sync with this one over time.
//
// A product's real discount comes from matching ANY of its own real
// fitment entries (not just its primary one) against a rule's real
// brand (required) + optional model + optional year range. If more
// than one of a product's own real, different fitments happens to
// match a different rule, the highest real discount_percentage wins
// -- a sensible, deterministic default for that edge case.
async function findMatchingDiscountRule(productId) {
  const { rows } = await db.query(
    `SELECT MAX(dr.discount_percentage) AS discount_percentage
     FROM product_fitment_entries pfe
     JOIN vehicle_generations vg ON vg.id = pfe.generation_id
     JOIN vehicle_models vm ON vm.id = vg.model_id
     JOIN discount_rules dr ON dr.brand_id = vm.brand_id
       AND (dr.model_id IS NULL OR dr.model_id = vm.id)
       AND (dr.year_from IS NULL OR pfe.year >= dr.year_from)
       AND (dr.year_to IS NULL OR pfe.year <= dr.year_to)
     WHERE pfe.product_id = $1`,
    [productId]
  );
  return rows[0]?.discount_percentage === null ? null : Number(rows[0].discount_percentage);
}

module.exports = { findMatchingDiscountRule };
