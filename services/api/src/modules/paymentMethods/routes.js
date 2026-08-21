const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');
const { moveItem } = require('../../lib/reorder');
const { LAUNCH_MARKETS, resolveCountryCode } = require('../../config/markets');
const { PROVIDER_FIELD_SCHEMAS } = require('../../config/paymentProviderSchemas');

/**
 * Real payment method management (new) -- confirmed with the person
 * before building: photo required at creation (matching brands/
 * categories, not the optional pattern used for parts/models),
 * started deliberately empty (no seed data for the 4 previously
 * hardcoded checkout methods -- Visa/Mastercard, Amazon Payment
 * Services, PayPal, Google Pay -- the admin re-adds them manually
 * through this new admin portal section), and country activation
 * reuses the real, existing 40-country LAUNCH_MARKETS list
 * (config/markets.js) rather than a separate, new country list --
 * the same authoritative list already backing currency/shipping
 * elsewhere in this app.
 */

function toPaymentMethodDto(row, activeCountries) {
  return {
    id: row.id,
    nameEn: row.name_en,
    nameAr: row.name_ar,
    photoUrl: row.photo_url,
    sortOrder: row.sort_order,
    // Real, new (migration 064) -- a global master on/off switch,
    // separate from and independent of per-country activation below.
    // Lets an admin quickly disable a method everywhere without
    // losing its per-country configuration.
    isActive: row.is_active,
    // Real, new (migration 066) -- which real gateway (see
    // config/paymentProviderSchemas.js) this method actually charges
    // through. Nullable -- a method with no real provider assigned
    // yet simply can't be checked out with; surfaced clearly here
    // rather than silently defaulting to something unconfirmed.
    providerId: row.provider_id,
    activeCountries: activeCountries || [],
  };
}

const router = express.Router();

// GET /payment-methods/available-countries -- real, exposes the same
// real 40-country LAUNCH_MARKETS list the admin portal's own country-
// toggle UI needs, so that frontend doesn't need its own separate,
// duplicate country list that could drift out of sync with this one.
router.get('/available-countries', requireAuth, requireRole('admin'), requirePageAccess('paymentMethods'), async (req, res) => {
  res.json(LAUNCH_MARKETS.map((m) => ({ countryCode: m.countryCode, countryName: m.countryName })));
});

// GET /payment-methods/available-providers -- real, exposes the same
// real known-provider set config/paymentProviderSchemas.js already
// defines, so the admin portal's own provider-selection dropdown
// doesn't need its own separate, duplicate list.
router.get('/available-providers', requireAuth, requireRole('admin'), requirePageAccess('paymentMethods'), async (req, res) => {
  res.json(Object.entries(PROVIDER_FIELD_SCHEMAS).map(([providerId, schema]) => ({ providerId, label: schema.label })));
});

// GET /payment-methods -- admin list, every method with its own real
// list of currently-active country codes attached.
router.get('/', requireAuth, requireRole('admin'), requirePageAccess('paymentMethods'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM payment_methods ORDER BY sort_order ASC');
    const { rows: countryRows } = await db.query('SELECT payment_method_id, country_code FROM payment_method_countries');
    const countriesByMethod = {};
    for (const r of countryRows) {
      (countriesByMethod[r.payment_method_id] ||= []).push(r.country_code);
    }
    res.json(rows.map((r) => toPaymentMethodDto(r, countriesByMethod[r.id])));
  } catch (err) {
    next(err);
  }
});

// GET /payment-methods/for-country/:countryCode -- real, public-
// facing (no auth) -- this is what the real mobile checkout screen
// calls, confirmed with the person: shows only the payment methods
// active for whichever country the buyer's own selected shipping
// address is in, not a fixed global list.
router.get('/for-country/:countryCode', async (req, res, next) => {
  try {
    const resolvedCode = resolveCountryCode(req.params.countryCode);
    if (!resolvedCode) return res.json([]); // real, honest: an unrecognized country simply has no active methods, not an error
    const { rows } = await db.query(
      `SELECT pm.* FROM payment_methods pm
       JOIN payment_method_countries pmc ON pmc.payment_method_id = pm.id
       WHERE pmc.country_code = $1 AND pm.is_active = true
       ORDER BY pm.sort_order ASC`,
      [resolvedCode]
    );
    res.json(rows.map((r) => toPaymentMethodDto(r)));
  } catch (err) {
    next(err);
  }
});

