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
    const response = await fetch(`${FRANKFURTER_BASE_URL}/latest?from=${fromCurrency}&to=${toCurrency}`);
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
