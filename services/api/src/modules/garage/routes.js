const express = require('express');
const db = require('../../../db/pool');
const { requireAuth } = require('../auth/middleware');

/**
 * Garage module — BUY-004, BUY-010–012. A buyer's saved vehicles, distinct
 * from the `vehicles` reference table (fitment module) — see this
 * migration's header comment (008_saved_vehicles.sql) for why conflating
 * the two would be a real bug, not just a naming nitpick.
 *
 * All routes require login — there's no guest "garage" concept, unlike
 * guest checkout; saving a vehicle only makes sense tied to an account.
 */
const router = express.Router();

function toVehicleDto(row) {
  return { id: row.id, make: row.make, model: row.model, trim: row.trim, yearsRange: row.years_range };
}

// GET /garage/me — this buyer's saved vehicles, joined with the real
// reference data (make/model/trim/yearsRange), newest-saved first.
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT v.* FROM user_saved_vehicles usv
       JOIN vehicles v ON v.id = usv.vehicle_id
       WHERE usv.buyer_id = $1
       ORDER BY usv.created_at DESC`,
      [req.user.sub]
    );
    res.json(rows.map(toVehicleDto));
  } catch (err) {
    next(err);
  }
});

// POST /garage/me  { vehicleId } — save a vehicle from the reference
// catalog to this buyer's garage. Idempotent: saving the same vehicle
// twice is a no-op, not an error.
router.post('/me', requireAuth, async (req, res, next) => {
  try {
    const { vehicleId } = req.body || {};
    if (!vehicleId) return res.status(400).json({ error: 'vehicleId is required' });

    const vehicleCheck = await db.query('SELECT * FROM vehicles WHERE id = $1', [vehicleId]);
    if (vehicleCheck.rows.length === 0) return res.status(404).json({ error: 'Vehicle not found in the reference catalog' });

    await db.query(
      `INSERT INTO user_saved_vehicles (buyer_id, vehicle_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.user.sub, vehicleId]
    );
    res.status(201).json(toVehicleDto(vehicleCheck.rows[0]));
  } catch (err) {
    next(err);
  }
});

// DELETE /garage/me/:vehicleId — remove from this buyer's garage.
// Ownership is implicit in the WHERE clause (buyer_id = req.user.sub) —
// deleting someone else's saved-vehicle row is a no-op, not an error that
// would confirm whether that row exists for another buyer.
router.delete('/me/:vehicleId', requireAuth, async (req, res, next) => {
  try {
    await db.query('DELETE FROM user_saved_vehicles WHERE buyer_id = $1 AND vehicle_id = $2', [req.user.sub, req.params.vehicleId]);
    const { rows } = await db.query(
      `SELECT v.* FROM user_saved_vehicles usv JOIN vehicles v ON v.id = usv.vehicle_id WHERE usv.buyer_id = $1 ORDER BY usv.created_at DESC`,
      [req.user.sub]
    );
    res.json(rows.map(toVehicleDto));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
