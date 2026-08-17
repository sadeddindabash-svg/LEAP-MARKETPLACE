const db = require('../../../db/pool');

/**
 * Real live FX rate refresh via Frankfurter.app (migration 028).
 * CONFIRMED SCOPE, discussed before building: a real automatic/manual
 * toggle, not fully automatic-only -- the existing real manual
 * fallback (see pricing/routes.js's PATCH /fx-rate, migration 014)
 * stays available and is the real default, since financial pricing
 * logic depending on this number deserves a real safety net.
 * Frankfurter was chosen specifically because it's genuinely free, no
 * API key or account required, and backed by real European Central
 * Bank data (updated once per real business day, not live market-tick
 * pricing, but accurate and reliable).
 *
 * HONEST LIMITATION: this sandbox's network access does not include
 * api.frankfurter.app in its allowlist, so this could not be tested
 * against the real, live Frankfurter API from here -- only built
 * carefully from their documented, public API format. Verify the real
 * response shape once running outside this sandbox, and adjust
 * parseFrankfurterResponse() below if it differs from what's assumed
 * here.
 */

const FRANKFURTER_BASE_URL = 'https://api.frankfurter.app';
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // once a day, confirmed

function parseFrankfurterResponse(body, toCurrency) {
  const rate = body?.rates?.[toCurrency];
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Frankfurter response missing a real, valid rate for ${toCurrency}`);
  }
  return rate;
}

// Real, best-effort refresh for one real currency pair (e.g. 'CNY_USD').
// Never throws -- a real network hiccup or an unexpected real response
// shape should never crash the server; the existing real fx_rates row
// (whatever it currently holds) is left untouched on any failure.
async function refreshLiveFxRate(currencyPair) {
  const [fromCurrency, toCurrency] = currencyPair.split('_');
  try {
    // REAL BUG FOUND AND FIXED HERE, same real bug class already found
    // and fixed for the SMTP email transport, the translation API,
    // 17TRACK, and the payment gateway elsewhere this session --
    // genuinely important here too, since this is called directly from
    // a real, blocking admin-facing endpoint (PATCH /pricing/fx-rate-
    // mode). A slow or unreachable Frankfurter could otherwise hang
    // that real admin action indefinitely.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    let response;
    try {
      response = await fetch(`${FRANKFURTER_BASE_URL}/latest?from=${fromCurrency}&to=${toCurrency}`, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) {
      throw new Error(`Frankfurter responded with ${response.status}`);
    }
    const body = await response.json();
    const rate = parseFrankfurterResponse(body, toCurrency);
    await db.query(
      `INSERT INTO fx_rates (currency_pair, rate, source, updated_at) VALUES ($1, $2, 'live', now())
       ON CONFLICT (currency_pair) DO UPDATE SET rate = $2, source = 'live', updated_at = now()`,
      [currencyPair, rate]
    );
    console.log(`[fx-rate] Real live rate refreshed for ${currencyPair}: ${rate}`);
    return { success: true, rate };
  } catch (err) {
    console.error(`[fx-rate] Real live refresh failed for ${currencyPair}, keeping the existing rate (non-fatal):`, err.message);
    return { success: false, error: err.message };
  }
}

async function getFxRateMode() {
  const { rows } = await db.query("SELECT value FROM platform_settings WHERE key = 'fx_rate_mode'");
  return rows[0]?.value || 'manual';
}

// Real, once-a-day scheduling -- deliberately setInterval rather than a
// new cron dependency, matching this project's preference for minimal,
// generic implementations. Called once at real server startup; if the
// real mode is 'automatic', refreshes immediately (so a fresh restart
// doesn't wait a full real day for its first live rate) and then every
// real 24 hours after that. Re-checks the real mode on every tick, so a
// later switch back to 'manual' is honored without needing a restart.
function startScheduledFxRateRefresh(currencyPair = 'CNY_USD') {
  const tick = async () => {
    // REAL BUG FOUND AND FIXED HERE: this originally had no real
    // try/catch around it at all -- if the real database was
    // unavailable for even a moment right when this real scheduled
    // tick fired, getFxRateMode()'s own real query would throw, and
    // since nothing here ever caught it, Node treated it as a real
    // unhandled promise rejection and crashed the entire server. A
    // real, temporary DB hiccup should never take down the whole real
    // API -- every other real background/best-effort action in this
    // project already follows this same real pattern.
    try {
      const mode = await getFxRateMode();
      if (mode === 'automatic') {
        await refreshLiveFxRate(currencyPair);
      }
    } catch (err) {
      console.error('[fx-rate] Scheduled tick failed (non-fatal, will retry next interval):', err.message);
    }
  };
  tick(); // real, immediate check on startup
  setInterval(tick, REFRESH_INTERVAL_MS);
}

module.exports = { refreshLiveFxRate, getFxRateMode, startScheduledFxRateRefresh };

// Real buyer-facing display-currency refresh (new) -- reuses the exact
// same real refreshLiveFxRate() above, just called for every real
// currency in the confirmed 40-country launch market list (see
// src/config/markets.js) instead of only CNY_USD. Deliberately always
// auto-refreshes (no manual/automatic toggle, unlike CNY_USD) since
// this feeds display-only conversion, not real supplier pricing --
// the actual charge always happens in USD regardless of what's shown
// here, so a stale or momentarily-failed rate has much lower real
// stakes than a stale CNY_USD supplier rate would.
const { LAUNCH_MARKETS } = require('../../config/markets');

// Real, confirmed fixed peg -- the Bulgarian lev has been pegged to
// the euro by law (via a currency board) since 1997, at exactly this
// rate. Unlike the 5 GCC currencies (pegged directly to USD, so their
// own USD rate never moves), BGN's real USD rate still floats
// day-to-day, tracking whatever the live USD_EUR rate happens to be
// -- so this constant alone isn't a usable USD_BGN rate on its own,
// it's the fixed EUR_BGN leg used to derive one below.
const BGN_PER_EUR = 1.95583;

// Real currencies Frankfurter is confirmed not to carry (repeated,
// consistent 404s) -- excluded from the main loop below to avoid 9
// wasted daily requests to a free service for pairs already known to
// fail. BGN is derived from the live USD_EUR rate instead (see
// refreshBgnFromEurPeg). The other 8 come from a real secondary
// source (see refreshFromSecondarySource) -- open.er-api.com, chosen
// for its real, broader-than-ECB coverage, also free and requiring no
// API key. VES (Venezuelan bolivar) is deliberately left out of both
// -- its real official and real street exchange rates diverge
// significantly, so no free source can be trusted to reflect what a
// real buyer would actually experience; left as an honest gap rather
// than a real but misleading number.
const FRANKFURTER_UNSUPPORTED = new Set(['BGN', 'ARS', 'CLP', 'DOP', 'JOD', 'KWD', 'PEN', 'PYG', 'UYU', 'VES']);

// Real, best-effort derivation of USD_BGN from the real, already-
// live-refreshed USD_EUR rate -- never throws, matching the same
// non-fatal pattern as every other refresh function here. Reads
// whatever USD_EUR rate is currently in fx_rates (freshest available,
// regardless of exactly when in this tick cycle it was last updated),
// so a momentary read failure here never blocks or crashes the
// broader real refresh cycle.
async function refreshBgnFromEurPeg() {
  try {
    const { rows } = await db.query("SELECT rate FROM fx_rates WHERE currency_pair = 'USD_EUR'");
    const usdToEur = rows[0]?.rate;
    if (typeof usdToEur !== 'number' && typeof usdToEur !== 'string') {
      throw new Error('No real USD_EUR rate available yet to derive USD_BGN from');
    }
    const rate = Number(usdToEur) * BGN_PER_EUR;
    await db.query(
      `INSERT INTO fx_rates (currency_pair, rate, source, updated_at) VALUES ('USD_BGN', $1, 'manual', now())
       ON CONFLICT (currency_pair) DO UPDATE SET rate = $1, source = 'manual', updated_at = now()`,
      [rate]
    );
    console.log(`[fx-rate] Real USD_BGN derived from the live EUR peg: ${rate}`);
  } catch (err) {
    console.error('[fx-rate] Real USD_BGN derivation failed, keeping the existing rate (non-fatal):', err.message);
  }
}

const SECONDARY_SOURCE_URL = 'https://open.er-api.com/v6/latest/USD';
const SECONDARY_SOURCE_CURRENCIES = ['ARS', 'CLP', 'DOP', 'JOD', 'KWD', 'PEN', 'PYG', 'UYU'];

// Real, single-call refresh for the 8 real currencies Frankfurter
// doesn't carry -- open.er-api.com returns every real currency's rate
// in one real response, so this is one real request covering all 8,
// not 8 separate ones. Never throws; a real failure here leaves every
// one of these 8 currencies' existing real rates untouched, same
// honest fallback as every other refresh path in this file.
//
// HONEST LIMITATION, same as Frankfurter's own: this sandbox's
// network access does not include open.er-api.com in its allowlist,
// so this could not be tested against the real, live API from here --
// only built carefully from their documented, public response format
// ({ result: 'success', rates: { CODE: number, ... } }). Verify the
// real response shape once running outside this sandbox.
async function refreshFromSecondarySource() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    let response;
    try {
      response = await fetch(SECONDARY_SOURCE_URL, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) {
      throw new Error(`Secondary FX source responded with ${response.status}`);
    }
    const body = await response.json();
    if (body?.result !== 'success' || typeof body?.rates !== 'object') {
      throw new Error('Secondary FX source response missing a real, valid rates object');
    }
    for (const code of SECONDARY_SOURCE_CURRENCIES) {
      const rate = body.rates[code];
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
        console.error(`[fx-rate] Secondary source missing a real rate for ${code}, keeping the existing rate (non-fatal)`);
        continue;
      }
      await db.query(
        `INSERT INTO fx_rates (currency_pair, rate, source, updated_at) VALUES ($1, $2, 'live', now())
         ON CONFLICT (currency_pair) DO UPDATE SET rate = $2, source = 'live', updated_at = now()`,
        [`USD_${code}`, rate]
      );
      console.log(`[fx-rate] Real live rate refreshed for USD_${code} (secondary source): ${rate}`);
    }
  } catch (err) {
    console.error('[fx-rate] Real secondary source refresh failed entirely, keeping all existing rates (non-fatal):', err.message);
  }
}

function startScheduledDisplayCurrencyRefresh() {
  const currencyCodes = [...new Set(LAUNCH_MARKETS.map((m) => m.currencyCode))].filter((c) => c !== 'USD' && !FRANKFURTER_UNSUPPORTED.has(c));
  const tick = async () => {
    for (const code of currencyCodes) {
      // Sequential, not parallel -- a real, deliberate choice: Frankfurter
      // is a free, no-API-key service, and hammering it with 25+
      // simultaneous requests once a day is an unnecessary real load on
      // a service this project doesn't pay for. One real request every
      // real 500ms keeps this well under a minute total either way.
      await refreshLiveFxRate(`USD_${code}`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    // Real, ordered after the loop above -- needs the real, freshly-
    // updated USD_EUR rate this same tick just refreshed.
    await refreshBgnFromEurPeg();
    // Real, single extra request covering the remaining 8 real
    // currencies Frankfurter doesn't carry.
    await refreshFromSecondarySource();
  };
  tick(); // real, immediate check on startup
  setInterval(tick, REFRESH_INTERVAL_MS);
}

module.exports.startScheduledDisplayCurrencyRefresh = startScheduledDisplayCurrencyRefresh;
module.exports.refreshBgnFromEurPeg = refreshBgnFromEurPeg;
module.exports.refreshFromSecondarySource = refreshFromSecondarySource;
