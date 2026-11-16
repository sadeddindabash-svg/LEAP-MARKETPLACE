const db = require('../../../db/pool');
const { nameForIsoCode } = require('../shared/countries');

/**
 * Delivery Rules > "How it works" (confirmed with the person via mockup): the settings around the rules list.
 *   fallbackCountryIso   the buyer's country when neither their address nor their internet address gives one (was always JO)
 *   noRuleAction         when no rule fits: 'days' (use fallbackDays, was always 7) | 'hide' (no delivery date is shown)
 *   prepDays / inspectionDays   added to the rule's days (supplier preparing, hub inspection), 0 to 10 each
 *   offDays              weekdays not counted (0 = Sunday ... 6 = Saturday), at most 3
 *   showMode / rangeDays 'date' (one date) | 'range' (the date ± rangeDays)
 *   notifyMode / summaryHour / summaryTz   what the admin is told about products missing a date (see summary.js)
 * Read through a 60-second cache: the estimate runs for every product shown.
 */
// fallbackPriceCnyPerKg / minShippingCny / volumetricDivisor: the shipping price when no rule fits (RMB per kg, null = none), the least shipping per item, L x W x H / divisor (patch-delivery-prices)
const DEFAULTS = { fallbackCountryIso: 'JO', noRuleAction: 'days', fallbackDays: 7, prepDays: 0, inspectionDays: 0, offDays: [], showMode: 'date', rangeDays: 1, notifyMode: 'daily', summaryHour: 9, summaryTz: 'Asia/Riyadh', fallbackPriceCnyPerKg: null, minShippingCny: 0, volumetricDivisor: 5000 };
class DeliverySettingsError extends Error { constructor(message) { super(message); this.status = 400; } }

const fromRow = (r) => (!r ? { ...DEFAULTS } : {
  fallbackCountryIso: r.fallback_country_iso, noRuleAction: r.no_rule_action, fallbackDays: Number(r.fallback_days), prepDays: Number(r.prep_days), inspectionDays: Number(r.inspection_days),
  offDays: (Array.isArray(r.off_days) ? r.off_days : String(r.off_days || '').replace(/[{}]/g, '').split(',').filter(Boolean)).map(Number), showMode: r.show_mode, rangeDays: Number(r.range_days),
  notifyMode: r.notify_mode, summaryHour: Number(r.summary_hour), summaryTz: r.summary_tz, lastSummaryAt: r.last_summary_at || null, lastProblemCount: Number(r.last_problem_count || 0), updatedAt: r.updated_at,
  fallbackPriceCnyPerKg: r.fallback_price_cny_per_kg == null ? null : Number(r.fallback_price_cny_per_kg), minShippingCny: r.min_shipping_cny == null ? 0 : Number(r.min_shipping_cny), volumetricDivisor: r.volumetric_divisor == null ? 5000 : Number(r.volumetric_divisor),
});

let cache = null; let cacheAt = 0;
async function getDeliverySettings({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cacheAt < 60000) return cache;
  try {
    const { rows } = await db.query('SELECT * FROM delivery_settings WHERE id = 1');
    cache = fromRow(rows[0]); cacheAt = Date.now();
  } catch (err) {
    // before the migration has run: today's behaviour
    if (!cache) cache = { ...DEFAULTS };
  }
  return cache;
}

