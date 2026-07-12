const express = require('express');

/**
 * Notification module — SMS / email / push for order status changes
 * (BUY-051), supplier alerts (SUP-032), etc. No provider wired up yet —
 * see Charter Section 4 for provider selection.
 */
const router = express.Router();

router.post('/send', (req, res) => {
  const { channel, to, message } = req.body || {};
  if (!channel || !to || !message) {
    return res.status(400).json({ error: 'channel, to, and message are required' });
  }
  // TODO: dispatch via the real provider (Twilio/SendGrid/FCM/etc.)
  console.log(`[notification stub] ${channel} -> ${to}: ${message}`);
  res.status(202).json({ queued: true });
});

module.exports = router;
