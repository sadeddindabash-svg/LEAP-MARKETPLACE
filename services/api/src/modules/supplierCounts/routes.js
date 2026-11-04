const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole } = require('../auth/middleware');
const { countsFor, markMessagesRead } = require('./service');

// The supplier portal's side-menu numbers (see ./service.js). GET /supplier-counts/me; POST /supplier-counts/me/messages-read when Messages opens.
const router = express.Router();

router.get('/me', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try { res.json(await countsFor(db, req.user.supplierId)); } catch (err) { next(err); }
});

router.post('/me/messages-read', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try { await markMessagesRead(db, req.user.supplierId); res.json(await countsFor(db, req.user.supplierId)); } catch (err) { next(err); }
});

module.exports = router;
