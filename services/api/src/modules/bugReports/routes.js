const express = require('express');
const db = require('../../../db/pool');
const { optionalAuth } = require('../auth/middleware');

const router = express.Router();

// POST /bug-reports { description, screenshotUrl?, deviceInfo? } (#139)
// -- real submission, optionalAuth so a real guest can report a bug
// too. screenshotUrl is a real URL from the existing real generic
// upload endpoint (never generated here); deviceInfo is a real
// OS/app-version string the real device itself sends, never
// fabricated server-side.
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const { description, screenshotUrl, deviceInfo } = req.body || {};
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'description is required' });
    }
    const { rows } = await db.query(
      `INSERT INTO bug_reports (user_id, description, screenshot_url, device_info) VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [req.user?.sub || null, description.trim(), screenshotUrl || null, deviceInfo || null]
    );
    res.status(201).json({ id: rows[0].id, createdAt: rows[0].created_at });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
