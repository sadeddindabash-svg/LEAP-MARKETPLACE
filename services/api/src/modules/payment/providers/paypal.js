const { Client, Environment, OrdersController, CheckoutPaymentIntent } = require('@paypal/paypal-server-sdk');
const { env } = require('../../../config/env');

/**
 * PayPal integration via the official @paypal/paypal-server-sdk (Orders v2
 * API). Written against the SDK's actual installed type definitions
 * (inspected directly — Client config shape, OrdersController method
 * signatures, Order/PurchaseUnitRequest/AmountWithBreakdown models) rather
 * than assumed from memory.
 *
 * ============================================================
 * IMPORTANT — PayPal's amount format is NOT the same as Stripe's:
 * ============================================================
 * Stripe wants integer minor units (e.g. 3490 for $34.90). PayPal's Orders
 * v2 API wants a DECIMAL STRING instead (e.g. "34.90"). Do NOT reuse
 * ../currency.js (the Stripe zero-decimal-currency helper) for PayPal
 * amounts — it would produce wrong values here.
 *
 * A small number of currencies are documented by PayPal as not supporting
 * decimal places (HUF, JPY, TWD per PayPal's currency-code reference).
 * Hungary (HUF) is one of our 40 confirmed launch markets, so this isn't a
 * theoretical edge case — it's a real market on the list. This is flagged
 * as UNVERIFIED below (not independently confirmed against a live PayPal
 * account) rather than silently assumed correct.
 *
 * ============================================================
 * NOT YET VERIFIED — no live call has been made:
 * ============================================================
 * This sandbox has no network access to PayPal's API (only npm registries
 * are reachable), so createOrder/captureOrder have not actually been
 * called against PayPal's sandbox. What WAS verified locally:
 *   - The SDK's real type signatures (installed and inspected, not guessed)
 *   - Amount formatting logic (formatAmountForPaypal), unit-tested directly
 *   - Client construction does not throw on empty credentials (unlike
 *     Stripe), but our own isConfigured() guard still prevents any call
 *     from being attempted without real credentials
 * Run one real sandbox create-order + capture-order as the first next step
 * once PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are available.
 */

// Per PayPal's currency-code documentation — NOT independently verified
// against a live account.
const PAYPAL_NO_DECIMAL_CURRENCIES_UNVERIFIED = new Set(['HUF', 'JPY', 'TWD']);

/**
 * Pure function, no network — fully unit-testable in isolation.
 * @returns {{ value: string, warning: string | null }}
 */
function formatAmountForPaypal(amount, currencyCode) {
  const currency = currencyCode.toUpperCase();
  if (PAYPAL_NO_DECIMAL_CURRENCIES_UNVERIFIED.has(currency)) {
    return {
      value: String(Math.round(amount)),
      warning: `${currency} is documented by PayPal as a no-decimal currency, but this hasn't been independently verified against a live account — confirm before relying on it in production.`,
    };
  }
  return { value: Number(amount).toFixed(2), warning: null };
}

function isConfigured() {
  return Boolean(env.paypalClientId && env.paypalClientSecret);
}

let ordersController = null;
function getOrdersController() {
  if (ordersController) return ordersController;
  if (!isConfigured()) return null;
  const client = new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: env.paypalClientId,
      oAuthClientSecret: env.paypalClientSecret,
    },
    environment: env.paypalEnvironment === 'production' ? Environment.Production : Environment.Sandbox,
  });
  ordersController = new OrdersController(client);
  return ordersController;
}

/**
 * Creates a PayPal order (step 1 of PayPal's 2-step create-then-capture
 * flow). Returns an approval URL the buyer must be redirected to — unlike
 * Stripe, there is no single-call "charge now" for the standard PayPal
 * Checkout flow.
 */
async function createOrder({ amount, currencyCode, referenceId, returnUrl, cancelUrl }) {
  const controller = getOrdersController();
  if (!controller) {
    throw new Error('PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in your .env (see .env.example).');
  }
  const { value, warning } = formatAmountForPaypal(amount, currencyCode);

  const response = await controller.createOrder({
    body: {
      intent: CheckoutPaymentIntent.Capture,
      purchaseUnits: [
        {
          referenceId: referenceId || undefined,
          amount: { currencyCode: currencyCode.toUpperCase(), value },
        },
      ],
      applicationContext: returnUrl && cancelUrl ? { returnUrl, cancelUrl } : undefined,
    },
  });

  const order = response.result;
  const approveLink = (order.links || []).find((l) => l.rel === 'approve');
  return {
    orderId: order.id,
    status: order.status,
    approveUrl: approveLink ? approveLink.href : null,
    warning,
  };
}

/** Step 2: captures payment after the buyer has approved via approveUrl. */
async function captureOrder(orderId) {
  const controller = getOrdersController();
  if (!controller) {
    throw new Error('PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in your .env (see .env.example).');
  }
  const response = await controller.captureOrder({ id: orderId });
  return response.result;
}

module.exports = { createOrder, captureOrder, isConfigured, formatAmountForPaypal };