// POST /payment-methods -- nameEn, nameAr, and photoUrl all real,
// required per the person's own confirmed decision.
router.post('/', requireAuth, requireRole('admin'), requirePageAccess('paymentMethods'), async (req, res, next) => {
  try {
    const { nameEn, nameAr, photoUrl, providerId } = req.body || {};
    if (!nameEn || !nameEn.trim()) return res.status(400).json({ error: 'nameEn is required' });
    if (!nameAr || !nameAr.trim()) return res.status(400).json({ error: 'nameAr is required' });
    if (!photoUrl || !photoUrl.trim()) return res.status(400).json({ error: 'photoUrl is required' });
    if (providerId && !PROVIDER_FIELD_SCHEMAS[providerId]) return res.status(400).json({ error: `Unknown providerId: ${providerId}` });
    const id = `pm_${Date.now()}`;
    const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM payment_methods');
    await db.query(
      'INSERT INTO payment_methods (id, name_en, name_ar, photo_url, sort_order, provider_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, nameEn.trim(), nameAr.trim(), photoUrl.trim(), maxRows[0].max_order + 10, providerId || null]
    );
    await logAdminAction(req, 'payment_method_created', 'payment_method', id, { nameEn: nameEn.trim() });
    res.status(201).json(toPaymentMethodDto({ id, name_en: nameEn.trim(), name_ar: nameAr.trim(), photo_url: photoUrl.trim(), sort_order: maxRows[0].max_order + 10, is_active: true, provider_id: providerId || null }, []));
  } catch (err) {
    next(err);
  }
});

