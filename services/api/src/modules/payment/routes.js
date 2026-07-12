const express = require('express');
const { env } = require('../../config/env');
const { toGatewayAmount } = require('./currency');
const aps = require('./providers/amazonPaymentServices');

/**
 * Payment module — BUY-040–044.
 *
 * Two real gateways are wired up: Stripe (broad international coverage)
 * and Amazon Payment Services / APS (the business's existing gateway,
 * strong for MENA-region payment methods — a good fit for the 7 GCC/Jordan
 * markets in our 40 confirmed launch countries). PayPal / Google Pay
 * remain stubbed pending SDK integration.
 *
 * IMPORTANT — network limitation that applies to BOTH real integrations:
 * this sandbox has no network access to api.stripe.com or Amazon's payment
 * API (only npm registries are reachable), so neither has had an actual
 * live API call tested against it. What WAS verified locally for each:
 *
 * Stripe:
 *   - Server starts cleanly with no key set (503, not a crash)
 *   - Zero-decimal currency math (CLP, PYG) is correct
 *   - 3-decimal currencies (BHD, JOD, KWD, OMR) are flagged, not guessed
 *
 * Amazon Payment Services:
 *   - Server starts cleanly with no credentials set (503, not a crash)
 *   - The request-signing function itself (pure computation) runs and
 *     produces a well-formed signature
 *   - NOT verified: the actual API endpoint URL, exact field names, and
 *     currency minor-unit handling — see
 *     providers/amazonPaymentServices.js for the full list of what to
 *     confirm before production use.
 *
 * Do a real test-mode transaction against each as the first next step once
 * credentials are available.
 */
const router = express.Router();

const PROVIDERS = ['stripe', 'amazon_payment_services', 'paypal', 'google_pay'];
// Add further region-specific providers here once approved (see Charter
// Section 1, "Payment methods per country").

let stripeClient = null;
function getStripeClient() {
  if (stripeClient) return stripeClient;
  if (!env.stripeSecretKey) return null;
  // Lazy require + construct: Stripe's SDK throws synchronously if
  // constructed with an empty/invalid key, so we must not do this at
  // module load time, only when a key is actually present and needed.
  const Stripe = require('stripe');
  stripeClient = new Stripe(env.stripeSecretKey);
  return stripeClient;
}

router.get('/methods', (req, res) => {
  res.json({ providers: PROVIDERS });
});

// POST /payment/intent  { provider, amount, currencyCode, customerEmail?, returnUrl?, merchantReference? }
router.post('/intent', async (req, res) => {
  const { provider, amount, currencyCode, customerEmail, returnUrl, merchantReference } = req.body || {};
  if (!PROVIDERS.includes(provider)) {
    return res.status(400).json({ error: `Unsupported provider. Use one of: ${PROVIDERS.join(', ')}` });
  }
  if (!amount || !currencyCode) {
    return res.status(400).json({ error: 'amount and currencyCode are required' });
  }

  if (provider === 'stripe') {
    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(503).json({
        error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in your .env (see .env.example) — a test-mode key is fine for development.',
      });
    }
    const { amount: gatewayAmount, warning } = toGatewayAmount(amount, currencyCode);
    try {
      const intent = await stripe.paymentIntents.create({
        amount: gatewayAmount,
        currency: currencyCode.toLowerCase(),
        automatic_payment_methods: { enabled: true },
      });
      return res.status(201).json({
        intentId: intent.id,
        clientSecret: intent.client_secret,
        provider,
        amount,
        currencyCode,
        status: intent.status,
        warning,
      });
    } catch (err) {
      return res.status(502).json({ error: `Stripe error: ${err.message}` });
    }
  }

  if (provider === 'amazon_payment_services') {
    if (!aps.isConfigured()) {
      return res.status(503).json({
        error: 'Amazon Payment Services is not configured. Set APS_MERCHANT_IDENTIFIER, APS_ACCESS_CODE, and APS_SHA_REQUEST_PHRASE in your .env (see .env.example).',
      });
    }
    if (!customerEmail || !returnUrl) {
      return res.status(400).json({ error: 'customerEmail and returnUrl are required for Amazon Payment Services' });
    }
    try {
      const result = await aps.createPurchase({
        merchantReference: merchantReference || `order_${Date.now()}`,
        amount,
        currencyCode,
        customerEmail,
        returnUrl,
      });
      return res.status(201).json({
        provider,
        amount,
        currencyCode,
        ...result,
        warning: 'Amazon Payment Services integration has not been tested against a live endpoint — see providers/amazonPaymentServices.js for details.',
      });
    } catch (err) {
      return res.status(502).json({ error: `Amazon Payment Services error: ${err.message}` });
    }
  }

  // PayPal / Google Pay: not yet integrated with a real SDK.
  return res.status(201).json({
    intentId: `${provider}_placeholder_${Date.now()}`,
    provider,
    amount,
    currencyCode,
    status: 'requires_confirmation',
    warning: `${provider} is still a placeholder — no real gateway is wired up yet.`,
  });
});

module.exports = router;
