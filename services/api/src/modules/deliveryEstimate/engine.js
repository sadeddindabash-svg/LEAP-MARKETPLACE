const geoip = require('geoip-lite');
const db = require('../../../db/pool');
const { isoCodeForName } = require('../shared/countries');
const { getDeliverySettings, calendarDaysFor } = require('./settings');      // Delivery Rules > How it works

/**
 * Real, rule-based delivery-day estimate engine, confirmed with the
 * person through several rounds of design discussion before building
 * -- replaces the previous manual, supplier-typed number entirely.
 *
 * Two real steps: (1) figure out the buyer's own likely destination
 * country, (2) match the product's own real weight/volume/warehouse
 * against the admin's own configured rules to get a real number of
 * days.
 */

// Real, deliberate fallback -- confirmed used only when neither a
// real logged-in buyer's own default address nor real IP-based
// geolocation can resolve anything (a genuinely private/local IP in
// development, a real lookup miss, etc). Jordan, since every real
// warehouse and test account already established this session is
// based there.
const FALLBACK_ISO_CODE = 'JO';
const FALLBACK_DELIVERY_DAYS = 7;

// Real, confirmed with the person: a not-logged-in buyer's country is
// detected silently via their own real IP address (geoip-lite, a
// real offline database bundled directly in this dependency -- no
// external API call, no permission prompt, no per-request latency),
// rather than real device GPS, which would require an intrusive real
// permission prompt just to show an estimate before the buyer has
// shown any real intent to buy.
async function resolveDestinationIsoCode(req) {
  if (req.user?.sub) {
    try {
      const { rows } = await db.query(
        `SELECT country FROM buyer_addresses WHERE buyer_id = $1 AND is_default = true LIMIT 1`,
        [req.user.sub]
      );
      if (rows.length > 0) {
        const isoCode = isoCodeForName(rows[0].country);
        if (isoCode) return isoCode;
      }
    } catch (err) {
      console.error('[deliveryEstimate] Failed to look up a real buyer\'s own default address (non-fatal):', err.message);
    }
  }

  try {
    const geo = geoip.lookup(req.ip);
    if (geo?.country) return geo.country;
  } catch (err) {
    console.error('[deliveryEstimate] Real IP geolocation lookup failed (non-fatal):', err.message);
  }

  return (await getDeliverySettings()).fallbackCountryIso || FALLBACK_ISO_CODE;      // set in Delivery Rules > How it works > step 1
}

// Real, confirmed matching logic: every criterion is a real wildcard
// (matches anything) when null on the rule itself, and the FIRST
// matching rule (by sort_order) wins -- confirmed via a rendered
// mockup showing drag-to-reorder rows, so a real, deliberate fallback
// rule (every criterion null) can always be placed last.
// The first rule that fits, with its place in the list: { days, index } or null when none fits.
async function matchRule({ weightKg, lengthCm, widthCm, heightCm, warehouseCountry, destinationIsoCode }) {
  const volumeCm3 = weightKg != null && lengthCm != null && widthCm != null && heightCm != null
    ? lengthCm * widthCm * heightCm
    : null;

  try {
    const { rows } = await db.query(
      `SELECT COALESCE(cp.delivery_days, dr.delivery_days) AS delivery_days, (SELECT count(*)::int FROM delivery_rules x WHERE x.sort_order < dr.sort_order) AS idx,
              dr.id AS rule_id, dr.price_cny_per_kg, cp.price_cny_per_kg AS country_price_cny_per_kg, (cp.rule_id IS NOT NULL) AS has_country
       FROM delivery_rules dr
       LEFT JOIN delivery_rule_country_prices cp ON cp.rule_id = dr.id AND cp.iso_code = $4
       WHERE (dr.min_weight_kg IS NULL OR ($1::numeric IS NOT NULL AND $1 >= dr.min_weight_kg))
         AND (dr.max_weight_kg IS NULL OR ($1::numeric IS NOT NULL AND $1 <= dr.max_weight_kg))
         AND (dr.min_volume_cm3 IS NULL OR ($2::numeric IS NOT NULL AND $2 >= dr.min_volume_cm3))
         AND (dr.max_volume_cm3 IS NULL OR ($2::numeric IS NOT NULL AND $2 <= dr.max_volume_cm3))
         AND (dr.warehouse_country IS NULL OR dr.warehouse_country = $3)
         AND (
           dr.destination_group_id IS NULL
           OR EXISTS (
             SELECT 1 FROM country_group_members cgm
             WHERE cgm.group_id = dr.destination_group_id AND cgm.iso_code = $4
           )
         )
       ORDER BY dr.sort_order ASC
       LIMIT 1`,
      [weightKg, volumeCm3, warehouseCountry, destinationIsoCode]
    );
    // the buyer's country with its own price and days uses those (patch-delivery-prices)
    if (rows.length > 0) {
      const r = rows[0];
      const num = (v) => (v === null || v === undefined ? null : Number(v));
      return { days: r.delivery_days, index: r.idx, ruleId: r.rule_id, priceCnyPerKg: num(r.price_cny_per_kg), countryPriceCnyPerKg: num(r.country_price_cny_per_kg), countryRule: Boolean(r.has_country) };
    }
  } catch (err) {
    console.error('[deliveryEstimate] Real rule matching failed (non-fatal, falling back):', err.message);
  }

  return null;
}

