const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { getLoyaltyStatus } = require('./helpers');

// Loyalty module -- confirmed with the person through several rounds
// of design: a real, spend-based buyer tier system. GET /me is the
// account page's own real data source (current tier, progress to the
// next real tier, and the full real tier list for the "My Tier"
// detail screen) -- requires a real, logged-in buyer, since lifetime
// spend only has meaning tied to a real account, not a guest session.
const router = express.Router();

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const status = await getLoyaltyStatus(req.user.sub);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
