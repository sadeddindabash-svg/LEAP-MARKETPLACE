const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');
const { isEmailConfigured, sendEmail } = require('../email/client');

/**
 * Real, generic admin-configurable platform settings (migration 024).
 * The return window is the first real use of this — deliberately built
 * as a genuine key-value store rather than a one-off dedicated column,
 * so future simple admin-configurable values don't each need their own
 * migration and endpoint pair.
 */
const router = express.Router();

const MIN_RETURN_WINDOW_DAYS = 3;
const MAX_RETURN_WINDOW_DAYS = 7;

router.get('/return-window', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await db.query("SELECT value FROM platform_settings WHERE key = 'return_window_days'");
    res.json({ returnWindowDays: Number(rows[0]?.value ?? 7) });
  } catch (err) {
    next(err);
  }
});

// CONFIRMED constraint: a real return window between 3 and 7 days,
// admin-configurable within that real range — not an arbitrary number,
// and not unlimited (both real, deliberate decisions).
router.patch('/return-window', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { returnWindowDays } = req.body || {};
    const value = Number(returnWindowDays);
    if (!Number.isInteger(value) || value < MIN_RETURN_WINDOW_DAYS || value > MAX_RETURN_WINDOW_DAYS) {
      return res.status(400).json({ error: `returnWindowDays must be a whole number between ${MIN_RETURN_WINDOW_DAYS} and ${MAX_RETURN_WINDOW_DAYS}` });
    }
    await db.query(
      `INSERT INTO platform_settings (key, value, updated_at) VALUES ('return_window_days', $1, now())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
      [String(value)]
    );
    await logAdminAction(req, 'return_window_changed', 'platform_setting', 'return_window_days', { returnWindowDays: value });
    res.json({ returnWindowDays: value });
  } catch (err) {
    next(err);
  }
});

// CONFIRMED SCOPE (migration 025): whether a review requires a real
// verified purchase is admin-decided, not hardcoded either way.
router.get('/require-verified-purchase-for-reviews', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await db.query("SELECT value FROM platform_settings WHERE key = 'require_verified_purchase_for_reviews'");
    res.json({ requireVerifiedPurchase: rows[0]?.value === 'true' });
  } catch (err) {
    next(err);
  }
});

router.patch('/require-verified-purchase-for-reviews', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { requireVerifiedPurchase } = req.body || {};
    if (typeof requireVerifiedPurchase !== 'boolean') {
      return res.status(400).json({ error: 'requireVerifiedPurchase must be true or false' });
    }
    await db.query(
      `INSERT INTO platform_settings (key, value, updated_at) VALUES ('require_verified_purchase_for_reviews', $1, now())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
      [String(requireVerifiedPurchase)]
    );
    await logAdminAction(req, 'require_verified_purchase_toggled', 'platform_setting', 'require_verified_purchase_for_reviews', { requireVerifiedPurchase });
    res.json({ requireVerifiedPurchase });
  } catch (err) {
    next(err);
  }
});

// POST /settings/test-email — real gap closed here: an admin
// configuring real SMTP credentials had no way to verify email
// delivery actually works without waiting for a real customer event
// (an order, a shipment, a payout) to trigger a real transactional
// email first. Sends a real test email to the admin's OWN account
// email — deliberately uses sendEmail directly (which throws on
// failure), not sendTransactionalEmail (which always swallows errors
// and falls back to a console log) — an admin explicitly asking "does
// this work?" needs the real, honest answer, not a silent fallback.
router.post('/test-email', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    if (!isEmailConfigured()) {
      return res.status(400).json({ error: 'No real SMTP credentials are configured (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL) — set these environment variables first.' });
    }
    const { rows } = await db.query('SELECT email FROM users WHERE id = $1', [req.user.sub]);
    if (rows.length === 0 || !rows[0].email) {
      return res.status(400).json({ error: 'Could not find a real email address on your own admin account.' });
    }
    const recipientEmail = rows[0].email;
    await sendEmail({
      to: recipientEmail,
      subject: 'Leap — test email',
      html: `<p>This is a real test email from your Leap platform's admin settings.</p><p>If you're reading this, your real SMTP configuration is working correctly.</p>`,
      text: `This is a real test email from your Leap platform's admin settings.\n\nIf you're reading this, your real SMTP configuration is working correctly.`,
    });
    await logAdminAction(req, 'test_email_sent', 'platform_setting', 'smtp', { recipientEmail });
    res.json({ sent: true, recipientEmail });
  } catch (err) {
    // A real, honest failure reason -- not swallowed, this is exactly
    // what an admin explicitly testing SMTP needs to see (bad
    // credentials, wrong host/port, connection timeout, etc.).
    res.status(502).json({ error: `Real SMTP delivery failed: ${err.message}` });
  }
});

module.exports = router;
