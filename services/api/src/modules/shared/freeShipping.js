// Free shipping above a limit (set by the admin). Prices on the site already include the part's own freight from the supplier; THIS is the extra delivery fee on a SMALL order:
// when the goods of an order (after any discount) come to less than the limit, the buyer pays the shipping fee on top; at or above the limit shipping is free.
// Stored as one JSON value in the generic platform_settings store: { "enabled": boolean, "thresholdUsd": number, "feeUsd": number } (all amounts in US dollars).
// "enabled: false" (the default, and when nothing is stored) means no shipping fee is ever charged: the shop works exactly as it did before.
const db = require('../../../db/pool');

const SETTING_KEY = 'free_shipping';
const LIMITS = { maxThresholdUsd: 100000, maxFeeUsd: 10000 };
const round2 = (n) => Number(Number(n).toFixed(2));
const amount = (v, max) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= max ? round2(n) : 0; };

/** What is stored, as { enabled, thresholdUsd, feeUsd }; anything missing or damaged means "off" (never an error). */
function parseStored(raw) {
  let stored = {};
  try { const v = JSON.parse(raw); if (v && typeof v === 'object' && !Array.isArray(v)) stored = v; } catch { /* nothing stored */ }
  return { enabled: stored.enabled === true, thresholdUsd: amount(stored.thresholdUsd, LIMITS.maxThresholdUsd), feeUsd: amount(stored.feeUsd, LIMITS.maxFeeUsd) };
}

/** The settings from the database (`q` is the pool, or the client of a transaction). */
async function readFreeShipping(q = db) {
  const { rows } = await q.query('SELECT value FROM platform_settings WHERE key = $1', [SETTING_KEY]);
  return parseStored(rows[0] ? rows[0].value : '{}');
}

/**
 * The shipping fee of a basket or an order. `itemsUsd` is the price of the goods, `discountUsd` the discount on them (a promo code or the loyalty discount); the limit is measured on the goods AFTER the discount.
 *   enabled        the rule is on (a limit and a fee are set and the switch is on); when false nothing below matters and no fee is charged
 *   chargedUsd     the fee to pay now: the fee when the goods are under the limit, otherwise 0 (also 0 for an empty basket and when a free-shipping promo code is applied)
 *   remainingUsd   how much more goods the buyer needs for free shipping (0 once the limit is reached)
 *   qualifies      the goods have reached the limit
 *   waivedByPromo  a free-shipping promo code is applied, so no fee is charged whatever the basket comes to
 */
function computeShipping({ settings, itemsUsd, discountUsd = 0, freeShippingPromo = false, hasItems = true }) {
  const goodsUsd = round2(Math.max(0, Number(itemsUsd) - Number(discountUsd || 0)));
  const enabled = Boolean(settings && settings.enabled && settings.thresholdUsd > 0 && settings.feeUsd > 0);
  if (!enabled) return { enabled: false, thresholdUsd: settings ? settings.thresholdUsd : 0, feeUsd: settings ? settings.feeUsd : 0, chargedUsd: 0, remainingUsd: 0, qualifies: true, waivedByPromo: false };
  const qualifies = goodsUsd >= settings.thresholdUsd;
  const waivedByPromo = Boolean(freeShippingPromo);
  return { enabled: true, thresholdUsd: settings.thresholdUsd, feeUsd: settings.feeUsd, chargedUsd: hasItems && !qualifies && !waivedByPromo ? settings.feeUsd : 0, remainingUsd: qualifies ? 0 : round2(settings.thresholdUsd - goodsUsd), qualifies, waivedByPromo };
}

module.exports = { SETTING_KEY, LIMITS, parseStored, readFreeShipping, computeShipping, round2 };
