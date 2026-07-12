const express = require('express');

/**
 * Payment module — BUY-040–044. Abstracts Stripe/PayPal/Google Pay/card
 * networks behind one interface so the rest of the system doesn't care
 * which gateway processed a given transaction, and region-specific methods
 * (e.g. Mada) can be added later as new provider plugins rather than
 * scattered if/else branches.
 *
 * This is a stub — no real gateway is wired up yet. Do not use this for
 * anything beyond local development.
 */
const router = express.Router();

const PROVIDERS = ['stripe', 'paypal', 'google_pay'];
// Add region-specific providers here once approved (see Charter Section 1,
// "Payment methods per country") — e.g. 'mada', 'alipay'.

router.get('/methods', (req, res) => {
  res.json({ providers: PROVIDERS });
});

// POST /payment/intent  { provider, amount, currencyCode }
router.post('/intent', (req, res) => {
  const { provider, amount, currencyCode } = req.body || {};
  if (!PROVIDERS.includes(provider)) {
    return res.status(400).json({ error: `Unsupported provider. Use one of: ${PROVIDERS.join(', ')}` });
  }
  if (!amount || !currencyCode) {
    return res.status(400).json({ error: 'amount and currencyCode are required' });
  }
  // TODO: call the real gateway SDK here (e.g. stripe.paymentIntents.create).
  res.status(201).json({
    intentId: `pi_placeholder_${Date.now()}`,
    provider,
    amount,
    currencyCode,
    status: 'requires_confirmation',
  });
});

module.exports = router;
