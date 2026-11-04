const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { profitReport } = require('./service');

// Financial -> Profits (admin). GET /profits?period=day|week|month|quarter|year&date=YYYY-MM-DD: the period (Riyadh time, weeks Saturday to Friday)
// that contains the date, today when there is none. See ./service.js for the formula.
const router = express.Router();

router.get('/', requireAuth, requireRole('admin'), requirePageAccess('profits'), async (req, res, next) => {
  try {
    res.json(await profitReport(db, { kind: req.query.period || 'month', date: req.query.date || undefined }));
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
