/**
 * Currency amount conversion for payment gateways that expect amounts in
 * the currency's smallest unit (Stripe, and most others, work this way).
 *
 * IMPORTANT — verified against Stripe's documented zero-decimal currency
 * list (currencies with no minor unit, e.g. Japanese Yen): for these,
 * amounts are passed as-is (no ×100). Two of our 40 confirmed launch
 * markets are on this list: Chile (CLP) and Paraguay (PYG).
 *
 * FLAGGED, NOT YET VERIFIED — four of our launch markets use ISO 4217
 * three-decimal currencies: Bahrain (BHD), Jordan (JOD), Kuwait (KWD),
 * Oman (OMR). Stripe's own documentation is inconsistent about how these
 * are handled (some processors treat them as 2-decimal on their platform
 * regardless of the ISO standard). DO NOT ship checkout for these four
 * countries until this is confirmed against current Stripe documentation
 * or a test transaction, or amounts could be off by 10x.
 */

const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
  'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

const UNVERIFIED_THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'JOD', 'KWD', 'OMR']);

/**
 * Converts a human-readable amount (e.g. 34.90) into the integer smallest-unit
 * amount a gateway API expects (e.g. 3490 cents), handling zero-decimal
 * currencies correctly.
 *
 * @returns {{ amount: number, warning: string | null }}
 */
function toGatewayAmount(amount, currencyCode) {
  const currency = currencyCode.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(currency)) {
    return { amount: Math.round(amount), warning: null };
  }
  if (UNVERIFIED_THREE_DECIMAL_CURRENCIES.has(currency)) {
    return {
      amount: Math.round(amount * 100),
      warning: `${currency} is a 3-decimal ISO currency with unverified gateway handling — confirm with Stripe docs/a test transaction before relying on this in production.`,
    };
  }
  return { amount: Math.round(amount * 100), warning: null };
}

module.exports = { toGatewayAmount, ZERO_DECIMAL_CURRENCIES, UNVERIFIED_THREE_DECIMAL_CURRENCIES };