function validate(input) {
  const s = { ...DEFAULTS, ...(input || {}) };
  const int = (v, min, max, name) => { const n = Number(v); if (!Number.isInteger(n) || n < min || n > max) throw new DeliverySettingsError(`${name} must be a whole number from ${min} to ${max}`); return n; };
  // an amount in RMB with at most 2 decimals; `empty` allows null (no price)
  const money = (v, min, max, name, empty) => { if (empty && (v === null || v === undefined || v === '')) return null; const n = Number(v); if (!Number.isFinite(n) || n < min || n > max) throw new DeliverySettingsError(`${name} must be a number from ${min} to ${max}`); return Math.round(n * 100) / 100; };
  if (!nameForIsoCode(String(s.fallbackCountryIso || ''))) throw new DeliverySettingsError('fallbackCountryIso must be a country from the list');
  if (!['days', 'hide'].includes(s.noRuleAction)) throw new DeliverySettingsError("noRuleAction must be 'days' or 'hide'");
  if (!['date', 'range'].includes(s.showMode)) throw new DeliverySettingsError("showMode must be 'date' or 'range'");
  if (!['each', 'daily', 'failures'].includes(s.notifyMode)) throw new DeliverySettingsError("notifyMode must be 'each', 'daily' or 'failures'");
  const offDays = [...new Set((Array.isArray(s.offDays) ? s.offDays : []).map(Number))].sort();
  if (offDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6) || offDays.length > 3) throw new DeliverySettingsError('offDays: at most 3 weekdays, 0 (Sunday) to 6 (Saturday)');
  let tz = typeof s.summaryTz === 'string' && s.summaryTz ? s.summaryTz : 'Asia/Riyadh';
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch { tz = 'Asia/Riyadh'; }
  return {
    fallbackCountryIso: String(s.fallbackCountryIso).toUpperCase(), noRuleAction: s.noRuleAction, fallbackDays: int(s.fallbackDays, 1, 60, 'fallbackDays'),
    prepDays: int(s.prepDays, 0, 10, 'prepDays'), inspectionDays: int(s.inspectionDays, 0, 10, 'inspectionDays'), offDays, showMode: s.showMode, rangeDays: int(s.rangeDays, 1, 5, 'rangeDays'),
    notifyMode: s.notifyMode, summaryHour: int(s.summaryHour, 0, 23, 'summaryHour'), summaryTz: tz,
    fallbackPriceCnyPerKg: money(s.fallbackPriceCnyPerKg, 0.01, 10000, 'fallbackPriceCnyPerKg', true), minShippingCny: money(s.minShippingCny, 0, 300, 'minShippingCny', false), volumetricDivisor: int(s.volumetricDivisor, 4000, 6000, 'volumetricDivisor'),
  };
}

async function saveDeliverySettings(input, adminId) {
  const v = validate(input);
  const { rows } = await db.query(
    `INSERT INTO delivery_settings (id, fallback_country_iso, no_rule_action, fallback_days, prep_days, inspection_days, off_days, show_mode, range_days, notify_mode, summary_hour, summary_tz, fallback_price_cny_per_kg, min_shipping_cny, volumetric_divisor, updated_at, updated_by)
     VALUES (1, $1, $2, $3, $4, $5, $6::int[], $7, $8, $9, $10, $11, $13, $14, $15, now(), $12)
     ON CONFLICT (id) DO UPDATE SET fallback_country_iso = $1, no_rule_action = $2, fallback_days = $3, prep_days = $4, inspection_days = $5, off_days = $6::int[], show_mode = $7,
       range_days = $8, notify_mode = $9, summary_hour = $10, summary_tz = $11, fallback_price_cny_per_kg = $13, min_shipping_cny = $14, volumetric_divisor = $15, updated_at = now(), updated_by = $12
     RETURNING *`,
    [v.fallbackCountryIso, v.noRuleAction, v.fallbackDays, v.prepDays, v.inspectionDays, v.offDays, v.showMode, v.rangeDays, v.notifyMode, v.summaryHour, v.summaryTz, adminId || null, v.fallbackPriceCnyPerKg, v.minShippingCny, v.volumetricDivisor]
  );
  cache = fromRow(rows[0]); cacheAt = Date.now();
  return cache;
}

// The rule's days -> the number of calendar days the buyer is shown: + preparing + inspection, then counted forward from today (in the shop's
// time zone) skipping the weekdays that are not counted. Pure: easy to test.
function calendarDaysFor(ruleDays, s, now = new Date()) {
  const work = ruleDays + (s.prepDays || 0) + (s.inspectionDays || 0);
  const off = new Set(s.offDays || []);
  if (off.size === 0) return work;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const d = new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
  let counted = 0; let calendar = 0;
  while (counted < work && calendar < 400) { d.setUTCDate(d.getUTCDate() + 1); calendar++; if (!off.has(d.getUTCDay())) counted++; }
  return calendar;
}

module.exports = { DEFAULTS, DeliverySettingsError, getDeliverySettings, saveDeliverySettings, validate, calendarDaysFor };
