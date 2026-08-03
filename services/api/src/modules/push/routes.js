const express = require('express');
const router = express.Router();
const db = require('../../../db/pool');
const { requireAuth } = require('../auth/middleware');

/**
 * Real device-token registration, called once the real mobile app has
 * obtained a real FCM token from Firebase (see
 * apps/mobile/lib/core/push_state.dart for the calling side). Upserts
 * rather than always inserting -- re-registering the same real token
 * (e.g. simply reopening the app) updates this row's own timestamp
 * instead of creating a duplicate, via migration 049's own real
 * unique constraint on (user_id, token).
 */
router.post('/register-device', requireAuth, async (req, res, next) => {
  try {
    const { token, platform } = req.body || {};
    if (!token || !platform || !['android', 'ios', 'web'].includes(platform)) {
      return res.status(400).json({ error: 'token and a valid platform (android, ios, or web) are required' });
    }
    await db.query(
      `INSERT INTO device_tokens (user_id, token, platform) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, token) DO UPDATE SET created_at = now()`,
      [req.user.id, token, platform]
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/**
 * Real device-token removal, called on real logout -- a device that's
 * no longer signed in as this real user shouldn't keep receiving this
 * real user's own push notifications.
 */
router.delete('/register-device', requireAuth, async (req, res, next) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'token is required' });
    await db.query('DELETE FROM device_tokens WHERE user_id = $1 AND token = $2', [req.user.id, token]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
