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
//
// Time window (migration 133, confirmed with the person via mockup): a rule only counts from its starts_at (none = straight away)
// until its ends_at (none = no end). Outside that window it gives no discount anywhere: product page, cards, basket, checkout.
// When two rules match, the higher discount wins; on a tie, the one that ends first (its countdown is the one shown).
async function findActiveDiscount(productId) {
  const { rows } = await db.query(
    `SELECT dr.discount_percentage, dr.ends_at, dr.countdown
     FROM product_fitment_entries pfe
     JOIN vehicle_generations vg ON vg.id = pfe.generation_id
     JOIN vehicle_models vm ON vm.id = vg.model_id
     JOIN discount_rules dr ON dr.brand_id = vm.brand_id
       AND (dr.model_id IS NULL OR dr.model_id = vm.id)
       AND (dr.year_from IS NULL OR pfe.year >= dr.year_from)
       AND (dr.year_to IS NULL OR pfe.year <= dr.year_to)
       AND (dr.starts_at IS NULL OR dr.starts_at <= now())
       AND (dr.ends_at IS NULL OR dr.ends_at > now())
     WHERE pfe.product_id = $1
     ORDER BY dr.discount_percentage DESC, dr.ends_at ASC NULLS LAST
     LIMIT 1`,
    [productId]
  );
  if (rows.length === 0) return null;
  return { percentage: Number(rows[0].discount_percentage), endsAt: rows[0].ends_at ? new Date(rows[0].ends_at) : null, countdown: rows[0].countdown || 'last3' };
}

// When the product page shows the countdown: 'always' -> whenever the rule has an end; 'last3' -> only in its last 3 days; 'never' -> not at all.
const COUNTDOWN_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
function countdownEndsAt(active) {
  if (!active || !active.endsAt || active.countdown === 'never') return null;
  if (active.countdown === 'last3' && active.endsAt.getTime() - Date.now() > COUNTDOWN_WINDOW_MS) return null;
  return active.endsAt.toISOString();
}

// The discount percentage alone (the basket and checkout use this), or null.
async function findMatchingDiscountRule(productId) {
  const active = await findActiveDiscount(productId);
  return active ? active.percentage : null;
}

module.exports = { findMatchingDiscountRule, findActiveDiscount, countdownEndsAt };
