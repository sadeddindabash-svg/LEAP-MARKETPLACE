const db = require('../../../db/pool');
const { createNotification } = require('../notifications/helpers');

/**
 * The general promotions engine (migration 020). CONFIRMED SCOPE: what
 * started as "referral rewards" was deliberately expanded into a real,
 * general coupon system once it became clear the actual need was
 * broader — admin-configurable codes for events/campaigns, with
 * referral rewards as just one real source of codes within the same
 * system, not a narrower thing bolted on separately.
 *
 * CONFIRMED: the referral trigger is the referred person's FIRST real
 * order, not mere signup — a real deterrent against trivial fake-
 * account abuse. A referrer can earn at most 10 real rewards
 * (MAX_REFERRAL_REWARDS below). One code per order — no stacking.
 */
const MAX_REFERRAL_REWARDS_PER_REFERRER = 10;
const REFERRAL_REWARD_TYPE = 'percentage';
const REFERRAL_REWARD_VALUE = 10; // 10% off, per the confirmed decision

async function getOrCreateReferralCode(buyerId) {
  const { rows: existing } = await db.query('SELECT code FROM referral_codes WHERE buyer_id = $1', [buyerId]);
  if (existing.length > 0) return existing[0].code;

  // Real, short, shareable code -- not a UUID a real person would need
  // to carefully copy-paste without a typo.
  const code = `REF-${buyerId.replace(/\D/g, '').slice(-6) || Date.now().toString().slice(-6)}`;
  await db.query('INSERT INTO referral_codes (code, buyer_id) VALUES ($1, $2) ON CONFLICT (buyer_id) DO NOTHING', [code, buyerId]);
  const { rows } = await db.query('SELECT code FROM referral_codes WHERE buyer_id = $1', [buyerId]);
  return rows[0].code;
}

// Called at real signup time, when a referralCode was provided. Silent,
// honest no-ops (not errors) for: an invalid code (typo'd or made up),
// a self-referral attempt, or the new user somehow already having a
// referrals row — none of these should block a real signup from
// completing over a referral-code problem.
async function recordReferral(referralCode, referredUserId) {
  if (!referralCode) return;
  const { rows: codeRows } = await db.query('SELECT buyer_id FROM referral_codes WHERE code = $1', [referralCode]);
  if (codeRows.length === 0) return; // invalid/made-up code -- silent no-op, not a signup error
  const referrerId = codeRows[0].buyer_id;
  if (referrerId === referredUserId) return; // a real self-referral attempt -- silently ignored

  await db.query(
    'INSERT INTO referrals (referrer_id, referred_user_id, referral_code) VALUES ($1, $2, $3) ON CONFLICT (referred_user_id) DO NOTHING',
    [referrerId, referredUserId, referralCode]
  );
}

// Called after a real order is placed. Checks whether this is the
// buyer's genuine FIRST real order AND they were referred AND the
// reward hasn't already been granted AND the referrer hasn't hit the
// real cap -- only then generates a real reward code for the referrer.
async function checkAndGrantReferralReward(buyerId, client = db) {
  if (!buyerId) return; // a guest order has no real referral relationship to check

  const { rows: orderCountRows } = await client.query('SELECT COUNT(*) AS count FROM orders WHERE buyer_id = $1', [buyerId]);
  if (Number(orderCountRows[0].count) !== 1) return; // not genuinely their first real order

  const { rows: referralRows } = await client.query(
    'SELECT * FROM referrals WHERE referred_user_id = $1 AND reward_granted = false',
    [buyerId]
  );
  if (referralRows.length === 0) return; // never referred, or reward already granted
  const referral = referralRows[0];

  const { rows: grantedCountRows } = await client.query(
    'SELECT COUNT(*) AS count FROM referrals WHERE referrer_id = $1 AND reward_granted = true',
    [referral.referrer_id]
  );
  if (Number(grantedCountRows[0].count) >= MAX_REFERRAL_REWARDS_PER_REFERRER) return; // real cap reached

  const rewardCode = `REFREWARD-${Date.now()}`;
  await client.query(
    `INSERT INTO promo_codes (code, type, value, source, max_total_uses, max_uses_per_buyer)
     VALUES ($1, $2, $3, 'referral', 1, 1)`,
    [rewardCode, REFERRAL_REWARD_TYPE, REFERRAL_REWARD_VALUE]
  );
  await client.query('UPDATE referrals SET reward_granted = true WHERE id = $1', [referral.id]);

  await createNotification({
    userId: referral.referrer_id,
    type: 'referral_reward',
    title: 'You earned a referral reward!',
    body: `Someone you referred placed their first order. Use code ${rewardCode} for ${REFERRAL_REWARD_VALUE}% off your next order.`,
    linkType: 'promo_code',
    linkId: rewardCode,
  }, client);
}

