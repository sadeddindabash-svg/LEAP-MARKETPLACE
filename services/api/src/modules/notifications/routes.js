const express = require('express');
const db = require('../../../db/pool');
const { requireAuth } = require('../auth/middleware');

/**
 * Real notifications (migration 019). Triggered by real order changes
 * and message/ticket replies — see the 4 real trigger points listed in
 * that migration's header comment. This module is just the buyer/
 * supplier-facing read side (list, unread count, mark read); creation
 * happens via helpers.js's createNotification(), called from the real
 * modules where those events actually occur.
 */
const router = express.Router();

function toNotificationDto(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    linkType: row.link_type,
    linkId: row.link_id,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.sub]
    );
    res.json(rows.map(toNotificationDto));
  } catch (err) {
    next(err);
  }
});

// A real, specific unread count — powers the bell icon's badge without
// the caller needing to fetch and count the entire real list just to
// show a number.
router.get('/me/unread-count', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.sub]
    );
    res.json({ count: Number(rows[0].count) });
  } catch (err) {
    next(err);
  }
});

router.patch('/me/:id/read', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.sub]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json(toNotificationDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.patch('/me/read-all', requireAuth, async (req, res, next) => {
  try {
    await db.query('UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false', [req.user.sub]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
