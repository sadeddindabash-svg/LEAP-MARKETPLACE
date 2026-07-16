const express = require('express');
const db = require('../../../db/pool');
const { requireAuth } = require('../auth/middleware');
const { getOrCreateReferralCode, MAX_REFERRAL_REWARDS_PER_REFERRER } = require('../promotions/helpers');

const router = express.Router();

// GET /referrals/me — a real buyer's own referral code (created on
// first request if they don't have one yet) plus real, honest stats:
// how many people they've referred, how many real rewards they've
// actually earned (capped at MAX_REFERRAL_REWARDS_PER_REFERRER).
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const code = await getOrCreateReferralCode(req.user.sub);
    const { rows: referralRows } = await db.query('SELECT reward_granted FROM referrals WHERE referrer_id = $1', [req.user.sub]);
    const rewardsEarned = referralRows.filter((r) => r.reward_granted).length;
    res.json({
      code,
      totalReferred: referralRows.length,
      rewardsEarned,
      maxRewards: MAX_REFERRAL_REWARDS_PER_REFERRER,
      capReached: rewardsEarned >= MAX_REFERRAL_REWARDS_PER_REFERRER,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
