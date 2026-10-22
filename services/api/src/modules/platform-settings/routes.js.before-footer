const express = require('express');
const { MAX_ANNOUNCEMENTS, validateAnnouncements, parseStored } = require('./announcements');
const db = require('../../../db/pool');
const { requireAuth, requireRole } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');

/**
 * Real, generic admin-configurable platform settings (migration 024).
 * The return window is the first real use of this — deliberately built
 * as a genuine key-value store rather than a one-off dedicated column,
 * so future simple admin-configurable values don't each need their own
 * migration and endpoint pair.
 */
const router = express.Router();

// The four pictures beside Parts / Brands / Models / Countries on the home page (see homePictures.js).
router.use('/home-pictures', require('./homePictures'));

// The editable texts of the home page: top bar message, headline and sub-headline, with font and size (see homeText.js).
router.use('/home-text', require('./homeText'));

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

// The moving announcement line at the top of the website's HOME page (see announcements.js). One JSON value in the same generic platform_settings store as the settings
// above. READING is public (the website shows it to every visitor, like min-app-version); only an admin can CHANGE it, and every change is written to the audit log.
router.get('/announcements', async (req, res, next) => {
  try {
    const { rows } = await db.query("SELECT value FROM platform_settings WHERE key = 'storefront_announcements'");
    res.json({ announcements: rows.length ? parseStored(rows[0].value) : [], max: MAX_ANNOUNCEMENTS });
  } catch (err) {
    next(err);
  }
});

router.patch('/announcements', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const checked = validateAnnouncements((req.body || {}).announcements);
    if (!checked.ok) return res.status(400).json({ error: checked.error });
    await db.query(
      `INSERT INTO platform_settings (key, value, updated_at) VALUES ('storefront_announcements', $1, now())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
      [JSON.stringify(checked.value)]
    );
    await logAdminAction(req, 'announcements_changed', 'platform_setting', 'storefront_announcements', { count: checked.value.length, announcements: checked.value });
    res.json({ announcements: checked.value, max: MAX_ANNOUNCEMENTS });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
