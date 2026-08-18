const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');
const { moveItem } = require('../../lib/reorder');

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
    const { rows } = await db.query('SELECT * FROM vehicle_brands ORDER BY sort_order ASC');
    // nameAr/photoUrl (new, migration 046) -- may be null for a brand
    // created before this requirement existed; a real, honest gap for
    // old data, not hidden.
    res.json(rows.map((r) => ({ id: r.id, name: r.name, nameAr: r.name_ar, photoUrl: r.photo_url, sortOrder: r.sort_order })));
  } catch (err) {
    next(err);
  }
});

router.get('/brands/:brandId/models', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM vehicle_models WHERE brand_id = $1 ORDER BY sort_order ASC', [req.params.brandId]);
    res.json(rows.map((r) => ({ id: r.id, brandId: r.brand_id, name: r.name, sortOrder: r.sort_order })));
  } catch (err) {
    next(err);
  }
});

router.get('/models/:modelId/generations', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM vehicle_generations WHERE model_id = $1 ORDER BY sort_order ASC', [req.params.modelId]);
    res.json(rows.map((r) => ({ id: r.id, modelId: r.model_id, name: r.name, yearStart: r.year_start, yearEnd: r.year_end, sortOrder: r.sort_order })));
  } catch (err) {
    next(err);
  }
});

router.get('/generations/:generationId/engines', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM vehicle_engines WHERE generation_id = $1 ORDER BY sort_order ASC', [req.params.generationId]);
    res.json(rows.map((r) => ({ id: r.id, generationId: r.generation_id, name: r.name, sortOrder: r.sort_order })));
  } catch (err) {
    next(err);
  }
});

router.get('/generations/:generationId/transmissions', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM vehicle_transmissions WHERE generation_id = $1 ORDER BY sort_order ASC', [req.params.generationId]);
    res.json(rows.map((r) => ({ id: r.id, generationId: r.generation_id, name: r.name, sortOrder: r.sort_order })));
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
    const { name, nameAr, photoUrl } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    // Required going forward (new, migration 046) -- an explicit real
    // requirement, not just an optional nicety like categories' own
    // Arabic name still is. DB column stays nullable so this doesn't
    // retroactively break brands created before this requirement
    // existed.
    if (!nameAr || !nameAr.trim()) return res.status(400).json({ error: 'nameAr is required' });
    if (!photoUrl || !photoUrl.trim()) return res.status(400).json({ error: 'photoUrl is required' });
    const id = `brand_${Date.now()}`;
    const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM vehicle_brands');
    await db.query('INSERT INTO vehicle_brands (id, name, name_ar, photo_url, sort_order) VALUES ($1, $2, $3, $4, $5)', [id, name.trim(), nameAr.trim(), photoUrl.trim(), maxRows[0].max_order + 10]);
    await logAdminAction(req, 'brand_created', 'brand', id, { name: name.trim() });
    res.status(201).json({ id, name: name.trim(), nameAr: nameAr.trim(), photoUrl: photoUrl.trim(), sortOrder: maxRows[0].max_order + 10 });
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ error: `A brand named "${req.body.name}" already exists` });
    next(err);
  }
});

// Real, new -- lets an admin replace an existing brand's photo at any
// time, same real capability already added for categories and parts.
// Previously only settable once, at creation (photoUrl is required
// there, but with no way to ever change it afterward).
router.patch('/brands/:id/photo', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { photoUrl } = req.body || {};
    if (!photoUrl || !photoUrl.trim()) return res.status(400).json({ error: 'photoUrl is required' });
    const { rows } = await db.query('UPDATE vehicle_brands SET photo_url = $1 WHERE id = $2 RETURNING *', [photoUrl.trim(), req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Brand not found' });
    await logAdminAction(req, 'brand_photo_changed', 'brand', req.params.id, {});
    res.json({ id: rows[0].id, name: rows[0].name, nameAr: rows[0].name_ar, photoUrl: rows[0].photo_url });
  } catch (err) {
    next(err);
  }
});

