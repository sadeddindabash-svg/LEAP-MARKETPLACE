const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');
const { COUNTRIES, nameForIsoCode } = require('../shared/countries');
const deliverySettings = require('../deliveryEstimate/settings');
const { estimateDelivery, resolveDestinationIsoCode, shippingQuote } = require('../deliveryEstimate/engine');

/**
 * Admin-only management of country groups and delivery rules, confirmed
 * with the person through several rounds of design discussion (and a
 * rendered mockup) before building. Every real endpoint here is admin-
 * only -- the actual calculation these rules feed is handled entirely
 * by deliveryEstimate/engine.js, kept separate from this module.
 */
const router = express.Router();

function toGroupDto(group, members) {
  return {
    id: group.id,
    name: group.name,
    nameAr: group.name_ar,
    sortOrder: group.sort_order,
    members: members.map((m) => ({ isoCode: m.iso_code, name: m.name })),
  };
}

function toRuleDto(row) {
  return {
    id: row.id,
    minWeightKg: row.min_weight_kg != null ? Number(row.min_weight_kg) : null,
    maxWeightKg: row.max_weight_kg != null ? Number(row.max_weight_kg) : null,
    minVolumeCm3: row.min_volume_cm3 != null ? Number(row.min_volume_cm3) : null,
    maxVolumeCm3: row.max_volume_cm3 != null ? Number(row.max_volume_cm3) : null,
    warehouseCountry: row.warehouse_country,
    destinationGroupId: row.destination_group_id,
    destinationGroupName: row.destination_group_name,
    deliveryDays: row.delivery_days,
    sortOrder: row.sort_order,
    // the default shipping price for all countries, RMB per chargeable kg (null = the general price) (patch-delivery-prices)
    priceCnyPerKg: row.price_cny_per_kg != null ? Number(row.price_cny_per_kg) : null,
  };
}

function isForeignKeyViolation(err) {
  return err && err.code === '23503';
}

// Chosen countries with their own shipping price and their own delivery days, on each rule DTO: countryPrices [{ isoCode, name, priceCnyPerKg, deliveryDays }]
async function attachCountryPrices(dtos) {
  const ids = dtos.map((d) => d.id);
  const byRule = new Map(ids.map((id) => [id, []]));
  if (ids.length) {
    const { rows } = await db.query('SELECT rule_id, iso_code, price_cny_per_kg, delivery_days FROM delivery_rule_country_prices WHERE rule_id = ANY($1) ORDER BY iso_code', [ids]);
    for (const r of rows) byRule.get(r.rule_id)?.push({ isoCode: r.iso_code, name: nameForIsoCode(r.iso_code) || r.iso_code, priceCnyPerKg: Number(r.price_cny_per_kg), deliveryDays: r.delivery_days });
  }
  return dtos.map((d) => ({ ...d, countryPrices: byRule.get(d.id) || [] }));
}

// Saves priceCnyPerKg (null = the general price) and countryPrices (the whole list, replacing the old one) when they are sent. Returns an error text, or null.
async function savePrices(ruleId, body) {
  const price = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 && n <= 10000 ? Math.round(n * 100) / 100 : undefined; };
  if (body.priceCnyPerKg !== undefined) {
    const p = body.priceCnyPerKg === null || body.priceCnyPerKg === '' ? null : price(body.priceCnyPerKg);
    if (p === undefined) return 'priceCnyPerKg must be a number from 0.01 to 10000 (RMB per kg), or empty for the general price';
    await db.query('UPDATE delivery_rules SET price_cny_per_kg = $1 WHERE id = $2', [p, ruleId]);
  }
  if (body.countryPrices !== undefined) {
    if (!Array.isArray(body.countryPrices) || body.countryPrices.length > 250) return 'countryPrices must be a list (at most 250 countries)';
    const seen = new Set();
    const clean = [];
    for (const c of body.countryPrices) {
      const iso = String((c && c.isoCode) || '').toUpperCase();
      if (!nameForIsoCode(iso)) return `countryPrices: ${iso || 'a country'} is not in the country list`;
      if (seen.has(iso)) continue;
      seen.add(iso);
      const p = price(c.priceCnyPerKg);
      const d = Number(c.deliveryDays);
      if (p === undefined) return `countryPrices: the price for ${iso} must be a number from 0.01 to 10000 (RMB per kg)`;
      if (!Number.isInteger(d) || d < 1 || d > 120) return `countryPrices: the delivery days for ${iso} must be a whole number from 1 to 120`;
      clean.push([iso, p, d]);
    }
    await db.query('DELETE FROM delivery_rule_country_prices WHERE rule_id = $1', [ruleId]);
    for (const [iso, p, d] of clean) await db.query('INSERT INTO delivery_rule_country_prices (rule_id, iso_code, price_cny_per_kg, delivery_days) VALUES ($1, $2, $3, $4)', [ruleId, iso, p, d]);
  }
  return null;
}

