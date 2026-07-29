const express = require('express');
const db = require('../../../db/pool');
const { requireAuth } = require('../auth/middleware');

/**
 * Garage module — BUY-004, BUY-010–012. A buyer's saved vehicles.
 *
 * REAL BUG FOUND AND FIXED HERE (migration 044): this module used to
 * save against the flat `vehicles` reference table (migration 008) --
 * but nothing in this codebase ever writes a row into `product_fitment`,
 * the join table that flat table would need to actually match real
 * products. Every real product's fitment lives only in
 * product_fitment_entries, the structured Brand->Model->Generation
 * cascade (migration 010) -- the same real, populated system the
 * search vehicle filter already uses. Rebuilt on top of that instead.
 *
 * All routes require login — there's no guest "garage" concept, unlike
 * guest checkout; saving a vehicle only makes sense tied to an account.
 */
const router = express.Router();

function toSavedGenerationDto(row) {
  return {
    generationId: row.generation_id,
    year: row.year,
    brand: row.brand_name,
    model: row.model_name,
    generation: row.generation_name,
    yearStart: row.year_start,
    yearEnd: row.year_end,
    // Real default-vehicle flag (new, migration 047) -- which single
    // saved vehicle drives automatic fitment filtering (the home feed)
    // when a buyer has more than one.
    isDefault: row.is_default,
  };
}

const SAVED_GENERATION_SELECT = `
  SELECT usg.generation_id, usg.year, usg.is_default, vg.name AS generation_name, vg.year_start, vg.year_end,
         vm.name AS model_name, vb.name AS brand_name
  FROM user_saved_generations usg
  JOIN vehicle_generations vg ON vg.id = usg.generation_id
  JOIN vehicle_models vm ON vm.id = vg.model_id
  JOIN vehicle_brands vb ON vb.id = vm.brand_id
`;

// GET /garage/me — this buyer's saved vehicles, joined with the real
// structured cascade, newest-saved first.
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `${SAVED_GENERATION_SELECT} WHERE usg.buyer_id = $1 ORDER BY usg.created_at DESC`,
      [req.user.sub]
    );
    res.json(rows.map(toSavedGenerationDto));
  } catch (err) {
    next(err);
  }
});

// POST /garage/me  { generationId, year } — save a specific
// generation+year to this buyer's garage. Idempotent: saving the same
// one twice is a no-op, not an error. Validates the year genuinely
// falls within that generation's real range (a still-in-production
// generation has no upper bound to check against).
router.post('/me', requireAuth, async (req, res, next) => {
  try {
    const { generationId, year } = req.body || {};
    if (!generationId || !year) return res.status(400).json({ error: 'generationId and year are required' });

    const { rows: genRows } = await db.query('SELECT * FROM vehicle_generations WHERE id = $1', [generationId]);
    if (genRows.length === 0) return res.status(404).json({ error: 'Vehicle generation not found in the reference catalog' });
    const gen = genRows[0];
    const yearNum = Number(year);
    if (yearNum < gen.year_start || (gen.year_end !== null && yearNum > gen.year_end)) {
      return res.status(400).json({ error: `${yearNum} is outside this generation's real year range` });
    }

    // Real, reasonable default (new) -- a buyer's very FIRST saved
    // vehicle automatically becomes their real default, since there's
    // no meaningful choice to make with only one. Checked BEFORE the
    // insert below so this genuinely reflects "had zero before this."
    const { rows: existingRows } = await db.query('SELECT 1 FROM user_saved_generations WHERE buyer_id = $1 LIMIT 1', [req.user.sub]);
    const isFirstVehicle = existingRows.length === 0;

    await db.query(
      `INSERT INTO user_saved_generations (buyer_id, generation_id, year, is_default) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [req.user.sub, generationId, yearNum, isFirstVehicle]
    );
    const { rows } = await db.query(
      `${SAVED_GENERATION_SELECT} WHERE usg.buyer_id = $1 AND usg.generation_id = $2 AND usg.year = $3`,
      [req.user.sub, generationId, yearNum]
    );
    res.status(201).json(toSavedGenerationDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

// PATCH /garage/me/:generationId/:year/default — sets this one real
// vehicle as the buyer's real default, unsetting any other real
// default first. Both real writes happen in a single real
// transaction -- a buyer should never briefly have zero or two real
// defaults if a request fails partway through.
router.patch('/me/:generationId/:year/default', requireAuth, async (req, res, next) => {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    const { rows: ownershipCheck } = await client.query(
      'SELECT 1 FROM user_saved_generations WHERE buyer_id = $1 AND generation_id = $2 AND year = $3',
      [req.user.sub, req.params.generationId, Number(req.params.year)]
    );
    if (ownershipCheck.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Saved vehicle not found' });
    }
    await client.query('UPDATE user_saved_generations SET is_default = false WHERE buyer_id = $1', [req.user.sub]);
    await client.query(
      'UPDATE user_saved_generations SET is_default = true WHERE buyer_id = $1 AND generation_id = $2 AND year = $3',
      [req.user.sub, req.params.generationId, Number(req.params.year)]
    );
    await client.query('COMMIT');

    const { rows } = await db.query(
      `${SAVED_GENERATION_SELECT} WHERE usg.buyer_id = $1 ORDER BY usg.created_at DESC`,
      [req.user.sub]
    );
    res.json(rows.map(toSavedGenerationDto));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// DELETE /garage/me/:generationId/:year — remove from this buyer's
// garage. Ownership is implicit in the WHERE clause (buyer_id =
// req.user.sub) — deleting someone else's saved-vehicle row is a
// no-op, not an error that would confirm whether that row exists for
// another buyer.
router.delete('/me/:generationId/:year', requireAuth, async (req, res, next) => {
  try {
    const { rows: deletedRows } = await db.query(
      'DELETE FROM user_saved_generations WHERE buyer_id = $1 AND generation_id = $2 AND year = $3 RETURNING is_default',
      [req.user.sub, req.params.generationId, Number(req.params.year)]
    );
    // Real auto-promotion (new) -- if the real vehicle just removed WAS
    // the buyer's real default, a real remaining vehicle (if any)
    // becomes the new default automatically, rather than silently
    // leaving the buyer with none at all until they notice and pick
    // one themselves.
    if (deletedRows.length > 0 && deletedRows[0].is_default) {
      await db.query(
        `UPDATE user_saved_generations SET is_default = true
         WHERE buyer_id = $1 AND (generation_id, year) = (
           SELECT generation_id, year FROM user_saved_generations WHERE buyer_id = $1 ORDER BY created_at DESC LIMIT 1
         )`,
        [req.user.sub]
      );
    }
    const { rows } = await db.query(
      `${SAVED_GENERATION_SELECT} WHERE usg.buyer_id = $1 ORDER BY usg.created_at DESC`,
      [req.user.sub]
    );
    res.json(rows.map(toSavedGenerationDto));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
