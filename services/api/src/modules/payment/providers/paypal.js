const { Client, Environment, OrdersController, CheckoutPaymentIntent } = require('@paypal/paypal-server-sdk');
const { env } = require('../../../config/env');
const { getProviderCredentials } = require('../../paymentProviders/routes');

/**
 * PayPal integration via the official @paypal/paypal-server-sdk (Orders v2
 * API). Written against the SDK's actual installed type definitions
 * (inspected directly — Client config shape, OrdersController method
 * signatures, Order/PurchaseUnitRequest/AmountWithBreakdown models) rather
 * than assumed from memory.
 *
 * Real, updated (migration 065/066) -- credentials now come from the
 * real, encrypted, admin-editable payment_provider_credentials table
 * (see paymentProviders/routes.js's own getProviderCredentials),
 * not static environment variables. Deliberately no module-level
 * client caching anymore -- an admin can update these credentials at
 * any time through the real admin portal, and a cached client built
 * from the real old credentials would otherwise keep using them
 * silently until a server restart.
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
 * once real credentials are saved via the admin portal's Payment Providers
 * page.
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

async function isConfigured() {
  const creds = await getProviderCredentials('paypal');
  return Boolean(creds?.clientId && creds?.clientSecret);
}

/**
 * Real, builds a fresh OrdersController per call, using whatever
 * credentials are currently saved -- returns null if not configured.
 */
async function getOrdersController() {
  const creds = await getProviderCredentials('paypal');
  if (!creds?.clientId || !creds?.clientSecret) return null;
  const client = new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: creds.clientId,
      oAuthClientSecret: creds.clientSecret,
    },
    environment: env.paypalEnvironment === 'production' ? Environment.Production : Environment.Sandbox,
  });
  return new OrdersController(client);
}

/**
 * Creates a PayPal order (step 1 of PayPal's 2-step create-then-capture
 * flow). Returns an approval URL the buyer must be redirected to — unlike
 * Stripe, there is no single-call "charge now" for the standard PayPal
 * Checkout flow.
 */
async function createOrder({ amount, currencyCode, referenceId, returnUrl, cancelUrl }) {
  const controller = await getOrdersController();
  if (!controller) {
    throw new Error('PayPal is not configured. Set it up in the admin portal\'s Payment Providers page.');
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
  const controller = await getOrdersController();
  if (!controller) {
    throw new Error('PayPal is not configured. Set it up in the admin portal\'s Payment Providers page.');
  }
  const response = await controller.captureOrder({ id: orderId });
  return response.result;
}

module.exports = { createOrder, captureOrder, isConfigured, formatAmountForPaypal };
