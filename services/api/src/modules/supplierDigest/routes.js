const express = require('express');
const { requireAuth, requireRole } = require('../auth/middleware');
const { sendDueSupplierDigests } = require('./send');

/**
 * Real, admin-triggerable supplier digest sweep (migration 040) --
 * same reasoning as price-drop/saved-search equivalents: genuinely
 * useful for an admin who doesn't want to wait for the next real
 * scheduled tick, and for automated testing.
 */
const router = express.Router();

router.post('/check', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await sendDueSupplierDigests();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