// ============================================================
// Real country reference list
// ============================================================

// GET /delivery-rules/countries -- the curated real list, for the
// admin's own "add country to group" picker.
// For "Try it": every rule, in order, with why it fits or not (the same tests as deliveryEstimate/engine.js matchRule).
async function whyEachRule({ weightKg, lengthCm, widthCm, heightCm, warehouseCountry, destinationIsoCode }) {
  const { rows: rules } = await db.query('SELECT dr.*, cg.name AS group_name FROM delivery_rules dr LEFT JOIN country_groups cg ON cg.id = dr.destination_group_id ORDER BY dr.sort_order ASC');
  const { rows: member } = await db.query('SELECT group_id FROM country_group_members WHERE iso_code = $1', [destinationIsoCode]);
  const inGroups = new Set(member.map((m) => m.group_id));
  const volume = weightKg != null && lengthCm != null && widthCm != null && heightCm != null ? lengthCm * widthCm * heightCm : null;
  const country = nameForIsoCode(destinationIsoCode) || destinationIsoCode;
  const num = (v) => (v == null ? null : Number(v));
  let winner = -1;
  return rules.map((r, i) => {
    const reasons = [];
    if (r.warehouse_country && r.warehouse_country !== warehouseCountry) reasons.push(`ships from ${r.warehouse_country}, not ${warehouseCountry || 'unknown'}`);
    if (r.destination_group_id && !inGroups.has(r.destination_group_id)) reasons.push(`${country} is not in ${r.group_name || 'that group'}`);
    const [wMin, wMax, vMin, vMax] = [num(r.min_weight_kg), num(r.max_weight_kg), num(r.min_volume_cm3), num(r.max_volume_cm3)];
    if (wMin != null || wMax != null) {
      if (weightKg == null) reasons.push('needs a weight');
      else { if (wMin != null && weightKg < wMin) reasons.push(`${weightKg} kg is under ${wMin} kg`); if (wMax != null && weightKg > wMax) reasons.push(`${weightKg} kg is over ${wMax} kg`); }
    }
    if (vMin != null || vMax != null) {
      if (volume == null) reasons.push(`needs a size (it has a volume limit: ${vMin ?? 0}–${vMax ?? '∞'} cm³)`);
      else { if (vMin != null && volume < vMin) reasons.push(`${volume} cm³ is under ${vMin} cm³`); if (vMax != null && volume > vMax) reasons.push(`${volume} cm³ is over ${vMax} cm³`); }
    }
    const fits = reasons.length === 0;
    if (fits && winner < 0) winner = i;
    return { ruleIndex: i, ruleId: r.id, fits, wins: fits && winner === i, reasons };
  });
}

