const express = require('express');
const db = require('../../../db/pool');
const { requireAuth } = require('../auth/middleware');
const { localize, normalizeLanguage, isSupportedLanguage } = require('./i18n');

/**
 * Real notifications (migration 019, extended by 020/037/038/039/045).
 * This module is just the buyer/supplier-facing read side (list,
 * unread count, mark read); creation happens via helpers.js's
 * createNotification(), called from the real modules where those
 * events actually occur — see that file's own header comment for the
 * real, current, complete list of every trigger point (this used to
 * say "the 4 real trigger points," a stale count left uncorrected as
 * 5 more were added over time).
 */
const router = express.Router();

// `lang` is 'ar' or 'en' (anything else is English). A notification with no Arabic text is shown in English, field by field.
function toNotificationDto(row, lang) {
  const { title, body } = localize({ title: row.title, body: row.body, titleAr: row.title_ar, bodyAr: row.body_ar }, lang);
  return {
    id: row.id,
    type: row.type,
    title,
    body,
    linkType: row.link_type,
    linkId: row.link_id,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

// The app says which language it is showing (?lang=ar|en). Remembering it on the user lets a PUSH notification, which is sent when an
  // event happens with no app request to ask, still be sent in that language. Only a clear 'ar' or 'en' is stored; anything else is ignored.
async function rememberLanguage(userId, lang) {
  if (!isSupportedLanguage(lang)) return;
  await db.query('UPDATE users SET language = $1 WHERE id = $2 AND language IS DISTINCT FROM $1', [lang, userId]);
}

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const lang = normalizeLanguage(req.query.lang);
    await rememberLanguage(req.user.sub, req.query.lang);
    const { rows } = await db.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.sub]
    );
    res.json(rows.map((r) => toNotificationDto(r, lang)));
  } catch (err) {
    next(err);
  }
});

// A real, specific unread count — powers the bell icon's badge without
// the caller needing to fetch and count the entire real list just to
// show a number.
router.get('/me/unread-count', requireAuth, async (req, res, next) => {
  try {
    await rememberLanguage(req.user.sub, req.query.lang); // the app polls this often, so it keeps the remembered language current
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
    res.json(toNotificationDto(rows[0], normalizeLanguage(req.query.lang)));
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
