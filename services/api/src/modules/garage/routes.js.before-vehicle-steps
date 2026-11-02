const express = require('express');
const db = require('../../../db/pool');
const { requireAuth } = require('../auth/middleware');

// How many cars one buyer can save. The website (lib/garage.ts) and the mobile app (garage_screen.dart) hold the same number to show "3 of 5"; tests fail if they
// ever disagree. The message is written out WORD FOR WORD because the app and the website translate it by matching this exact text (a test finds it here).
const MAX_GARAGE_VEHICLES = 5;
// Shown when a car is saved without its version although its year has versions (the website and the app translate it by matching this exact text).
const CHOOSE_VERSION_MESSAGE = 'Choose the version of this car';
const GARAGE_FULL_MESSAGE = 'You can save up to 5 vehicles. Remove one to add another.';

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
    // Real Arabic brand name (new) -- nullable, not every brand has
    // one yet (migration 046). Closes a real gap: My Garage always
    // showed the English name regardless of the app's own language.
    brandAr: row.brand_name_ar,
    model: row.model_name,
    // Real Arabic model name (new, migration 062) -- nullable, models
    // never required this field at all.
    modelAr: row.model_name_ar,
    generation: row.generation_name,
    yearStart: row.year_start,
    yearEnd: row.year_end,
    // Real default-vehicle flag (new, migration 047) -- which single
    // saved vehicle drives automatic fitment filtering (the home feed)
    // when a buyer has more than one.
    isDefault: row.is_default,
    // The VERSION of the car (a row of vehicle_versions): null for a car saved before versions existed, and for a year that has no versions.
    // versionCount says how many versions this car's year has, so the app can offer "Choose its version" to a car that has none yet.
    versionId: row.version_id || null,
    version: row.version_id ? { id: row.version_id, name: row.version_name, nameAr: row.version_name_ar, engine: row.version_engine, engineAr: row.version_engine_ar, seats: row.version_seats, photoUrl: row.version_photo_url || null } : null,
    versionCount: row.version_count,
    // Brand photo: every brand added since migration 046 has one (required); nullable only for brands that predate it. Callers must handle null.
    brandPhotoUrl: row.brand_photo_url,
    // Model photo (migration 061): models no longer take a photo in Vehicle Data, so this is only an old value kept in the database. The buyer app
    // ignores it: a vehicle's picture is its YEAR photo, else its BRAND photo (see Vehicle.heroPhotoUrl in the app).
    modelPhotoUrl: row.model_photo_url,
    // Real year photo (migration 102): the first choice for the vehicle's picture. Nullable (years that predate it have none): callers fall back
    // to the brand's photo, then a generic icon.
    generationPhotoUrl: row.generation_photo_url,
  };
}