// ---- Delivery Rules > How it works (confirmed with the person via mockup): the settings around the rules, and "Try it".
router.get('/settings', requireAuth, requireRole('admin'), requirePageAccess('deliveryRules'), async (req, res, next) => {
  try { res.json(await deliverySettings.getDeliverySettings({ fresh: true })); } catch (err) { next(err); }
});
router.put('/settings', requireAuth, requireRole('admin'), requirePageAccess('deliveryRules'), async (req, res, next) => {
  try { const s = await deliverySettings.saveDeliverySettings(req.body, req.user.sub); await logAdminAction(req, 'delivery_settings_saved', 'settings', 'delivery_settings', s); res.json(s); }
  catch (err) { if (err instanceof deliverySettings.DeliverySettingsError) return res.status(400).json({ error: err.message }); next(err); }
});
// POST /preview { warehouseCountry, destinationIsoCode (null = unknown), weightKg, settings? }   the date a buyer would see, with unsaved settings
router.post('/preview', requireAuth, requireRole('admin'), requirePageAccess('deliveryRules'), async (req, res, next) => {
  try {
    const b = req.body || {};
    let s;
    try { s = b.settings ? deliverySettings.validate(b.settings) : await deliverySettings.getDeliverySettings(); } catch (err) { return res.status(400).json({ error: err.message }); }
    const destinationIsoCode = b.destinationIsoCode ? String(b.destinationIsoCode).toUpperCase() : s.fallbackCountryIso;
    const n = (v) => { if (v === '' || v == null) return null; const x = Number(v); return Number.isFinite(x) && x >= 0 ? x : null; };
    const input = { weightKg: n(b.weightKg), lengthCm: n(b.lengthCm), widthCm: n(b.widthCm), heightCm: n(b.heightCm), warehouseCountry: b.warehouseCountry || null, destinationIsoCode };
    const est = await estimateDelivery(input, s);
    const shipping = await shippingQuote(input, s);      // the shipping in the price (patch-delivery-prices)
    res.json({ ...est, shipping, destinationIsoCode, checks: await whyEachRule(input) });
  } catch (err) { next(err); }
});

router.get('/countries', requireAuth, requireRole('admin'), requirePageAccess('deliveryRules'), (req, res) => {
  res.json(COUNTRIES);
});

// GET /delivery-rules/warehouse-countries -- the actual, distinct set
// of real countries already in use across real suppliers, confirmed
// with the person to replace a real free-text warehouse field: a
// typo there would silently make a rule never match anything at all,
// since matching is exact. Deliberately NOT reusing GET /supplier
// (gated by the separate 'suppliers' page permission) -- an admin
// granted only 'deliveryRules' access should still fully work here.
router.get('/warehouse-countries', requireAuth, requireRole('admin'), requirePageAccess('deliveryRules'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT DISTINCT country FROM suppliers WHERE country IS NOT NULL ORDER BY country ASC');
    res.json(rows.map((r) => r.country));
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Real country groups
// ============================================================

// GET /delivery-rules/country-groups
router.get('/country-groups', requireAuth, requireRole('admin'), requirePageAccess('deliveryRules'), async (req, res, next) => {
  try {
    const { rows: groups } = await db.query('SELECT * FROM country_groups ORDER BY sort_order ASC, created_at ASC');
    const dtos = await Promise.all(groups.map(async (g) => {
      const { rows: members } = await db.query('SELECT iso_code, name FROM country_group_members WHERE group_id = $1 ORDER BY name ASC', [g.id]);
      return toGroupDto(g, members);
    }));
    res.json(dtos);
  } catch (err) {
    next(err);
  }
});

// POST /delivery-rules/country-groups  { name, nameAr? }
router.post('/country-groups', requireAuth, requireRole('admin'), requirePageAccess('deliveryRules'), async (req, res, next) => {
  try {
    const { name, nameAr } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    const id = `cg_${Date.now()}`;
    await db.query('INSERT INTO country_groups (id, name, name_ar) VALUES ($1, $2, $3)', [id, name.trim(), nameAr?.trim() || null]);
    await logAdminAction(req, 'country_group_created', 'country_group', id, { name: name.trim() });
    res.status(201).json(toGroupDto({ id, name: name.trim(), name_ar: nameAr?.trim() || null, sort_order: 0 }, []));
  } catch (err) {
    next(err);
  }
});

// DELETE /delivery-rules/country-groups/:id
router.delete('/country-groups/:id', requireAuth, requireRole('admin'), requirePageAccess('deliveryRules'), async (req, res, next) => {
  try {
    const { rowCount } = await db.query('DELETE FROM country_groups WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Group not found' });
    await logAdminAction(req, 'country_group_deleted', 'country_group', req.params.id);
    res.status(204).send();
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return res.status(409).json({ error: 'This group is used by one or more delivery rules -- remove those rules (or change their destination) first' });
    }
    next(err);
  }
});

