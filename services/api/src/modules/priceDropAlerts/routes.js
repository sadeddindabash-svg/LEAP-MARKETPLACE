const express = require('express');
const { requireAuth, requireRole } = require('../auth/middleware');
const { checkAllWishlistedProductsForPriceDrops } = require('./check');

/**
 * Real, admin-triggerable price-drop sweep (migration 038) -- the
 * scheduled check already runs automatically every 6 real hours, but
 * an admin (or a real automated test) genuinely benefits from being
 * able to trigger one on demand, rather than waiting for the next
 * real tick.
 */
const router = express.Router();

router.post('/check', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await checkAllWishlistedProductsForPriceDrops();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