// What the buyer is shown (Delivery Rules > How it works): the rule's days (or, when none fits, the fallback days, or nothing), plus preparing
// and inspection, counted on the calendar without the days that are not counted. { days, range, hidden, matched, ruleDays, ruleIndex }.
// `settings` may be passed to try unsaved settings (the admin's "Try it").
async function estimateDelivery(args, settings) {
  const s = settings || (await getDeliverySettings());
  const hit = await matchRule(args);
  if (!hit && s.noRuleAction === 'hide') return { days: null, range: null, hidden: true, matched: false, ruleDays: null, ruleIndex: -1 };
  const ruleDays = hit ? hit.days : (s.fallbackDays || FALLBACK_DELIVERY_DAYS);
  return { days: calendarDaysFor(ruleDays, s), range: s.showMode === 'range' ? s.rangeDays : null, hidden: false, matched: Boolean(hit), ruleDays, ruleIndex: hit ? hit.index : -1 };
}

// The shipping inside a product's price (Delivery Rules > How it works, step 5; patch-delivery-prices): the rule that fits (the same one as for the date),
// its price for the buyer's country if it has one, else its default price; when no rule fits (or the rule has no price), the general price. Times the
// chargeable weight (the greater of the weight and L x W x H / divisor), at least the minimum per item. Prices are RMB per kg.
// { ok, amountCny, rateCnyPerKg, chargeableKg, matched, ruleIndex, countryPrice, minimumApplied } or { ok: false, reason: 'missing_size' | 'no_price' }
async function shippingQuote(args, settings) {
  const s = settings || (await getDeliverySettings());
  const { weightKg, lengthCm, widthCm, heightCm } = args;
  if (weightKg == null || lengthCm == null || widthCm == null || heightCm == null) return { ok: false, reason: 'missing_size' };
  const divisor = Number(s.volumetricDivisor) || 5000;
  const chargeableKg = Math.max(Number(weightKg), (Number(lengthCm) * Number(widthCm) * Number(heightCm)) / divisor);
  const hit = await matchRule(args);
  let rate = null;
  let countryPrice = false;
  if (hit) {
    if (hit.countryPriceCnyPerKg != null) { rate = hit.countryPriceCnyPerKg; countryPrice = true; } else rate = hit.priceCnyPerKg;
  }
  if (rate == null) rate = s.fallbackPriceCnyPerKg != null ? Number(s.fallbackPriceCnyPerKg) : null;
  if (rate == null) return { ok: false, reason: 'no_price', matched: Boolean(hit), ruleIndex: hit ? hit.index : -1 };
  const minimum = Number(s.minShippingCny) || 0;
  const raw = rate * chargeableKg;
  return { ok: true, amountCny: Math.max(minimum, raw), rateCnyPerKg: rate, chargeableKg, matched: Boolean(hit), ruleIndex: hit ? hit.index : -1, countryPrice, minimumApplied: raw < minimum };
}

// The calendar days the buyer is shown, or null when the date is hidden.
async function calculateDeliveryDays(args) {
  return (await estimateDelivery(args)).days;
}

module.exports = { resolveDestinationIsoCode, calculateDeliveryDays, estimateDelivery, matchRule, shippingQuote, FALLBACK_DELIVERY_DAYS };
