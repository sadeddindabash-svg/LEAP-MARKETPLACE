const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole } = require('../auth/middleware');

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
    res.json({ returnWindowDays: value });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
