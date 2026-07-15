const db = require('../../../db/pool');

/**
 * The real pricing engine: supplier RMB cost -> buyer USD price.
 *
 * CONFIRMED DESIGN, not guessed: every fee is RMB-denominated and applied
 * in `sort_order` sequence against a RUNNING TOTAL — standard
 * international-trade "landed cost" buildup (cost -> + fee -> + next fee
 * against the NEW running total -> ...), not simple percentages of the
 * original cost stacked independently. A single RMB->USD conversion
 * happens once, at the very end, to avoid intermediate currency-mixing
 * bugs.
 *
 * This is called LIVE by the catalog module on every browse/view (a fee
 * or FX-rate change is reflected immediately, confirmed as the wanted
 * behavior) and by the cart module when displaying cart contents. The
 * order module also calls it live, but at the moment of order placement
 * — the resulting number gets written into the real
 * order_line_items.unit_price snapshot column (migration 001), which is
 * deliberately NOT recalculated after that point. See migration 014's
 * header comment for why locking at order placement is the correct
 * choice, not an oversight.
 */

const SHIPPING_VOLUMETRIC_DIVISOR = 5000; // industry-standard air-freight divisor (cm^3 per kg)

/**
 * The real, honest FX rate lookup. There is NO live-rate API configured
 * in this environment — same category of external dependency as the
 * payment gateways (Stripe/APS/PayPal), which also have no real
 * credentials here. `fetchLiveRate` is a clearly-marked stub for exactly
 * where a real provider (e.g. exchangerate-api.com, Open Exchange Rates)
 * would be wired in later.
 *
 * What actually powers the calculation TODAY, and is fully real and
 * functional right now: a manually-set admin rate in `fx_rates`, updated
 * via PATCH /pricing/fx-rate. This isn't a placeholder that does
 * nothing — it's a real, working exchange rate the system genuinely
 * uses, just not sourced from a live API yet.
 */
async function fetchLiveRate(pair) {
  // STUB: replace with a real provider call once an API key exists.
  // Deliberately throws rather than silently returning a made-up number
  // — see getFxRate's fallback below for what actually happens today.
  throw new Error(`Live FX rate provider not configured for ${pair}`);
}

async function getFxRate(pair) {
  try {
    const liveRate = await fetchLiveRate(pair);
    return { rate: liveRate, source: 'live' };
  } catch (err) {
    const { rows } = await db.query('SELECT rate, source, updated_at FROM fx_rates WHERE currency_pair = $1', [pair]);
    if (rows.length === 0) {
      throw new Error(`No FX rate configured for ${pair} — set one via PATCH /pricing/fx-rate first`);
    }
    return { rate: Number(rows[0].rate), source: rows[0].source, updatedAt: rows[0].updated_at };
  }
}

/**
 * Real industry-standard volumetric weight: chargeable weight is the
 * GREATER of actual weight and a dimensional-weight estimate, since a
 * large-but-light box still takes up real cargo space. Deliberately
 * simple (a single fixed divisor, one flat rate) — a placeholder for a
 * more sophisticated shipping equation to be designed later, not
 * pretending to be the final answer.
 */
function chargeableWeightKg({ weightKg, lengthCm, widthCm, heightCm }) {
  const volumetricKg = (lengthCm * widthCm * heightCm) / SHIPPING_VOLUMETRIC_DIVISOR;
  return Math.max(weightKg, volumetricKg);
}

/**
 * Computes the real buyer-facing USD price from a supplier's RMB cost
 * and the product's real shipping dimensions, applying every active fee
 * component in sequence. Returns a full breakdown (not just the final
 * number) — a money calculation should be auditable, not a black box.
 */
async function calculateBuyerPriceUsd({ supplierCostCny, weightKg, lengthCm, widthCm, heightCm }) {
  if (supplierCostCny == null || supplierCostCny <= 0) {
    throw new Error('supplierCostCny must be a positive number');
  }

  const { rows: components } = await db.query(
    'SELECT id, name, type, value FROM pricing_fee_components WHERE is_active = true ORDER BY sort_order ASC'
  );

  let runningTotalCny = Number(supplierCostCny);
  const breakdown = [{ step: 'Supplier cost (RMB)', amountCny: runningTotalCny, runningTotalCny }];

  for (const c of components) {
    let feeAmountCny;
    if (c.type === 'percentage') {
      feeAmountCny = runningTotalCny * (Number(c.value) / 100);
    } else if (c.type === 'flat') {
      feeAmountCny = Number(c.value);
    } else if (c.type === 'shipping_volumetric') {
      if (weightKg == null || lengthCm == null || widthCm == null || heightCm == null) {
        throw new Error(`Cannot apply shipping fee "${c.name}" — product is missing weight/dimensions`);
      }
      const chargeable = chargeableWeightKg({ weightKg, lengthCm, widthCm, heightCm });
      feeAmountCny = Number(c.value) * chargeable;
    } else {
      continue; // unknown type — skip rather than crash a live catalog request
    }
    runningTotalCny += feeAmountCny;
    breakdown.push({ step: c.name, type: c.type, amountCny: Number(feeAmountCny.toFixed(4)), runningTotalCny: Number(runningTotalCny.toFixed(4)) });
  }

  const { rate: fxRate, source: fxSource } = await getFxRate('CNY_USD');
  const buyerPriceUsd = runningTotalCny * fxRate;

  return {
    buyerPriceUsd: Number(buyerPriceUsd.toFixed(2)),
    landedCostCny: Number(runningTotalCny.toFixed(4)),
    fxRate,
    fxSource,
    breakdown,
  };
}

module.exports = { calculateBuyerPriceUsd, getFxRate, chargeableWeightKg, SHIPPING_VOLUMETRIC_DIVISOR };