// POST /delivery-rules/country-groups/:id/members  { isoCode }
router.post('/country-groups/:id/members', requireAuth, requireRole('admin'), requirePageAccess('deliveryRules'), async (req, res, next) => {
  try {
    const { isoCode } = req.body || {};
    if (!isoCode) return res.status(400).json({ error: 'isoCode is required' });
    const name = nameForIsoCode(isoCode);
    if (!name) return res.status(400).json({ error: 'Unknown isoCode' });
    await db.query(
      'INSERT INTO country_group_members (group_id, iso_code, name) VALUES ($1, $2, $3) ON CONFLICT (group_id, iso_code) DO NOTHING',
      [req.params.id, isoCode, name]
    );
    const { rows: members } = await db.query('SELECT iso_code, name FROM country_group_members WHERE group_id = $1 ORDER BY name ASC', [req.params.id]);
    res.status(201).json(members.map((m) => ({ isoCode: m.iso_code, name: m.name })));
  } catch (err) {
    if (isForeignKeyViolation(err)) return res.status(404).json({ error: 'Group not found' });
    next(err);
  }
});

// DELETE /delivery-rules/country-groups/:id/members/:isoCode
router.delete('/country-groups/:id/members/:isoCode', requireAuth, requireRole('admin'), requirePageAccess('deliveryRules'), async (req, res, next) => {
  try {
    await db.query('DELETE FROM country_group_members WHERE group_id = $1 AND iso_code = $2', [req.params.id, req.params.isoCode]);
    const { rows: members } = await db.query('SELECT iso_code, name FROM country_group_members WHERE group_id = $1 ORDER BY name ASC', [req.params.id]);
    res.json(members.map((m) => ({ isoCode: m.iso_code, name: m.name })));
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Real delivery rules
// ============================================================

// GET /delivery-rules
router.get('/', requireAuth, requireRole('admin'), requirePageAccess('deliveryRules'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT dr.*, cg.name AS destination_group_name
       FROM delivery_rules dr
       LEFT JOIN country_groups cg ON cg.id = dr.destination_group_id
       ORDER BY dr.sort_order ASC`
    );
    res.json(await attachCountryPrices(rows.map(toRuleDto)));
  } catch (err) {
    next(err);
  }
});

// POST /delivery-rules  { minWeightKg?, maxWeightKg?, minVolumeCm3?, maxVolumeCm3?, warehouseCountry?, destinationGroupId?, deliveryDays }
router.post('/', requireAuth, requireRole('admin'), requirePageAccess('deliveryRules'), async (req, res, next) => {
  try {
    const { minWeightKg, maxWeightKg, minVolumeCm3, maxVolumeCm3, warehouseCountry, destinationGroupId, deliveryDays } = req.body || {};
    if (!deliveryDays || deliveryDays <= 0) return res.status(400).json({ error: 'deliveryDays must be a positive number' });
    const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM delivery_rules');
    const id = `dr_${Date.now()}`;
    await db.query(
      `INSERT INTO delivery_rules (id, min_weight_kg, max_weight_kg, min_volume_cm3, max_volume_cm3, warehouse_country, destination_group_id, delivery_days, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, minWeightKg ?? null, maxWeightKg ?? null, minVolumeCm3 ?? null, maxVolumeCm3 ?? null, warehouseCountry?.trim() || null, destinationGroupId || null, deliveryDays, maxRows[0].max_order + 1]
    );
    await logAdminAction(req, 'delivery_rule_created', 'delivery_rule', id, { deliveryDays });
    const priceProblem = await savePrices(id, req.body || {});
    if (priceProblem) return res.status(400).json({ error: priceProblem });
    const { rows } = await db.query(
      `SELECT dr.*, cg.name AS destination_group_name FROM delivery_rules dr LEFT JOIN country_groups cg ON cg.id = dr.destination_group_id WHERE dr.id = $1`,
      [id]
    );
    res.status(201).json((await attachCountryPrices([toRuleDto(rows[0])]))[0]);
  } catch (err) {
    if (isForeignKeyViolation(err)) return res.status(400).json({ error: 'Unknown destinationGroupId' });
    next(err);
  }
});

// PATCH /delivery-rules/:id
router.patch('/:id', requireAuth, requireRole('admin'), requirePageAccess('deliveryRules'), async (req, res, next) => {
  try {
    const { minWeightKg, maxWeightKg, minVolumeCm3, maxVolumeCm3, warehouseCountry, destinationGroupId, deliveryDays } = req.body || {};
    const { rows: existingRows } = await db.query('SELECT * FROM delivery_rules WHERE id = $1', [req.params.id]);
    if (existingRows.length === 0) return res.status(404).json({ error: 'Rule not found' });
    const existing = existingRows[0];
    const priceProblem = await savePrices(req.params.id, req.body || {});      // the rule's prices (patch-delivery-prices)
    if (priceProblem) return res.status(400).json({ error: priceProblem });

    await db.query(
      `UPDATE delivery_rules SET
         min_weight_kg = $1, max_weight_kg = $2, min_volume_cm3 = $3, max_volume_cm3 = $4,
         warehouse_country = $5, destination_group_id = $6, delivery_days = $7
       WHERE id = $8`,
      [
        minWeightKg !== undefined ? minWeightKg : existing.min_weight_kg,
        maxWeightKg !== undefined ? maxWeightKg : existing.max_weight_kg,
        minVolumeCm3 !== undefined ? minVolumeCm3 : existing.min_volume_cm3,
        maxVolumeCm3 !== undefined ? maxVolumeCm3 : existing.max_volume_cm3,
        warehouseCountry !== undefined ? (warehouseCountry?.trim() || null) : existing.warehouse_country,
        destinationGroupId !== undefined ? (destinationGroupId || null) : existing.destination_group_id,
        deliveryDays !== undefined ? deliveryDays : existing.delivery_days,
        req.params.id,
      ]
    );
    const { rows } = await db.query(
      `SELECT dr.*, cg.name AS destination_group_name FROM delivery_rules dr LEFT JOIN country_groups cg ON cg.id = dr.destination_group_id WHERE dr.id = $1`,
      [req.params.id]
    );
    res.json((await attachCountryPrices([toRuleDto(rows[0])]))[0]);
  } catch (err) {
    if (isForeignKeyViolation(err)) return res.status(400).json({ error: 'Unknown destinationGroupId' });
    next(err);
  }
});

// DELETE /delivery-rules/:id
router.delete('/:id', requireAuth, requireRole('admin'), requirePageAccess('deliveryRules'), async (req, res, next) => {
  try {
    const { rowCount } = await db.query('DELETE FROM delivery_rules WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Rule not found' });
    await logAdminAction(req, 'delivery_rule_deleted', 'delivery_rule', req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /delivery-rules/reorder  { orderedIds: [id1, id2, ...] }
// Real, confirmed necessary: match precedence depends entirely on
// sort_order (first real match wins), so drag-to-reorder needs a real
// way to persist a whole new order at once.
router.post('/reorder', requireAuth, requireRole('admin'), requirePageAccess('deliveryRules'), async (req, res, next) => {
  try {
    const { orderedIds } = req.body || {};
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) return res.status(400).json({ error: 'orderedIds must be a non-empty array' });
    for (let i = 0; i < orderedIds.length; i++) {
      await db.query('UPDATE delivery_rules SET sort_order = $1 WHERE id = $2', [i, orderedIds[i]]);
    }
    const { rows } = await db.query(
      `SELECT dr.*, cg.name AS destination_group_name FROM delivery_rules dr LEFT JOIN country_groups cg ON cg.id = dr.destination_group_id ORDER BY dr.sort_order ASC`
    );
    res.json(rows.map(toRuleDto));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
