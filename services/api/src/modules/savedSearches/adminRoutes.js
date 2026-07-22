const express = require('express');
const { requireAuth, requireRole } = require('../auth/middleware');
const { checkAllSavedSearches } = require('./check');

/**
 * Real, admin-triggerable saved-search sweep (migration 039) -- same
 * reasoning as the price-drop equivalent: genuinely useful for an
 * admin who doesn't want to wait for the next real scheduled tick,
 * and for automated testing.
 */
const router = express.Router();

router.post('/check', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await checkAllSavedSearches();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
