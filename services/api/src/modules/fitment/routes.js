const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');

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

// ============================================================
// Structured fitment cascade (migration 010) — Brand -> Model ->
// Generation -> Year/Engine/Transmission, used by the supplier product-
// submission form. SEPARATE from the /makes and /vehicles endpoints
// above, which serve the buyer-facing Garage feature and basic catalog
// filter against the flatter `vehicles` table — see this migration's
// header comment for why the two coexist rather than one replacing
// the other.
// ============================================================

router.get('/brands', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM vehicle_brands ORDER BY name');
    res.json(rows.map((r) => ({ id: r.id, name: r.name })));
  } catch (err) {
    next(err);
  }
});

router.get('/brands/:brandId/models', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM vehicle_models WHERE brand_id = $1 ORDER BY name', [req.params.brandId]);
    res.json(rows.map((r) => ({ id: r.id, brandId: r.brand_id, name: r.name })));
  } catch (err) {
    next(err);
  }
});

router.get('/models/:modelId/generations', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM vehicle_generations WHERE model_id = $1 ORDER BY year_start', [req.params.modelId]);
    res.json(rows.map((r) => ({ id: r.id, modelId: r.model_id, name: r.name, yearStart: r.year_start, yearEnd: r.year_end })));
  } catch (err) {
    next(err);
  }
});

router.get('/generations/:generationId/engines', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM vehicle_engines WHERE generation_id = $1 ORDER BY name', [req.params.generationId]);
    res.json(rows.map((r) => ({ id: r.id, generationId: r.generation_id, name: r.name })));
  } catch (err) {
    next(err);
  }
});

router.get('/generations/:generationId/transmissions', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM vehicle_transmissions WHERE generation_id = $1 ORDER BY name', [req.params.generationId]);
    res.json(rows.map((r) => ({ id: r.id, generationId: r.generation_id, name: r.name })));
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Admin-only management of the fitment cascade reference data (ADM-ish,
// new). Without this, the cascade could ONLY ever contain whatever was
// hardcoded into db/seed.js — a supplier needing to submit a product for
// a vehicle not in that small seeded list would have no way to add it.
// This closes that gap: an admin can add a new brand/model/generation/
// engine/transmission, or remove one, directly from the admin dashboard.
//
// Deletion deliberately does NOT cascade through to real product data —
// vehicle_generations has no ON DELETE CASCADE from
// product_fitment_entries (see migration 010), so attempting to delete a
// generation/brand/model that real products actually reference fails
// with a real foreign-key error, which these routes turn into a clear
// 409 rather than a raw Postgres error leaking through. Deleting a
// brand/model DOES cascade to ITS OWN children (models under it,
// generations under those, etc. — see migration 010's ON DELETE CASCADE
// clauses) since those are just organizational nesting, not real product
// references.
// ============================================================

function isForeignKeyViolation(err) {
  return err && err.code === '23503'; // Postgres FK violation
}
function isUniqueViolation(err) {
  return err && err.code === '23505'; // Postgres unique constraint violation
}

// POST /fitment/brands  { name }
router.post('/brands', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    const id = `brand_${Date.now()}`;
    await db.query('INSERT INTO vehicle_brands (id, name) VALUES ($1, $2)', [id, name.trim()]);
    res.status(201).json({ id, name: name.trim() });
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ error: `A brand named "${req.body.name}" already exists` });
    next(err);
  }
});

// DELETE /fitment/brands/:id
router.delete('/brands/:id', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { rowCount } = await db.query('DELETE FROM vehicle_brands WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Brand not found' });
    res.status(204).end();
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return res.status(409).json({ error: 'Cannot delete — one or more real products reference a model/generation under this brand. Remove those first.' });
    }
    next(err);
  }
});

// POST /fitment/brands/:brandId/models  { name }
router.post('/brands/:brandId/models', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    const brandCheck = await db.query('SELECT id FROM vehicle_brands WHERE id = $1', [req.params.brandId]);
    if (brandCheck.rows.length === 0) return res.status(404).json({ error: 'Brand not found' });
    const id = `model_${Date.now()}`;
    await db.query('INSERT INTO vehicle_models (id, brand_id, name) VALUES ($1, $2, $3)', [id, req.params.brandId, name.trim()]);
    res.status(201).json({ id, brandId: req.params.brandId, name: name.trim() });
  } catch (err) {
    next(err);
  }
});