// Real, new -- brands reorder globally (no scope, no real parent to
// scope by), same real pattern already proven for pricing fee
// components and product categories.
router.post('/brands/:id/move', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { direction } = req.body || {};
    const { current, neighbor } = await moveItem({ table: 'vehicle_brands', id: req.params.id, direction, orderColumn: 'sort_order', notFoundMessage: 'Brand not found' });
    await logAdminAction(req, 'brand_reordered', 'brand', current.id, { direction, swappedWith: neighbor.name });
    const { rows } = await db.query('SELECT * FROM vehicle_brands ORDER BY sort_order ASC');
    res.json(rows.map((r) => ({ id: r.id, name: r.name, nameAr: r.name_ar, photoUrl: r.photo_url, sortOrder: r.sort_order })));
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// DELETE /fitment/brands/:id
router.delete('/brands/:id', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT name FROM vehicle_brands WHERE id = $1', [req.params.id]);
    const { rowCount } = await db.query('DELETE FROM vehicle_brands WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Brand not found' });
    await logAdminAction(req, 'brand_deleted', 'brand', req.params.id, { name: rows[0]?.name });
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
    const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM vehicle_models WHERE brand_id = $1', [req.params.brandId]);
    await db.query('INSERT INTO vehicle_models (id, brand_id, name, sort_order) VALUES ($1, $2, $3, $4)', [id, req.params.brandId, name.trim(), maxRows[0].max_order + 10]);
    await logAdminAction(req, 'model_created', 'model', id, { name: name.trim(), brandId: req.params.brandId });
    res.status(201).json({ id, brandId: req.params.brandId, name: name.trim(), sortOrder: maxRows[0].max_order + 10 });
  } catch (err) {
    next(err);
  }
});

// Real, new -- models reorder only among their own real brand's other
// models, never mixed in with a different brand's models.
router.post('/models/:id/move', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { direction } = req.body || {};
    const { rows: modelRows } = await db.query('SELECT brand_id FROM vehicle_models WHERE id = $1', [req.params.id]);
    if (modelRows.length === 0) return res.status(404).json({ error: 'Model not found' });
    const { current, neighbor } = await moveItem({ table: 'vehicle_models', id: req.params.id, direction, orderColumn: 'sort_order', scopeColumn: 'brand_id', scopeValue: modelRows[0].brand_id, notFoundMessage: 'Model not found' });
    await logAdminAction(req, 'model_reordered', 'model', current.id, { direction, swappedWith: neighbor.name });
    const { rows } = await db.query('SELECT * FROM vehicle_models WHERE brand_id = $1 ORDER BY sort_order ASC', [modelRows[0].brand_id]);
    res.json(rows.map((r) => ({ id: r.id, brandId: r.brand_id, name: r.name, sortOrder: r.sort_order })));
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// DELETE /fitment/models/:id
router.delete('/models/:id', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT name FROM vehicle_models WHERE id = $1', [req.params.id]);
    const { rowCount } = await db.query('DELETE FROM vehicle_models WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Model not found' });
    await logAdminAction(req, 'model_deleted', 'model', req.params.id, { name: rows[0]?.name });
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
    const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM vehicle_generations WHERE model_id = $1', [req.params.modelId]);
    await db.query(
      'INSERT INTO vehicle_generations (id, model_id, name, year_start, year_end, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, req.params.modelId, name.trim(), yearStart, yearEnd || null, maxRows[0].max_order + 10]
    );
    await logAdminAction(req, 'generation_created', 'generation', id, { name: name.trim(), modelId: req.params.modelId, yearStart, yearEnd: yearEnd || null });
    res.status(201).json({ id, modelId: req.params.modelId, name: name.trim(), yearStart, yearEnd: yearEnd || null, sortOrder: maxRows[0].max_order + 10 });
  } catch (err) {
    next(err);
  }
});

// Real, new -- generations reorder only among their own real model's
// other generations.
router.post('/generations/:id/move', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { direction } = req.body || {};
    const { rows: genRows } = await db.query('SELECT model_id FROM vehicle_generations WHERE id = $1', [req.params.id]);
    if (genRows.length === 0) return res.status(404).json({ error: 'Generation not found' });
    const { current, neighbor } = await moveItem({ table: 'vehicle_generations', id: req.params.id, direction, orderColumn: 'sort_order', scopeColumn: 'model_id', scopeValue: genRows[0].model_id, notFoundMessage: 'Generation not found' });
    await logAdminAction(req, 'generation_reordered', 'generation', current.id, { direction, swappedWith: neighbor.name });
    const { rows } = await db.query('SELECT * FROM vehicle_generations WHERE model_id = $1 ORDER BY sort_order ASC', [genRows[0].model_id]);
    res.json(rows.map((r) => ({ id: r.id, modelId: r.model_id, name: r.name, yearStart: r.year_start, yearEnd: r.year_end, sortOrder: r.sort_order })));
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// DELETE /fitment/generations/:id
router.delete('/generations/:id', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT name FROM vehicle_generations WHERE id = $1', [req.params.id]);
    const { rowCount } = await db.query('DELETE FROM vehicle_generations WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Generation not found' });
    await logAdminAction(req, 'generation_deleted', 'generation', req.params.id, { name: rows[0]?.name });
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
    const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM vehicle_engines WHERE generation_id = $1', [req.params.generationId]);
    await db.query('INSERT INTO vehicle_engines (id, generation_id, name, sort_order) VALUES ($1, $2, $3, $4)', [id, req.params.generationId, name.trim(), maxRows[0].max_order + 10]);
    await logAdminAction(req, 'engine_created', 'engine', id, { name: name.trim(), generationId: req.params.generationId });
    res.status(201).json({ id, generationId: req.params.generationId, name: name.trim(), sortOrder: maxRows[0].max_order + 10 });
  } catch (err) {
    next(err);
  }
});