// PATCH /payment-methods/:id -- edit name fields (photo stays on its
// own separate endpoint below, same established pattern as every
// other entity in this codebase).
router.patch('/:id', requireAuth, requireRole('admin'), requirePageAccess('paymentMethods'), async (req, res, next) => {
  try {
    const { nameEn, nameAr, providerId } = req.body || {};
    if (!nameEn || !nameEn.trim()) return res.status(400).json({ error: 'nameEn is required' });
    if (!nameAr || !nameAr.trim()) return res.status(400).json({ error: 'nameAr is required' });
    if (providerId && !PROVIDER_FIELD_SCHEMAS[providerId]) return res.status(400).json({ error: `Unknown providerId: ${providerId}` });
    const { rows } = await db.query('UPDATE payment_methods SET name_en = $1, name_ar = $2, provider_id = $3 WHERE id = $4 RETURNING *', [nameEn.trim(), nameAr.trim(), providerId || null, req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Payment method not found' });
    await logAdminAction(req, 'payment_method_updated', 'payment_method', req.params.id, { nameEn: nameEn.trim() });
    res.json(toPaymentMethodDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

// PATCH /payment-methods/:id/photo -- same established pattern as
// categories/parts/brands/models.
router.patch('/:id/photo', requireAuth, requireRole('admin'), requirePageAccess('paymentMethods'), async (req, res, next) => {
  try {
    const { photoUrl } = req.body || {};
    if (!photoUrl || !photoUrl.trim()) return res.status(400).json({ error: 'photoUrl is required' });
    const { rows } = await db.query('UPDATE payment_methods SET photo_url = $1 WHERE id = $2 RETURNING *', [photoUrl.trim(), req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Payment method not found' });
    await logAdminAction(req, 'payment_method_photo_changed', 'payment_method', req.params.id, {});
    res.json(toPaymentMethodDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

// PATCH /payment-methods/:id/active -- real, new (migration 064) --
// toggles the global master switch, independent of any per-country
// setting.
router.patch('/:id/active', requireAuth, requireRole('admin'), requirePageAccess('paymentMethods'), async (req, res, next) => {
  try {
    const { isActive } = req.body || {};
    if (typeof isActive !== 'boolean') return res.status(400).json({ error: 'isActive must be a boolean' });
    const { rows } = await db.query('UPDATE payment_methods SET is_active = $1 WHERE id = $2 RETURNING *', [isActive, req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Payment method not found' });
    await logAdminAction(req, isActive ? 'payment_method_activated' : 'payment_method_deactivated', 'payment_method', req.params.id, {});
    res.json(toPaymentMethodDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

// POST /payment-methods/:id/move -- real reorder, same shared
// moveItem() helper already used 7 other places in this codebase.
router.post('/:id/move', requireAuth, requireRole('admin'), requirePageAccess('paymentMethods'), async (req, res, next) => {
  try {
    const { direction } = req.body || {};
    await moveItem({ table: 'payment_methods', id: req.params.id, direction, orderColumn: 'sort_order', notFoundMessage: 'Payment method not found' });
    const { rows } = await db.query('SELECT * FROM payment_methods ORDER BY sort_order ASC');
    const { rows: countryRows } = await db.query('SELECT payment_method_id, country_code FROM payment_method_countries');
    const countriesByMethod = {};
    for (const r of countryRows) {
      (countriesByMethod[r.payment_method_id] ||= []).push(r.country_code);
    }
    res.json(rows.map((r) => toPaymentMethodDto(r, countriesByMethod[r.id])));
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// POST /payment-methods/:id/countries-bulk -- real, new -- activates
// or deactivates ALL 40 real launch-market countries for this one
// method in a single real atomic operation, rather than 40 separate
// round-trips (which would also risk a partial failure leaving
// inconsistent state). Uses a dedicated real path (not /countries/
// activate-all) to avoid any real routing ambiguity with the
// existing per-country :countryCode route above.
router.post('/:id/countries-bulk', requireAuth, requireRole('admin'), requirePageAccess('paymentMethods'), async (req, res, next) => {
  try {
    const { action } = req.body || {};
    if (action !== 'activate' && action !== 'deactivate') return res.status(400).json({ error: 'action must be "activate" or "deactivate"' });
    const methodCheck = await db.query('SELECT id FROM payment_methods WHERE id = $1', [req.params.id]);
    if (methodCheck.rows.length === 0) return res.status(404).json({ error: 'Payment method not found' });
    if (action === 'activate') {
      const values = LAUNCH_MARKETS.map((m, i) => `($1, $${i + 2})`).join(', ');
      await db.query(
        `INSERT INTO payment_method_countries (payment_method_id, country_code) VALUES ${values} ON CONFLICT DO NOTHING`,
        [req.params.id, ...LAUNCH_MARKETS.map((m) => m.countryCode)]
      );
    } else {
      await db.query('DELETE FROM payment_method_countries WHERE payment_method_id = $1', [req.params.id]);
    }
    await logAdminAction(req, action === 'activate' ? 'payment_method_all_countries_activated' : 'payment_method_all_countries_deactivated', 'payment_method', req.params.id, {});
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /payment-methods/:id/countries/:countryCode -- real, activates
// this method for this one country. Idempotent (activating an
// already-active country is a harmless no-op, not an error).
router.post('/:id/countries/:countryCode', requireAuth, requireRole('admin'), requirePageAccess('paymentMethods'), async (req, res, next) => {
  try {
    const methodCheck = await db.query('SELECT id FROM payment_methods WHERE id = $1', [req.params.id]);
    if (methodCheck.rows.length === 0) return res.status(404).json({ error: 'Payment method not found' });
    await db.query(
      'INSERT INTO payment_method_countries (payment_method_id, country_code) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, req.params.countryCode]
    );
    await logAdminAction(req, 'payment_method_country_activated', 'payment_method', req.params.id, { countryCode: req.params.countryCode });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// DELETE /payment-methods/:id/countries/:countryCode -- real,
// deactivates this method for this one country.
router.delete('/:id/countries/:countryCode', requireAuth, requireRole('admin'), requirePageAccess('paymentMethods'), async (req, res, next) => {
  try {
    await db.query('DELETE FROM payment_method_countries WHERE payment_method_id = $1 AND country_code = $2', [req.params.id, req.params.countryCode]);
    await logAdminAction(req, 'payment_method_country_deactivated', 'payment_method', req.params.id, { countryCode: req.params.countryCode });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// DELETE /payment-methods/:id -- real, removes the method entirely.
// payment_method_countries rows cascade-delete automatically (see
// migration 063's own ON DELETE CASCADE).
router.delete('/:id', requireAuth, requireRole('admin'), requirePageAccess('paymentMethods'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT name_en FROM payment_methods WHERE id = $1', [req.params.id]);
    const { rowCount } = await db.query('DELETE FROM payment_methods WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Payment method not found' });
    await logAdminAction(req, 'payment_method_deleted', 'payment_method', req.params.id, { nameEn: rows[0]?.name_en });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