// DELETE /fitment/models/:id
router.delete('/models/:id', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { rowCount } = await db.query('DELETE FROM vehicle_models WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Model not found' });
    res.status(204).end();
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return res.status(409).json({ error: 'Cannot delete — one or more real products reference a generation under this model. Remove those first.' });
    }
    next(err);
  }
});

// POST /fitment/models/:modelId/generations  { name, yearStart, yearEnd? }
router.post('/models/:modelId/generations', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { name, yearStart, yearEnd } = req.body || {};
    if (!name || !name.trim() || !yearStart) return res.status(400).json({ error: 'name and yearStart are required' });
    if (yearEnd && yearEnd < yearStart) return res.status(400).json({ error: 'yearEnd cannot be before yearStart' });
    const modelCheck = await db.query('SELECT id FROM vehicle_models WHERE id = $1', [req.params.modelId]);
    if (modelCheck.rows.length === 0) return res.status(404).json({ error: 'Model not found' });
    const id = `gen_${Date.now()}`;
    await db.query(
      'INSERT INTO vehicle_generations (id, model_id, name, year_start, year_end) VALUES ($1, $2, $3, $4, $5)',
      [id, req.params.modelId, name.trim(), yearStart, yearEnd || null]
    );
    res.status(201).json({ id, modelId: req.params.modelId, name: name.trim(), yearStart, yearEnd: yearEnd || null });
  } catch (err) {
    next(err);
  }
});

// DELETE /fitment/generations/:id
router.delete('/generations/:id', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { rowCount } = await db.query('DELETE FROM vehicle_generations WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Generation not found' });
    res.status(204).end();
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return res.status(409).json({ error: 'Cannot delete — one or more real products reference this generation (directly, or via an engine/transmission under it). Remove those first.' });
    }
    next(err);
  }
});

// POST /fitment/generations/:generationId/engines  { name }
router.post('/generations/:generationId/engines', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    const genCheck = await db.query('SELECT id FROM vehicle_generations WHERE id = $1', [req.params.generationId]);
    if (genCheck.rows.length === 0) return res.status(404).json({ error: 'Generation not found' });
    const id = `eng_${Date.now()}`;
    await db.query('INSERT INTO vehicle_engines (id, generation_id, name) VALUES ($1, $2, $3)', [id, req.params.generationId, name.trim()]);
    res.status(201).json({ id, generationId: req.params.generationId, name: name.trim() });
  } catch (err) {
    next(err);
  }
});

// DELETE /fitment/engines/:id
router.delete('/engines/:id', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { rowCount } = await db.query('DELETE FROM vehicle_engines WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Engine not found' });
    res.status(204).end();
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return res.status(409).json({ error: 'Cannot delete — one or more real products reference this engine. Remove those first.' });
    }
    next(err);
  }
});

// POST /fitment/generations/:generationId/transmissions  { name }
router.post('/generations/:generationId/transmissions', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    const genCheck = await db.query('SELECT id FROM vehicle_generations WHERE id = $1', [req.params.generationId]);
    if (genCheck.rows.length === 0) return res.status(404).json({ error: 'Generation not found' });
    const id = `trans_${Date.now()}`;
    await db.query('INSERT INTO vehicle_transmissions (id, generation_id, name) VALUES ($1, $2, $3)', [id, req.params.generationId, name.trim()]);
    res.status(201).json({ id, generationId: req.params.generationId, name: name.trim() });
  } catch (err) {
    next(err);
  }
});

// DELETE /fitment/transmissions/:id
router.delete('/transmissions/:id', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { rowCount } = await db.query('DELETE FROM vehicle_transmissions WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Transmission not found' });
    res.status(204).end();
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return res.status(409).json({ error: 'Cannot delete — one or more real products reference this transmission. Remove those first.' });
    }
    next(err);
  }
});

module.exports = router;
