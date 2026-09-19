const db = require('../../../db/pool');

// Confirmed with the person: a buyer's real lifetime spend is the
// sum of every real order's own real total (already stored in USD
// regardless of the currency they saw displayed at checkout --
// confirmed directly against the real data before relying on this,
// not assumed), excluding a real cancelled order entirely. A guest
// order (no buyer_id) never counts toward any real registered
// buyer's own real lifetime spend -- there's no real account to
// attribute it to.
async function getLifetimeSpend(buyerId) {
  if (!buyerId) return 0;
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(total), 0) AS lifetime_spend FROM orders WHERE buyer_id = $1 AND status != 'cancelled'`,
    [buyerId]
  );
  return Number(rows[0].lifetime_spend);
}

function toTierDto(row) {
  if (!row) return null;
  return {
    id: row.id, name: row.name, nameAr: row.name_ar,
    spendThreshold: Number(row.spend_threshold), discountPercentage: Number(row.discount_percentage),
    icon: row.icon, color: row.color,
  };
}

// Confirmed with the person: the real current tier is the highest
// real tier whose spend_threshold the buyer's own real lifetime
// spend has actually reached -- every real buyer, even one who has
// never ordered, has a real current tier (the $0 Bronze tier), since
// spend_threshold = 0 is always <= any real lifetime spend.
async function getLoyaltyStatus(buyerId) {
  const lifetimeSpend = await getLifetimeSpend(buyerId);
  const { rows: tiers } = await db.query('SELECT * FROM loyalty_tiers ORDER BY spend_threshold ASC');
  let currentTier = null;
  let nextTier = null;
  for (const tier of tiers) {
    if (Number(tier.spend_threshold) <= lifetimeSpend) {
      currentTier = tier;
    } else if (!nextTier) {
      nextTier = tier;
    }
  }
  const amountToNextTier = nextTier ? Number(nextTier.spend_threshold) - lifetimeSpend : null;
  // Confirmed with the person: progress toward the next real tier is
  // measured from the current real tier's own threshold, not from
  // real $0 -- a buyer who just reached Gold ($1,500) shouldn't see
  // "0% progress" toward Diamond ($5,000) reset from zero; they've
  // already covered the real distance up to Gold's own threshold.
  let progressPercent = 100;
  if (nextTier && currentTier) {
    const span = Number(nextTier.spend_threshold) - Number(currentTier.spend_threshold);
    progressPercent = span > 0 ? Math.min(100, Math.round(((lifetimeSpend - Number(currentTier.spend_threshold)) / span) * 100)) : 100;
  }
  return {
    lifetimeSpend,
    currentTier: toTierDto(currentTier),
    nextTier: toTierDto(nextTier),
    amountToNextTier: amountToNextTier === null ? null : Number(amountToNextTier.toFixed(2)),
    progressPercent,
    allTiers: tiers.map(toTierDto),
  };
}

// Confirmed with the person: used directly by checkout -- a guest
// (no real buyer_id) always gets 0%, since lifetime spend has no
// real account to attribute to; matches getLifetimeSpend's own real
// handling of this exact case.
async function getLoyaltyDiscountPercentage(buyerId) {
  if (!buyerId) return 0;
  const status = await getLoyaltyStatus(buyerId);
  return status.currentTier ? status.currentTier.discountPercentage : 0;
}

module.exports = { getLifetimeSpend, getLoyaltyStatus, getLoyaltyDiscountPercentage };
