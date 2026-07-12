const express = require('express');
const db = require('../../../db/pool');

/**
 * Fitment module — Year/Make/Model/Trim reference data (Phase 1, BUY-010).
 * VIN decoding (Phase 2, BUY-014) depends on a licensed data provider — see
 * SRS Section 11, Appendix item 3 — and is intentionally not implemented
 * here yet.
 *
 * Backed by a real PostgreSQL database (see db/migrations/001_init.sql).
 */
const router = express.Router();

function toVehicleDto(row) {
  return { id: row.id, make: row.make, model: row.model, trim: row.trim, yearsRange: row.years_range };
}

router.get('/makes', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT DISTINCT make FROM vehicles ORDER BY make');
    res.json(rows.map((r) => r.make));
  } catch (err) {
    next(err);
  }
});

router.get('/vehicles', async (req, res, next) => {
  try {
    const { make } = req.query;
    const { rows } = make
      ? await db.query('SELECT * FROM vehicles WHERE make = $1 ORDER BY model', [make])
      : await db.query('SELECT * FROM vehicles ORDER BY make, model');
    res.json(rows.map(toVehicleDto));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