// Real, server-side validation -- never trust a client-side check
// alone. Returns { valid: true, promoCode } or { valid: false, reason }.
async function validatePromoCode(code, buyerId) {
  const { rows } = await db.query('SELECT * FROM promo_codes WHERE code = $1', [code]);
  if (rows.length === 0) return { valid: false, reason: 'This code does not exist.' };
  const promo = rows[0];

  if (!promo.is_active) return { valid: false, reason: 'This code is no longer active.' };
  // Real, scheduled (future-start) promo codes (migration 041) -- a
  // real code created today for a planned upcoming promotion isn't
  // usable until its own real starts_at arrives.
  if (promo.starts_at && new Date(promo.starts_at) > new Date()) return { valid: false, reason: 'This code is not active yet.' };
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) return { valid: false, reason: 'This code has expired.' };

  if (promo.max_total_uses != null) {
    const { rows: totalRows } = await db.query('SELECT COUNT(*) AS count FROM promo_code_redemptions WHERE promo_code = $1', [code]);
    if (Number(totalRows[0].count) >= promo.max_total_uses) return { valid: false, reason: 'This code has reached its usage limit.' };
  }

  if (buyerId) {
    const { rows: buyerRows } = await db.query(
      'SELECT COUNT(*) AS count FROM promo_code_redemptions WHERE promo_code = $1 AND buyer_id = $2',
      [code, buyerId]
    );
    if (Number(buyerRows[0].count) >= promo.max_uses_per_buyer) return { valid: false, reason: 'You have already used this code the maximum number of times.' };
  }

  // Real audience targeting (migration 021) -- combinable, AND logic:
  // every condition set on this code must genuinely hold for this
  // buyer. A code with any real targeting set requires a real
  // logged-in buyer to check against -- a guest has no real order
  // history to evaluate.
  const hasTargeting = promo.require_new_user || promo.min_total_spend != null || promo.min_order_count != null || promo.min_inactive_days != null;
  if (hasTargeting) {
    if (!buyerId) return { valid: false, reason: 'Please log in to use this code.' };

    const { rows: statsRows } = await db.query(
      `SELECT COUNT(*) AS order_count, COALESCE(SUM(total), 0) AS total_spend, MAX(placed_at) AS last_order_at
       FROM orders WHERE buyer_id = $1`,
      [buyerId]
    );
    const stats = statsRows[0];
    const orderCount = Number(stats.order_count);
    const totalSpend = Number(stats.total_spend);

    if (promo.require_new_user && orderCount > 0) {
      return { valid: false, reason: 'This code is only for new customers.' };
    }
    if (promo.min_total_spend != null && totalSpend < Number(promo.min_total_spend)) {
      return { valid: false, reason: 'This code is only for customers who have spent more with us.' };
    }
    if (promo.min_order_count != null && orderCount < promo.min_order_count) {
      return { valid: false, reason: 'This code is only for customers with more orders.' };
    }
    if (promo.min_inactive_days != null) {
      if (!stats.last_order_at) {
        return { valid: false, reason: 'This code is only for returning customers.' };
      }
      const daysSinceLastOrder = (Date.now() - new Date(stats.last_order_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastOrder < promo.min_inactive_days) {
        return { valid: false, reason: 'This code is only for customers who haven\'t ordered in a while.' };
      }
    }
  }

  return { valid: true, promoCode: promo };
}

// Real discount calculation. `shippingPortionUsd` is the real, already-
// computed shipping-fee portion of the order (summed from the pricing
// engine's own breakdown — see order/routes.js) -- free_shipping
// refunds exactly that real amount rather than an estimated or
// hardcoded one.
function calculateDiscountUsd(promoCode, orderTotalUsd, shippingPortionUsd) {
  if (promoCode.type === 'percentage') {
    return Number((orderTotalUsd * (Number(promoCode.value) / 100)).toFixed(2));
  }
  if (promoCode.type === 'flat') {
    return Math.min(Number(promoCode.value), orderTotalUsd); // never discount below $0
  }
  if (promoCode.type === 'free_shipping') {
    return Number(shippingPortionUsd.toFixed(2));
  }
  return 0;
}

async function recordRedemption(code, buyerId, orderId, client = db) {
  await client.query(
    'INSERT INTO promo_code_redemptions (promo_code, buyer_id, order_id) VALUES ($1, $2, $3)',
    [code, buyerId, orderId]
  );
}

module.exports = {
  getOrCreateReferralCode,
  recordReferral,
  checkAndGrantReferralReward,
  validatePromoCode,
  calculateDiscountUsd,
  recordRedemption,
  MAX_REFERRAL_REWARDS_PER_REFERRER,
};
