const express = require('express');
const { toGatewayAmount } = require('./currency');
const aps = require('./providers/amazonPaymentServices');
const paypal = require('./providers/paypal');
const { getProviderCredentials } = require('../paymentProviders/routes');

/**
 * Payment module — BUY-040–044.
 *
 * Real integrations: Stripe, Amazon Payment Services (APS), and PayPal.
 * "Google Pay" is intentionally NOT a separate gateway integration here —
 * see the note above the /intent handler for why that would be
 * architecturally wrong.
 *
 * NETWORK LIMITATION (applies to all three real integrations): this
 * sandbox has no network access to api.stripe.com, Amazon's payment API,
 * or PayPal's API (only npm registries are reachable), so none of the
 * three have had an actual live call tested. Each provider file documents
 * exactly what WAS verified locally (request shaping, amount math, error
 * guards) vs. what still needs a real test transaction. Read those files
 * before assuming any of this works end-to-end.
 *
 * Real, updated (migration 065/066) -- credentials for all three now
 * come from the real, encrypted, admin-editable
 * payment_provider_credentials table, set up through the admin
 * portal's own Payment Providers page, not static environment
 * variables.
 */
const router = express.Router();

const PROVIDERS = ['stripe', 'amazon_payment_services', 'paypal', 'google_pay'];

/**
 * Real, builds a fresh Stripe client per call using whatever
 * credentials are currently saved -- returns null if not configured.
 * Deliberately no module-level caching, same real reasoning as
 * PayPal/APS: an admin can update this credential at any time through
 * the real admin portal.
 */
async function getStripeClient() {
  const creds = await getProviderCredentials('stripe');
  if (!creds?.secretKey) return null;
  const Stripe = require('stripe');
  return new Stripe(creds.secretKey);
}

/**
 * Creates a Stripe PaymentIntent. Shared by both the 'stripe' and
 * 'google_pay' cases below, because Google Pay is not its own gateway —
 * see the routing note in the /intent handler.
 */
async function createStripeIntent(amount, currencyCode) {
  const stripe = await getStripeClient();
  if (!stripe) return null;
  const { amount: gatewayAmount, warning } = toGatewayAmount(amount, currencyCode);
  const intent = await stripe.paymentIntents.create({
    amount: gatewayAmount,
    currency: currencyCode.toLowerCase(),
    // automatic_payment_methods lets Stripe present Google Pay (and Apple
    // Pay) automatically on the client when the buyer's device/browser
    // supports it — this is how Google Pay actually gets processed, via
    // Stripe as the underlying gateway, not as a separate integration.
    automatic_payment_methods: { enabled: true },
  });
  return { intent, warning };
}

router.get('/methods', (req, res) => {
  res.json({ providers: PROVIDERS });
});

// POST /payment/intent
// Stripe / Google Pay:            { provider, amount, currencyCode }
// Amazon Payment Services:        { provider, amount, currencyCode, customerEmail, returnUrl, merchantReference? }
// PayPal:                         { provider, amount, currencyCode, returnUrl?, cancelUrl?, referenceId? }
router.post('/intent', async (req, res) => {
  const { provider, amount, currencyCode, customerEmail, returnUrl, cancelUrl, merchantReference, referenceId } = req.body || {};
  if (!PROVIDERS.includes(provider)) {
    return res.status(400).json({ error: `Unsupported provider. Use one of: ${PROVIDERS.join(', ')}` });
  }
  if (!amount || !currencyCode) {
    return res.status(400).json({ error: 'amount and currencyCode are required' });
  }

  // --- Stripe and Google Pay both route through the same Stripe intent ---
  // Google Pay is a client-side wallet, not an independent backend gateway:
  // the browser/device produces a payment token, and Stripe (already
  // integrated) processes it via the same PaymentIntent API used for
  // regular cards. There is no separate "Google Pay server" to call.
  if (provider === 'stripe' || provider === 'google_pay') {
    const result = await (async () => {
      try {
        return { data: await createStripeIntent(amount, currencyCode) };
      } catch (err) {
        return { error: err };
      }
    })();
    if (result.error) {
      return res.status(502).json({ error: `Stripe error: ${result.error.message}` });
    }
    if (!result.data) {
      return res.status(503).json({
        error: 'Stripe is not configured. Set it up in the admin portal\'s Payment Providers page.',
      });
    }
    const { intent, warning } = result.data;
    return res.status(201).json({
      intentId: intent.id,
      clientSecret: intent.client_secret,
      provider,
      amount,
      currencyCode,
      status: intent.status,
      warning: provider === 'google_pay'
        ? 'Google Pay is processed through Stripe as the underlying gateway — use the Stripe clientSecret above with the Google Pay button/Payment Request API on the client.'
        : warning,
    });
  }

  if (provider === 'amazon_payment_services') {
    if (!(await aps.isConfigured())) {
      return res.status(503).json({
        error: 'Amazon Payment Services is not configured. Set it up in the admin portal\'s Payment Providers page.',
      });
    }
    if (!customerEmail || !returnUrl) {
      return res.status(400).json({ error: 'customerEmail and returnUrl are required for Amazon Payment Services' });
    }
    try {
      const result = await aps.createPurchase({
        merchantReference: merchantReference || `order_${Date.now()}`,
        amount, currencyCode, customerEmail, returnUrl,
      });
      return res.status(201).json({
        provider, amount, currencyCode, ...result,
        warning: 'Amazon Payment Services integration has not been tested against a live endpoint — see providers/amazonPaymentServices.js for details.',
      });
    } catch (err) {
      return res.status(502).json({ error: `Amazon Payment Services error: ${err.message}` });
    }
  }

  if (provider === 'paypal') {
    if (!(await paypal.isConfigured())) {
      return res.status(503).json({
        error: 'PayPal is not configured. Set it up in the admin portal\'s Payment Providers page.',
      });
    }
    try {
      const result = await paypal.createOrder({
        amount, currencyCode, returnUrl, cancelUrl, referenceId,
      });
      return res.status(201).json({
        provider, amount, currencyCode, ...result,
        note: 'PayPal uses a 2-step flow: redirect the buyer to approveUrl, then call POST /payment/paypal/capture/:orderId after they approve.',
      });
    } catch (err) {
      return res.status(502).json({ error: `PayPal error: ${err.message}` });
    }
  }

  return res.status(400).json({ error: `Unhandled provider: ${provider}` });
});

// POST /payment/paypal/capture/:orderId — step 2 of PayPal's flow, called
// after the buyer approves the order at the approveUrl from /intent.
router.post('/paypal/capture/:orderId', async (req, res) => {
  if (!(await paypal.isConfigured())) {
    return res.status(503).json({ error: 'PayPal is not configured.' });
  }
  try {
    const captured = await paypal.captureOrder(req.params.orderId);
    return res.status(200).json(captured);
  } catch (err) {
    return res.status(502).json({ error: `PayPal capture error: ${err.message}` });
  }
});

module.exports = router;
