const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');
const { moveItem } = require('../../lib/reorder');
const multer = require('multer');
const { MIN_CATALOG_DIMENSION_PX, MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES, inspectImage, saveImage } = require('../uploads/imageRules');
const { validateVersionFields, optionalName, cleanLine } = require('./vehicleRules');
const { buildVehicleWorkbook } = require('./vehicleExport');

/**
 * Fitment module — Year/Make/Model/Trim reference data (Phase 1, BUY-010).
 *
 * Basic VIN decoding (make + model year only, confirmed with the person):
 * checks the real vin_wmi_codes table first (manually-curated, covers
 * Chinese brands NHTSA has little to no data for), falls back to NHTSA's
 * free vPIC API for everything else. Full model/trim/engine decoding
 * (Phase 2, BUY-014) still genuinely depends on a licensed data provider
 * — see SRS Section 11, Appendix item 3 — and remains intentionally not
 * implemented; the buyer confirms the exact model/generation/trim through
 * the existing picker below instead.
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
    res.json(rows.map((r) => ({ id: r.id, name: r.name, nameAr: r.name_ar, nameZh: r.name_zh || null, photoUrl: r.photo_url, sortOrder: r.sort_order })));
  } catch (err) {
    next(err);
  }
});

router.get('/brands/:brandId/models', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM vehicle_models WHERE brand_id = $1 ORDER BY sort_order ASC', [req.params.brandId]);
    res.json(rows.map((r) => ({ id: r.id, brandId: r.brand_id, name: r.name, nameAr: r.name_ar, nameZh: r.name_zh || null, photoUrl: r.photo_url, sortOrder: r.sort_order })));
  } catch (err) {
    next(err);
  }
});

// How a vehicle YEAR (generation) is sent to clients. photoUrl is null for years created before the year photo existed (migration 102).
function toGenerationDto(r) {
  return { id: r.id, modelId: r.model_id, name: r.name, yearStart: r.year_start, yearEnd: r.year_end, sortOrder: r.sort_order, photoUrl: r.photo_url || null };
}

router.get('/models/:modelId/generations', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM vehicle_generations WHERE model_id = $1 ORDER BY year_start DESC, sort_order ASC', [req.params.modelId]);
    res.json(rows.map(toGenerationDto));
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
    const { name, nameAr, nameZh, photoUrl } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    // Required going forward (new, migration 046) -- an explicit real
    // requirement, not just an optional nicety like categories' own
    // Arabic name still is. DB column stays nullable so this doesn't
    // retroactively break brands created before this requirement
    // existed.
    if (!nameAr || !nameAr.trim()) return res.status(400).json({ error: 'nameAr is required' });
    if (!nameZh || typeof nameZh !== 'string' || !nameZh.trim()) return res.status(400).json({ error: 'nameZh is required (the Chinese name)' });
    // A brand needs all three: English name, Arabic name and a photo.
    if (!photoUrl || typeof photoUrl !== 'string' || !photoUrl.trim()) return res.status(400).json({ error: 'photoUrl is required' });
    const photo = photoUrl.trim();
    const id = `brand_${Date.now()}`;
    const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM vehicle_brands');
    await db.query('INSERT INTO vehicle_brands (id, name, name_ar, name_zh, photo_url, sort_order) VALUES ($1, $2, $3, $4, $5, $6)', [id, name.trim(), nameAr.trim(), cleanLine(nameZh), photo, maxRows[0].max_order + 10]);
    await logAdminAction(req, 'brand_created', 'brand', id, { name: name.trim() });
    res.status(201).json({ id, name: name.trim(), nameAr: nameAr.trim(), nameZh: cleanLine(nameZh), photoUrl: photo, sortOrder: maxRows[0].max_order + 10 });
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ error: `A brand named "${req.body.name}" already exists` });
    next(err);
  }
});

// Real, new -- lets an admin replace an existing brand's photo at any
// time, same real capability already added for categories and parts.
// Previously only settable once, at creation (photoUrl is required
// there, but with no way to ever change it afterward).
// Real, new -- lets an admin edit an existing brand's name fields at
// any time (photo stays on its own separate endpoint below). Both
// name and nameAr required, matching how a brand is originally
// created.
router.patch('/brands/:id', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { name, nameAr, nameZh } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    if (!nameAr || !nameAr.trim()) return res.status(400).json({ error: 'nameAr is required' });
    const zh = optionalName(nameZh);
    if (zh === undefined) return res.status(400).json({ error: 'nameZh cannot be blank (the Chinese name)' });
    const { rows } = await db.query('UPDATE vehicle_brands SET name = $1, name_ar = $2, name_zh = COALESCE($4, name_zh) WHERE id = $3 RETURNING *', [name.trim(), nameAr.trim(), req.params.id, zh]);
    if (rows.length === 0) return res.status(404).json({ error: 'Brand not found' });
    await logAdminAction(req, 'brand_updated', 'brand', req.params.id, { name: name.trim() });
    res.json({ id: rows[0].id, name: rows[0].name, nameAr: rows[0].name_ar, nameZh: rows[0].name_zh || null, photoUrl: rows[0].photo_url });
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ error: `A brand named "${req.body.name}" already exists` });
    next(err);
  }
});

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
    // A model takes only its English and Arabic names. (A photo sent along is ignored: models have no photo; see migration 102.)
    const { name, nameAr, nameZh } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    if (!nameAr || !nameAr.trim()) return res.status(400).json({ error: 'nameAr is required' });
    if (!nameZh || typeof nameZh !== 'string' || !nameZh.trim()) return res.status(400).json({ error: 'nameZh is required (the Chinese name)' });
    const brandCheck = await db.query('SELECT id FROM vehicle_brands WHERE id = $1', [req.params.brandId]);
    if (brandCheck.rows.length === 0) return res.status(404).json({ error: 'Brand not found' });
    const id = `model_${Date.now()}`;
    const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM vehicle_models WHERE brand_id = $1', [req.params.brandId]);
    await db.query('INSERT INTO vehicle_models (id, brand_id, name, name_ar, name_zh, photo_url, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)', [id, req.params.brandId, name.trim(), nameAr.trim(), cleanLine(nameZh), null, maxRows[0].max_order + 10]);
    await logAdminAction(req, 'model_created', 'model', id, { name: name.trim(), brandId: req.params.brandId });
    res.status(201).json({ id, brandId: req.params.brandId, name: name.trim(), nameAr: nameAr.trim(), nameZh: cleanLine(nameZh), photoUrl: null, sortOrder: maxRows[0].max_order + 10 });
  } catch (err) {
    next(err);
  }
});

// Real, new -- lets an admin add or replace a model's photo at any
// time, same real pattern already used for categories, parts, and
// brands. Kept optional at creation (unlike brands' required photo),
// but editable the same way once one exists.
// Real, new -- lets an admin edit an existing model's name at any
// time (photo stays on its own separate endpoint below).
router.patch('/models/:id', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { name, nameAr, nameZh } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    if (!nameAr || !nameAr.trim()) return res.status(400).json({ error: 'nameAr is required' });
    const zh = optionalName(nameZh);
    if (zh === undefined) return res.status(400).json({ error: 'nameZh cannot be blank (the Chinese name)' });
    const { rows } = await db.query('UPDATE vehicle_models SET name = $1, name_ar = $2, name_zh = COALESCE($4, name_zh) WHERE id = $3 RETURNING *', [name.trim(), nameAr.trim(), req.params.id, zh]);
    if (rows.length === 0) return res.status(404).json({ error: 'Model not found' });
    await logAdminAction(req, 'model_updated', 'model', req.params.id, { name: name.trim() });
    res.json({ id: rows[0].id, brandId: rows[0].brand_id, name: rows[0].name, nameAr: rows[0].name_ar, nameZh: rows[0].name_zh || null, photoUrl: rows[0].photo_url, sortOrder: rows[0].sort_order });
  } catch (err) {
    next(err);
  }
});

router.patch('/models/:id/photo', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { photoUrl } = req.body || {};
    if (!photoUrl || !photoUrl.trim()) return res.status(400).json({ error: 'photoUrl is required' });
    const { rows } = await db.query('UPDATE vehicle_models SET photo_url = $1 WHERE id = $2 RETURNING *', [photoUrl.trim(), req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Model not found' });
    await logAdminAction(req, 'model_photo_changed', 'model', req.params.id, {});
    res.json({ id: rows[0].id, brandId: rows[0].brand_id, name: rows[0].name, nameAr: rows[0].name_ar, photoUrl: rows[0].photo_url, sortOrder: rows[0].sort_order });
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
    res.json(rows.map((r) => ({ id: r.id, brandId: r.brand_id, name: r.name, nameAr: r.name_ar, photoUrl: r.photo_url, sortOrder: r.sort_order })));
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

// A vehicle YEAR is added with only the year and its photo, both required:  POST /fitment/models/:modelId/generations  { year, photoUrl }
//   - the year is written in English digits (Arabic-Indic and Persian digits are converted), four digits, from 1950 to next year;
//   - one entry per year and model (409 if it already exists);
//   - it is stored as a one-year entry named by the year (name "2021", start and end 2021), so the garage, product fitment and the buyer's picker keep working
//     unchanged. Entries created the older way (a name like "F20" with a range of years) stay valid and are still edited with PATCH /generations/:id.
const OLDEST_YEAR = 1950;
function toEnglishDigits(text) {
  return String(text ?? '')
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))   // Arabic-Indic digits
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));  // Persian digits
}
router.post('/models/:modelId/generations', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { year: rawYear, photoUrl } = req.body || {};
    const newest = new Date().getFullYear() + 1;
    const yearText = toEnglishDigits(rawYear).trim();
    if (!yearText) return res.status(400).json({ error: 'year is required' });
    if (!/^\d{4}$/.test(yearText)) return res.status(400).json({ error: 'year must be four digits, written in English digits (for example 2021)' });
    const year = Number(yearText);
    if (year < OLDEST_YEAR || year > newest) return res.status(400).json({ error: `year must be between ${OLDEST_YEAR} and ${newest}` });
    if (!photoUrl || typeof photoUrl !== 'string' || !photoUrl.trim()) return res.status(400).json({ error: 'photoUrl is required' });
    const modelCheck = await db.query('SELECT id FROM vehicle_models WHERE id = $1', [req.params.modelId]);
    if (modelCheck.rows.length === 0) return res.status(404).json({ error: 'Model not found' });
    // A random part, so two different years created in the same millisecond cannot get the same id.
    const id = `gen_${Date.now()}${Math.floor(Math.random() * 1000)}`;
    // "That year does not exist yet, then insert" must be ONE step per model: two requests arriving together (a double click) used to both pass the check
    // and both insert, creating the same year twice. A transaction-level lock on the model makes the second request wait until the first has committed,
    // so it then sees the year and answers 409. (The lock is released automatically on commit or rollback.)
    const client = await db.getPool().connect();
    let sortOrder;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`vehicle_year:${req.params.modelId}`]);
      const { rows: maxRows } = await client.query('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM vehicle_generations WHERE model_id = $1', [req.params.modelId]);
      sortOrder = maxRows[0].max_order + 10;
      const { rowCount } = await client.query(
        `INSERT INTO vehicle_generations (id, model_id, name, year_start, year_end, sort_order, photo_url)
         SELECT $1, $2, $3, $4, $4, $5, $6
         WHERE NOT EXISTS (SELECT 1 FROM vehicle_generations WHERE model_id = $2 AND year_start = $4 AND year_end = $4)`,
        [id, req.params.modelId, String(year), year, sortOrder, photoUrl.trim()]
      );
      await client.query('COMMIT');
      if (rowCount === 0) return res.status(409).json({ error: `${year} already exists for this model` });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    await logAdminAction(req, 'generation_created', 'generation', id, { name: String(year), modelId: req.params.modelId, yearStart: year, yearEnd: year });
    res.status(201).json({ id, modelId: req.params.modelId, name: String(year), yearStart: year, yearEnd: year, sortOrder, photoUrl: photoUrl.trim() });
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
    res.json(rows.map(toGenerationDto));
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// Lets an admin edit an existing generation's name and years at any time (its photo has its own endpoint just below).
router.patch('/generations/:id', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { name, yearStart, yearEnd } = req.body || {};
    if (!name || !name.trim() || !yearStart) return res.status(400).json({ error: 'name and yearStart are required' });
    if (yearEnd && yearEnd < yearStart) return res.status(400).json({ error: 'yearEnd cannot be before yearStart' });
    const { rows } = await db.query(
      'UPDATE vehicle_generations SET name = $1, year_start = $2, year_end = $3 WHERE id = $4 RETURNING *',
      [name.trim(), yearStart, yearEnd || null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Generation not found' });
    await logAdminAction(req, 'generation_updated', 'generation', req.params.id, { name: name.trim() });
    res.json(toGenerationDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

// Add or replace the photo of an existing vehicle year: how the years created before the year photo existed (migration 102) get theirs, and how any
// year's photo is replaced later.
router.patch('/generations/:id/photo', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { photoUrl } = req.body || {};
    if (!photoUrl || typeof photoUrl !== 'string' || !photoUrl.trim()) return res.status(400).json({ error: 'photoUrl is required' });
    const { rows } = await db.query('UPDATE vehicle_generations SET photo_url = $1 WHERE id = $2 RETURNING *', [photoUrl.trim(), req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Generation not found' });
    await logAdminAction(req, 'generation_photo_changed', 'generation', req.params.id, {});
    res.json(toGenerationDto(rows[0]));
  } catch (err) {
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

// Real, new -- lets an admin edit an existing engine's name.
router.patch('/engines/:id', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    const { rows } = await db.query('UPDATE vehicle_engines SET name = $1 WHERE id = $2 RETURNING *', [name.trim(), req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Engine not found' });
    await logAdminAction(req, 'engine_updated', 'engine', req.params.id, { name: name.trim() });
    res.json({ id: rows[0].id, generationId: rows[0].generation_id, name: rows[0].name, sortOrder: rows[0].sort_order });
  } catch (err) {
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

// Real, new -- lets an admin edit an existing transmission's name --
// the last of the 7 new edit endpoints added across categories,
// parts, brands, models, generations, engines, and transmissions.
router.patch('/transmissions/:id', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    const { rows } = await db.query('UPDATE vehicle_transmissions SET name = $1 WHERE id = $2 RETURNING *', [name.trim(), req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Transmission not found' });
    await logAdminAction(req, 'transmission_updated', 'transmission', req.params.id, { name: name.trim() });
    res.json({ id: rows[0].id, generationId: rows[0].generation_id, name: rows[0].name, sortOrder: rows[0].sort_order });
  } catch (err) {
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

// Confirmed with the person: real ISO 3779 VIN check-digit validation --
// a global standard, not US-specific, works for any real VIN regardless
// of brand. Position 9 (0-indexed 8) is the check digit.
const VIN_TRANSLITERATION = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

function vinCheckDigitIsValid(vin) {
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const ch = vin[i];
    const value = /[0-9]/.test(ch) ? Number(ch) : VIN_TRANSLITERATION[ch];
    if (value === undefined) return false; // a real invalid character (I, O, Q, or anything non-alphanumeric)
    sum += value * VIN_WEIGHTS[i];
  }
  const remainder = sum % 11;
  const expected = remainder === 10 ? 'X' : String(remainder);
  return vin[8] === expected;
}

// Confirmed with the person: real, standard model-year decoding
// (position 10, 0-indexed 9) -- also global, not US-specific. The
// code cycles every 30 years, disambiguated by whether position 7
// (0-indexed 6) is a digit (1980-2009 cycle) or a letter (2010-2039
// cycle) -- the standard, widely-used heuristic, though not
// universally perfect for every real manufacturer's own real VIN
// assignment practice.
const VIN_YEAR_CODES = {
  A: 1980, B: 1981, C: 1982, D: 1983, E: 1984, F: 1985, G: 1986, H: 1987,
  J: 1988, K: 1989, L: 1990, M: 1991, N: 1992, P: 1993, R: 1994, S: 1995,
  T: 1996, V: 1997, W: 1998, X: 1999, Y: 2000,
  1: 2001, 2: 2002, 3: 2003, 4: 2004, 5: 2005, 6: 2006, 7: 2007, 8: 2008, 9: 2009,
};
function decodeVinModelYear(vin) {
  const yearChar = vin[9];
  const baseYear = VIN_YEAR_CODES[yearChar];
  if (baseYear === undefined) return null;
  const isLaterCycle = /[A-HJ-NPR-Z]/.test(vin[6]); // position 7, letter = 2010-2039 cycle
  return isLaterCycle ? baseYear + 30 : baseYear;
}

// Confirmed with the person: real bug found and fixed via testing
// against real VIN examples before shipping -- the standard
// position-7 cycle heuristic above does NOT reliably hold for every
// real manufacturer (confirmed directly: a real Changan prefix
// decoded 3 real, known-2015-2018 vehicles as 1984-1986 instead).
// Returns both possible years for a year-code character so the
// caller can pick whichever one actually falls within a real, known
// production range from vin_model_patterns, when one exists.
function vinYearCodeBothCycles(yearChar) {
  const baseYear = VIN_YEAR_CODES[yearChar];
  if (baseYear === undefined) return null;
  return { earlier: baseYear, later: baseYear + 30 };
}

// GET /fitment/vin-decode/:vin — real, basic decode: make + model year
// only. Confirmed with the person: hands off to the existing Year/
// Make/Model picker for the exact model/generation/trim, since that
// part genuinely needs a licensed data provider this doesn't have.
router.get('/vin-decode/:vin', async (req, res, next) => {
  try {
    const vin = (req.params.vin || '').toUpperCase().trim();
    if (vin.length !== 17 || /[IOQ]/.test(vin)) {
      return res.status(400).json({ error: 'That doesn\'t look like a valid 17-character VIN' });
    }
    const isValid = vinCheckDigitIsValid(vin);
    const modelYear = decodeVinModelYear(vin);
    const wmi = vin.slice(0, 3);

    const { rows: localRows } = await db.query('SELECT make, country FROM vin_wmi_codes WHERE wmi_prefix = $1', [wmi]);
    if (localRows.length > 0) {
      // Confirmed with the person: checks the real, model-specific
      // pattern table (the person's own real, provided dataset) on
      // the full 8-character prefix -- only trusted when a single
      // real model was consistently observed for this exact prefix
      // (is_ambiguous = FALSE). The same real 8-character prefix can
      // genuinely be shared across several related, platform-sharing
      // real models (confirmed directly in the person's own data,
      // e.g. one real Changan prefix covers CS75, CS75 PHEV, and
      // CS85 COUPE across several real model years) -- an ambiguous
      // match stays honestly unresolved here rather than silently
      // guessing one.
      const prefix8 = vin.slice(0, 8);
      const { rows: modelRows } = await db.query(
        'SELECT model, year_min, year_max FROM vin_model_patterns WHERE prefix = $1 AND is_ambiguous = FALSE',
        [prefix8]
      );
      let finalYear = modelYear;
      const model = modelRows.length > 0 ? modelRows[0].model : null;
      if (modelRows.length > 0) {
        // Real bug found and fixed here: tested against 3 real VIN
        // examples for a real Changan prefix before trusting this --
        // the standard cycle heuristic above picked 1984-1986 for
        // real vehicles genuinely built in 2014-2016 (known real
        // range 2015-2018 for this exact prefix). Re-disambiguates
        // using the real known range whenever one exists, rather than
        // trusting the generic position-7 heuristic blindly for a
        // manufacturer it doesn't reliably hold for.
        const both = vinYearCodeBothCycles(vin[9]);
        const { year_min: yearMin, year_max: yearMax } = modelRows[0];
        if (both && yearMin != null && yearMax != null) {
          const earlierFits = both.earlier >= yearMin - 1 && both.earlier <= yearMax + 1;
          const laterFits = both.later >= yearMin - 1 && both.later <= yearMax + 1;
          if (laterFits && !earlierFits) finalYear = both.later;
          else if (earlierFits && !laterFits) finalYear = both.earlier;
          // if both or neither fit, the generic heuristic's own result stands unchanged
        }
      }
      return res.json({ vin, isValidCheckDigit: isValid, make: localRows[0].make, model, modelYear: finalYear, source: 'local' });
    }

    // Confirmed with the person: NHTSA's free vPIC API as a fallback
    // for non-Chinese brands, since NHTSA's own real data has little
    // to no coverage for Chinese manufacturers. Like this project's
    // other three external payment integrations, this call has NOT
    // had an actual live test against NHTSA's real API -- this
    // sandbox has no network access to vpic.nhtsa.dot.gov, confirmed
    // directly rather than assumed.
    try {
      const nhtsaRes = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`);
      if (nhtsaRes.ok) {
        const data = await nhtsaRes.json();
        const results = data.Results || [];
        const make = results.find((r) => r.Variable === 'Make')?.Value || null;
        const model = results.find((r) => r.Variable === 'Model')?.Value || null;
        const nhtsaYear = results.find((r) => r.Variable === 'Model Year')?.Value;
        return res.json({
          vin,
          isValidCheckDigit: isValid,
          make: make || null,
          model: model || null,
          modelYear: nhtsaYear ? Number(nhtsaYear) : modelYear,
          source: make ? 'nhtsa' : 'unrecognized',
        });
      }
    } catch (fetchErr) {
      console.error('[vin-decode] NHTSA lookup failed (non-fatal, falling back to local-only result):', fetchErr.message);
    }

    res.json({ vin, isValidCheckDigit: isValid, make: null, model: null, modelYear, source: 'unrecognized' });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Admin: manage the vin_wmi_codes lookup table (Vehicle Data page).
// ============================================================

router.get('/vin-wmi-codes', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM vin_wmi_codes ORDER BY make ASC, wmi_prefix ASC');
    res.json(rows.map((r) => ({ wmiPrefix: r.wmi_prefix, make: r.make, country: r.country })));
  } catch (err) {
    next(err);
  }
});

router.post('/vin-wmi-codes', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { wmiPrefix, make, country } = req.body || {};
    const normalizedPrefix = (wmiPrefix || '').toUpperCase().trim();
    if (normalizedPrefix.length !== 3) {
      return res.status(400).json({ error: 'wmiPrefix must be exactly 3 characters' });
    }
    if (!make) {
      return res.status(400).json({ error: 'make is required' });
    }
    await db.query(
      `INSERT INTO vin_wmi_codes (wmi_prefix, make, country) VALUES ($1, $2, $3)
       ON CONFLICT (wmi_prefix) DO UPDATE SET make = EXCLUDED.make, country = EXCLUDED.country, updated_at = now()`,
      [normalizedPrefix, make, country || null]
    );
    await logAdminAction(req, 'vin_wmi_code_saved', 'vin_wmi_code', normalizedPrefix, { make });
    res.status(201).json({ wmiPrefix: normalizedPrefix, make, country: country || null });
  } catch (err) {
    next(err);
  }
});

router.delete('/vin-wmi-codes/:wmiPrefix', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { rowCount } = await db.query('DELETE FROM vin_wmi_codes WHERE wmi_prefix = $1', [req.params.wmiPrefix.toUpperCase()]);
    if (rowCount === 0) return res.status(404).json({ error: 'WMI code not found' });
    await logAdminAction(req, 'vin_wmi_code_deleted', 'vin_wmi_code', req.params.wmiPrefix, {});
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Admin: manage the vin_model_patterns table (Vehicle Data page).
// Confirmed with the person: only ever shows/creates real,
// unambiguous (is_ambiguous = FALSE) rows here -- a manually-added
// row is, by construction, the admin vouching for one confident
// model for that prefix.
// ============================================================

router.get('/vin-model-patterns', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT prefix, brand, model, type, year_min, year_max FROM vin_model_patterns
       WHERE is_ambiguous = FALSE ORDER BY brand ASC, model ASC, prefix ASC`
    );
    res.json(rows.map((r) => ({
      prefix: r.prefix, brand: r.brand, model: r.model, type: r.type,
      yearMin: r.year_min, yearMax: r.year_max,
    })));
  } catch (err) {
    next(err);
  }
});

router.post('/vin-model-patterns', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { prefix, brand, model, type, yearMin, yearMax } = req.body || {};
    const normalizedPrefix = (prefix || '').toUpperCase().trim();
    if (normalizedPrefix.length !== 8) {
      return res.status(400).json({ error: 'prefix must be exactly 8 characters' });
    }
    if (!brand || !model) {
      return res.status(400).json({ error: 'brand and model are required' });
    }
    const validTypes = ['PHEV', 'Electric', 'Hybrid'];
    const normalizedType = type && validTypes.includes(type) ? type : null;
    await db.query(
      `INSERT INTO vin_model_patterns (prefix, brand, model, type, is_ambiguous, year_min, year_max, example_count, source)
       VALUES ($1, $2, $3, $4, FALSE, $5, $6, 0, 'Admin-entered (Vehicle Data page)')
       ON CONFLICT (prefix) DO UPDATE SET
         brand = EXCLUDED.brand, model = EXCLUDED.model, type = EXCLUDED.type,
         is_ambiguous = FALSE, year_min = EXCLUDED.year_min, year_max = EXCLUDED.year_max, updated_at = now()`,
      [normalizedPrefix, brand, model, normalizedType, yearMin || null, yearMax || null]
    );
    await logAdminAction(req, 'vin_model_pattern_saved', 'vin_model_pattern', normalizedPrefix, { brand, model });
    res.status(201).json({ prefix: normalizedPrefix, brand, model, type: normalizedType, yearMin: yearMin || null, yearMax: yearMax || null });
  } catch (err) {
    next(err);
  }
});

router.delete('/vin-model-patterns/:prefix', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { rowCount } = await db.query('DELETE FROM vin_model_patterns WHERE prefix = $1', [req.params.prefix.toUpperCase()]);
    if (rowCount === 0) return res.status(404).json({ error: 'VIN model pattern not found' });
    await logAdminAction(req, 'vin_model_pattern_deleted', 'vin_model_pattern', req.params.prefix, {});
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// POST /vin-model-patterns/bulk-upload { rows: [{ prefix, brand, model, year, type }] }
// Confirmed with the person: rows are already parsed client-side
// (matching the existing established pattern -- the supplier
// portal's own real bulk-import already parses .xlsx with exceljs
// in the browser before sending JSON here, rather than uploading the
// raw file for server-side parsing).
//
// Confirmed with the person: a malformed row (missing a required
// field, or a prefix that isn't exactly 8 characters) is skipped
// individually, not treated as a reason to fail the whole real
// upload.
//
// Confirmed with the person: for the real 3-character WMI code,
// disagreement with an existing real brand is never silently
// overwritten -- automates exactly how the real LFP/Hongqi conflict
// was handled directly with the person earlier. The full 8-character
// model pattern itself is always safely upserted, since a person
// re-uploading the same real prefix is presumed to be correcting or
// confirming it, not introducing a genuine ambiguity.
router.post('/vin-model-patterns/bulk-upload', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const validTypes = ['PHEV', 'Electric', 'Hybrid'];
    let newWmiCount = 0;
    let patternCount = 0;
    const skipped = [];
    const needsReview = [];

    for (const row of rows) {
      const prefix = (row.prefix || '').toUpperCase().trim();
      const brand = (row.brand || '').trim();
      const model = (row.model || '').trim();
      const year = row.year ? Number(row.year) : null;
      const type = validTypes.includes(row.type) ? row.type : null;

      if (prefix.length !== 8 || !brand || !model) {
        skipped.push({ prefix: row.prefix, reason: 'Missing prefix (must be 8 characters), brand, or model' });
        continue;
      }

      const wmi = prefix.slice(0, 3);
      const { rows: existingWmi } = await db.query('SELECT make FROM vin_wmi_codes WHERE wmi_prefix = $1', [wmi]);
      if (existingWmi.length === 0) {
        await db.query('INSERT INTO vin_wmi_codes (wmi_prefix, make, country) VALUES ($1, $2, $3)', [wmi, brand, null]);
        newWmiCount += 1;
      } else if (existingWmi[0].make.toLowerCase() !== brand.toLowerCase()) {
        needsReview.push({ wmi, existingBrand: existingWmi[0].make, uploadedBrand: brand, prefix, model, year, type });
        continue; // real conflict -- the real 8-character pattern below is held back too, since its own brand is in question
      }

      await db.query(
        `INSERT INTO vin_model_patterns (prefix, brand, model, type, is_ambiguous, year_min, year_max, example_count, source)
         VALUES ($1, $2, $3, $4, FALSE, $5, $5, 1, 'Bulk upload (Vehicle Data page)')
         ON CONFLICT (prefix) DO UPDATE SET
           brand = EXCLUDED.brand, model = EXCLUDED.model, type = EXCLUDED.type,
           is_ambiguous = FALSE, year_min = LEAST(vin_model_patterns.year_min, EXCLUDED.year_min),
           year_max = GREATEST(vin_model_patterns.year_max, EXCLUDED.year_max), updated_at = now()`,
        [prefix, brand, model, type, year]
      );
      patternCount += 1;
    }

    await logAdminAction(req, 'vin_model_patterns_bulk_uploaded', 'vin_model_pattern', 'bulk', { newWmiCount, patternCount, skippedCount: skipped.length, reviewCount: needsReview.length });
    res.json({ newWmiCount, patternCount, skipped, needsReview });
  } catch (err) {
    next(err);
  }
});

// POST /vin-model-patterns/resolve-conflict { wmi, chosenBrand, prefix, model, year, type }
// Confirmed with the person: one-click resolution for a row a bulk
// upload held back due to a real WMI brand conflict -- the admin
// picks "keep old" or "use new" (chosenBrand is whichever real value
// they picked), and this applies the real WMI brand and completes
// the real, held-back model-pattern insert together, without needing
// to re-upload the original file.
router.post('/vin-model-patterns/resolve-conflict', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const { wmi, chosenBrand, prefix, model, year, type } = req.body || {};
    const normalizedWmi = (wmi || '').toUpperCase().trim();
    const normalizedPrefix = (prefix || '').toUpperCase().trim();
    if (normalizedWmi.length !== 3 || normalizedPrefix.length !== 8 || !chosenBrand || !model) {
      return res.status(400).json({ error: 'wmi (3 chars), prefix (8 chars), chosenBrand, and model are all required' });
    }
    const validTypes = ['PHEV', 'Electric', 'Hybrid'];
    const normalizedType = validTypes.includes(type) ? type : null;

    await db.query('UPDATE vin_wmi_codes SET make = $1, updated_at = now() WHERE wmi_prefix = $2', [chosenBrand, normalizedWmi]);
    await db.query(
      `INSERT INTO vin_model_patterns (prefix, brand, model, type, is_ambiguous, year_min, year_max, example_count, source)
       VALUES ($1, $2, $3, $4, FALSE, $5, $5, 1, 'Bulk upload (Vehicle Data page) - conflict resolved')
       ON CONFLICT (prefix) DO UPDATE SET
         brand = EXCLUDED.brand, model = EXCLUDED.model, type = EXCLUDED.type,
         is_ambiguous = FALSE, year_min = LEAST(vin_model_patterns.year_min, EXCLUDED.year_min),
         year_max = GREATEST(vin_model_patterns.year_max, EXCLUDED.year_max), updated_at = now()`,
      [normalizedPrefix, chosenBrand, model, normalizedType, year || null]
    );
    await logAdminAction(req, 'vin_model_pattern_conflict_resolved', 'vin_model_pattern', normalizedPrefix, { wmi: normalizedWmi, chosenBrand });
    res.json({ wmi: normalizedWmi, prefix: normalizedPrefix, brand: chosenBrand, model });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Photo door for VEHICLE and CATEGORY photos (400 px minimum)
// ============================================================
// The vehicle screens (brand, year, version) and the Categories screen upload their photos here. The shortest side must be at least 400 px (a bigger picture is fine).
// This is a SEPARATE, admin-only door: POST /uploads/product-image, used for product, hub and review photos, keeps its 800 px minimum and is not touched.
// (It lives in this module so that it needs no change to how the server's modules are mounted; the Categories screen simply calls this address too.)
const catalogUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) return cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`));
    cb(null, true);
  },
});

// POST /fitment/catalog-image  (multipart/form-data, field name "image")  ->  { url, width, height, storage }
router.post('/catalog-image', requireAuth, requireRole('admin'), (req, res, next) => {
  catalogUpload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No image file provided (expected field name "image")' });
    try {
      const checked = inspectImage(req.file.buffer, MIN_CATALOG_DIMENSION_PX);
      if (!checked.ok) return res.status(400).json({ error: checked.error });
      const saved = await saveImage(req.file.buffer, checked.mime);
      res.status(201).json({ url: saved.url, width: checked.width, height: checked.height, storage: saved.storage });
    } catch (e) {
      next(e);
    }
  });
});

// ============================================================
// Versions: the level under a Year (version name, engine, seats, photo)
// ============================================================
// A version belongs to a Year (vehicle_generations). Its name and engine are written in English, Arabic and Chinese (all required), the seats are a number from 1 to 12,
// and the photo is required when adding one by hand (a version that came from the Excel import may have none yet: the list marks it and "Add photo" fixes it, exactly
// as for years). The same version name with the same engine cannot be added twice to one year.
function toVersionDto(r) {
  return {
    id: r.id, generationId: r.generation_id,
    name: r.name, nameAr: r.name_ar, nameZh: r.name_zh,
    engine: r.engine, engineAr: r.engine_ar, engineZh: r.engine_zh,
    seats: r.seats, photoUrl: r.photo_url || null, sortOrder: r.sort_order,
  };
}

router.get('/generations/:generationId/versions', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM vehicle_versions WHERE generation_id = $1 ORDER BY sort_order ASC, name ASC', [req.params.generationId]);
    res.json(rows.map(toVersionDto));
  } catch (err) {
    next(err);
  }
});

router.post('/generations/:generationId/versions', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const checked = validateVersionFields(req.body);
    if (!checked.ok) return res.status(400).json({ error: checked.error });
    const photoUrl = typeof (req.body || {}).photoUrl === 'string' ? req.body.photoUrl.trim() : '';
    if (!photoUrl) return res.status(400).json({ error: 'photoUrl is required' });
    const genCheck = await db.query('SELECT id FROM vehicle_generations WHERE id = $1', [req.params.generationId]);
    if (genCheck.rows.length === 0) return res.status(404).json({ error: 'Year not found' });
    const v = checked.value;
    const id = `ver_${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM vehicle_versions WHERE generation_id = $1', [req.params.generationId]);
    const { rows } = await db.query(
      `INSERT INTO vehicle_versions (id, generation_id, name, name_ar, name_zh, engine, engine_ar, engine_zh, seats, photo_url, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [id, req.params.generationId, v.name, v.nameAr, v.nameZh, v.engine, v.engineAr, v.engineZh, v.seats, photoUrl, maxRows[0].max_order + 10]
    );
    await logAdminAction(req, 'version_created', 'version', id, { name: v.name, generationId: req.params.generationId });
    res.status(201).json(toVersionDto(rows[0]));
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ error: 'This version with this engine and number of seats already exists for this year' });
    next(err);
  }
});

router.patch('/versions/:id', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const checked = validateVersionFields(req.body);
    if (!checked.ok) return res.status(400).json({ error: checked.error });
    const v = checked.value;
    const { rows } = await db.query(
      `UPDATE vehicle_versions SET name = $1, name_ar = $2, name_zh = $3, engine = $4, engine_ar = $5, engine_zh = $6, seats = $7 WHERE id = $8 RETURNING *`,
      [v.name, v.nameAr, v.nameZh, v.engine, v.engineAr, v.engineZh, v.seats, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Version not found' });
    await logAdminAction(req, 'version_updated', 'version', req.params.id, { name: v.name });
    res.json(toVersionDto(rows[0]));
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ error: 'This version with this engine and number of seats already exists for this year' });
    next(err);
  }
});

router.patch('/versions/:id/photo', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const photoUrl = typeof (req.body || {}).photoUrl === 'string' ? req.body.photoUrl.trim() : '';
    if (!photoUrl) return res.status(400).json({ error: 'photoUrl is required' });
    const { rows } = await db.query('UPDATE vehicle_versions SET photo_url = $1 WHERE id = $2 RETURNING *', [photoUrl, req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Version not found' });
    await logAdminAction(req, 'version_photo_changed', 'version', req.params.id, {});
    res.json(toVersionDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete('/versions/:id', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    // Buyers who saved this version in My Garage keep their car as a car of that YEAR (the saved row's version becomes empty). Two things need care, in one transaction:
    //  - a buyer who ALSO has the same car without a version would end up with it twice: that duplicate is removed;
    //  - if a removed car was the buyer's default, their newest remaining car becomes the default (a garage always has one).
    const client = await db.getPool().connect();
    let name;
    try {
      await client.query('BEGIN');
      const { rows: removed } = await client.query(
        `DELETE FROM user_saved_generations s USING user_saved_generations o
          WHERE s.version_id = $1 AND o.buyer_id = s.buyer_id AND o.generation_id = s.generation_id AND o.year = s.year AND o.version_id IS NULL
          RETURNING s.buyer_id, s.is_default`, [req.params.id]);
      const { rows } = await client.query('DELETE FROM vehicle_versions WHERE id = $1 RETURNING name', [req.params.id]);
      if (rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Version not found' }); }
      name = rows[0].name;
      const buyers = [...new Set(removed.filter((r) => r.is_default).map((r) => r.buyer_id))];
      if (buyers.length > 0) {
        await client.query(
          `UPDATE user_saved_generations u SET is_default = true
            WHERE u.buyer_id = ANY($1) AND NOT EXISTS (SELECT 1 FROM user_saved_generations d WHERE d.buyer_id = u.buyer_id AND d.is_default)
              AND (u.generation_id, u.year, COALESCE(u.version_id, '')) = (SELECT x.generation_id, x.year, COALESCE(x.version_id, '') FROM user_saved_generations x WHERE x.buyer_id = u.buyer_id ORDER BY x.created_at DESC LIMIT 1)`, [buyers]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    await logAdminAction(req, 'version_deleted', 'version', req.params.id, { name });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// The Excel import of vehicle data (preview, commit, template): see ../vehicleImport. It checks the admin and Vehicle Data access itself.
router.use('/import', require('../vehicleImport/routes'));

// GET /fitment/export?brandId=<id> -- the vehicle data as an Excel file (English, Arabic, Chinese, photo in the cell),
// one brand, or every brand without brandId. Admin, Vehicle data page.
router.get('/export', requireAuth, requireRole('admin'), requirePageAccess('vehicleData'), async (req, res, next) => {
  try {
    const brandId = typeof req.query.brandId === 'string' && req.query.brandId.trim() ? req.query.brandId.trim() : null;
    const out = await buildVehicleWorkbook(db, { brandId, baseUrl: `${req.protocol}://${req.get('host')}` });
    if (!out) return res.status(404).json({ error: 'Brand not found' });
    await logAdminAction(req, 'vehicle_data_exported', 'brand', brandId || 'all', { rows: out.rowCount });
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${out.fileName}"`,
      'Content-Length': String(out.buffer.length),
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.send(Buffer.from(out.buffer));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