// Real, new -- engines reorder only among their own real generation's
// other engines.
router.post('/engines/:id/move', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { direction } = req.body || {};
    const { rows: engineRows } = await db.query('SELECT generation_id FROM vehicle_engines WHERE id = $1', [req.params.id]);
    if (engineRows.length === 0) return res.status(404).json({ error: 'Engine not found' });
    const { current, neighbor } = await moveItem({ table: 'vehicle_engines', id: req.params.id, direction, orderColumn: 'sort_order', scopeColumn: 'generation_id', scopeValue: engineRows[0].generation_id, notFoundMessage: 'Engine not found' });
    await logAdminAction(req, 'engine_reordered', 'engine', current.id, { direction, swappedWith: neighbor.name });
    const { rows } = await db.query('SELECT * FROM vehicle_engines WHERE generation_id = $1 ORDER BY sort_order ASC', [engineRows[0].generation_id]);
    res.json(rows.map((r) => ({ id: r.id, generationId: r.generation_id, name: r.name, sortOrder: r.sort_order })));
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// DELETE /fitment/engines/:id
router.delete('/engines/:id', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT name FROM vehicle_engines WHERE id = $1', [req.params.id]);
    const { rowCount } = await db.query('DELETE FROM vehicle_engines WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Engine not found' });
    await logAdminAction(req, 'engine_deleted', 'engine', req.params.id, { name: rows[0]?.name });
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
    const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM vehicle_transmissions WHERE generation_id = $1', [req.params.generationId]);
    await db.query('INSERT INTO vehicle_transmissions (id, generation_id, name, sort_order) VALUES ($1, $2, $3, $4)', [id, req.params.generationId, name.trim(), maxRows[0].max_order + 10]);
    await logAdminAction(req, 'transmission_created', 'transmission', id, { name: name.trim(), generationId: req.params.generationId });
    res.status(201).json({ id, generationId: req.params.generationId, name: name.trim(), sortOrder: maxRows[0].max_order + 10 });
  } catch (err) {
    next(err);
  }
});

// Real, new -- transmissions reorder only among their own real
// generation's other transmissions.
router.post('/transmissions/:id/move', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { direction } = req.body || {};
    const { rows: transRows } = await db.query('SELECT generation_id FROM vehicle_transmissions WHERE id = $1', [req.params.id]);
    if (transRows.length === 0) return res.status(404).json({ error: 'Transmission not found' });
    const { current, neighbor } = await moveItem({ table: 'vehicle_transmissions', id: req.params.id, direction, orderColumn: 'sort_order', scopeColumn: 'generation_id', scopeValue: transRows[0].generation_id, notFoundMessage: 'Transmission not found' });
    await logAdminAction(req, 'transmission_reordered', 'transmission', current.id, { direction, swappedWith: neighbor.name });
    const { rows } = await db.query('SELECT * FROM vehicle_transmissions WHERE generation_id = $1 ORDER BY sort_order ASC', [transRows[0].generation_id]);
    res.json(rows.map((r) => ({ id: r.id, generationId: r.generation_id, name: r.name, sortOrder: r.sort_order })));
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// DELETE /fitment/transmissions/:id
router.delete('/transmissions/:id', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT name FROM vehicle_transmissions WHERE id = $1', [req.params.id]);
    const { rowCount } = await db.query('DELETE FROM vehicle_transmissions WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Transmission not found' });
    await logAdminAction(req, 'transmission_deleted', 'transmission', req.params.id, { name: rows[0]?.name });
    res.status(204).end();
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return res.status(409).json({ error: 'Cannot delete — one or more real products reference this transmission. Remove those first.' });
    }
    next(err);
  }
});

module.exports = router;