const SAVED_GENERATION_SELECT = `
  SELECT usg.generation_id, usg.year, usg.is_default, vg.name AS generation_name, vg.year_start, vg.year_end, vg.photo_url AS generation_photo_url,
         vm.name AS model_name, vm.name_ar AS model_name_ar, vm.photo_url AS model_photo_url,
         vb.name AS brand_name, vb.name_ar AS brand_name_ar, vb.photo_url AS brand_photo_url,
    usg.version_id, ver.name AS version_name, ver.name_ar AS version_name_ar, ver.engine AS version_engine, ver.engine_ar AS version_engine_ar,
    ver.seats AS version_seats, ver.photo_url AS version_photo_url,
    (SELECT COUNT(*)::int FROM vehicle_versions vv WHERE vv.generation_id = usg.generation_id) AS version_count
  FROM user_saved_generations usg
  JOIN vehicle_generations vg ON vg.id = usg.generation_id
  JOIN vehicle_models vm ON vm.id = vg.model_id
  JOIN vehicle_brands vb ON vb.id = vm.brand_id
    LEFT JOIN vehicle_versions ver ON ver.id = usg.version_id
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
    const versionId = (req.body || {}).versionId || null;
    if (!generationId || !year) return res.status(400).json({ error: 'generationId and year are required' });

    const { rows: genRows } = await db.query('SELECT * FROM vehicle_generations WHERE id = $1', [generationId]);
    if (genRows.length === 0) return res.status(404).json({ error: 'Vehicle generation not found in the reference catalog' });
    const gen = genRows[0];
    const yearNum = Number(year);
    if (yearNum < gen.year_start || (gen.year_end !== null && yearNum > gen.year_end)) {
      return res.status(400).json({ error: `${yearNum} is outside this generation's real year range` });
    }

    // A buyer can save up to MAX_GARAGE_VEHICLES cars. The count and the insert happen in ONE transaction, and one buyer's adds are taken one after the other
    // (an advisory lock on the buyer): without that, two quick taps could both read "4 cars" and both save, leaving 6. Saving a car the buyer ALREADY has is not
    // an error and not a new car, so it is allowed even when the garage is full. A buyer who had MORE than the limit before it existed keeps their cars (nothing is
    // deleted); they simply cannot add another until they are below it.
    // A year that has versions needs one chosen (the car is the exact version the buyer owns); a year without versions takes none.
    const { rows: versionRows } = await db.query('SELECT id FROM vehicle_versions WHERE generation_id = $1', [generationId]);
    if (versionId && !versionRows.some((v) => v.id === versionId)) return res.status(400).json({ error: 'That version does not belong to this year' });
    if (!versionId && versionRows.length > 0) return res.status(400).json({ error: CHOOSE_VERSION_MESSAGE });
    const client = await db.getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`garage:${req.user.sub}`]);
      const { rows: saved } = await client.query('SELECT generation_id, year, version_id FROM user_saved_generations WHERE buyer_id = $1', [req.user.sub]);
      const alreadySaved = saved.some((r) => r.generation_id === generationId && Number(r.year) === yearNum && (r.version_id || null) === versionId);
      if (!alreadySaved && saved.length >= MAX_GARAGE_VEHICLES) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: GARAGE_FULL_MESSAGE });
      }
      // Real, reasonable default (new) -- a buyer's very FIRST saved vehicle automatically becomes their real default, since there's no meaningful choice to
      // make with only one. Decided from the same rows counted above, so it genuinely reflects "had zero before this."
      const isFirstVehicle = saved.length === 0;
      await client.query(
        `INSERT INTO user_saved_generations (buyer_id, generation_id, year, version_id, is_default) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [req.user.sub, generationId, yearNum, versionId, isFirstVehicle]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    const { rows } = await db.query(
      `${SAVED_GENERATION_SELECT} WHERE usg.buyer_id = $1 AND usg.generation_id = $2 AND usg.year = $3 AND usg.version_id IS NOT DISTINCT FROM $4`,
      [req.user.sub, generationId, yearNum, versionId]
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
    const versionId = req.query.versionId || null;
    await client.query('BEGIN');
    const { rows: ownershipCheck } = await client.query(
      'SELECT 1 FROM user_saved_generations WHERE buyer_id = $1 AND generation_id = $2 AND year = $3 AND version_id IS NOT DISTINCT FROM $4',
      [req.user.sub, req.params.generationId, Number(req.params.year), versionId]
    );
    if (ownershipCheck.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Saved vehicle not found' });
    }
    await client.query('UPDATE user_saved_generations SET is_default = false WHERE buyer_id = $1', [req.user.sub]);
    await client.query(
      'UPDATE user_saved_generations SET is_default = true WHERE buyer_id = $1 AND generation_id = $2 AND year = $3 AND version_id IS NOT DISTINCT FROM $4',
      [req.user.sub, req.params.generationId, Number(req.params.year), versionId]
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
      'DELETE FROM user_saved_generations WHERE buyer_id = $1 AND generation_id = $2 AND year = $3 AND version_id IS NOT DISTINCT FROM $4 RETURNING is_default',
      [req.user.sub, req.params.generationId, Number(req.params.year), req.query.versionId || null]
    );
    // Real auto-promotion (new) -- if the real vehicle just removed WAS
    // the buyer's real default, a real remaining vehicle (if any)
    // becomes the new default automatically, rather than silently
    // leaving the buyer with none at all until they notice and pick
    // one themselves.
    if (deletedRows.length > 0 && deletedRows[0].is_default) {
      await db.query(
        `UPDATE user_saved_generations SET is_default = true
         WHERE buyer_id = $1 AND (generation_id, year, COALESCE(version_id, '')) = (
           SELECT generation_id, year, COALESCE(version_id, '') FROM user_saved_generations WHERE buyer_id = $1 ORDER BY created_at DESC LIMIT 1
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

// PATCH /garage/me/:generationId/:year/version  { versionId }  -- gives a car saved BEFORE versions existed (a car with no version) its version. Only a car that has none can
// be given one (to change a version, remove the car and add it again); the version must belong to the car's year; and the buyer cannot end up with the same car twice.
router.patch('/me/:generationId/:year/version', requireAuth, async (req, res, next) => {
  try {
    const versionId = (req.body || {}).versionId || null;
    if (!versionId) return res.status(400).json({ error: 'versionId is required' });
    const { generationId } = req.params; const yearNum = Number(req.params.year);
    const { rows: ok } = await db.query('SELECT 1 FROM vehicle_versions WHERE id = $1 AND generation_id = $2', [versionId, generationId]);
    if (ok.length === 0) return res.status(400).json({ error: 'That version does not belong to this year' });
    const { rows: own } = await db.query('SELECT version_id FROM user_saved_generations WHERE buyer_id = $1 AND generation_id = $2 AND year = $3 ORDER BY (version_id IS NULL) DESC', [req.user.sub, generationId, yearNum]);
    if (own.length === 0) return res.status(404).json({ error: 'Saved vehicle not found' });
    if (own.some((r) => r.version_id === versionId)) return res.status(409).json({ error: 'You already have this car with that version' });
    if (!own.some((r) => r.version_id === null)) return res.status(409).json({ error: 'This car already has a version' });
    await db.query('UPDATE user_saved_generations SET version_id = $4 WHERE buyer_id = $1 AND generation_id = $2 AND year = $3 AND version_id IS NULL', [req.user.sub, generationId, yearNum, versionId]);
    const { rows } = await db.query(`${SAVED_GENERATION_SELECT} WHERE usg.buyer_id = $1 ORDER BY usg.created_at DESC`, [req.user.sub]);
    res.json(rows.map(toSavedGenerationDto));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.MAX_GARAGE_VEHICLES = MAX_GARAGE_VEHICLES;
module.exports.GARAGE_FULL_MESSAGE = GARAGE_FULL_MESSAGE;
module.exports.CHOOSE_VERSION_MESSAGE = CHOOSE_VERSION_MESSAGE;
