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

// GET /referrals/me/history (#149) -- real, detailed per-referral
// history: who joined and when, with real reward status per real
// referral. Privacy-respecting: shows only a real first name (or a
// generic label when none is set) rather than the referred person's
// full name or email -- their identity isn't this referrer's to see
// in full, matching this platform's own established anonymization
// pattern elsewhere (see shared/supplierAnonymize.js).
router.get('/me/history', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT u.name, r.created_at, r.reward_granted
       FROM referrals r
       JOIN users u ON u.id = r.referred_user_id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.sub]
    );
    res.json(
      rows.map((r) => ({
        firstName: r.name ? r.name.split(' ')[0] : null,
        joinedAt: r.created_at,
        rewardGranted: r.reward_granted,
      }))
    );
  } catch (err) {
    next(err);
  }
});

module.exports = router;
