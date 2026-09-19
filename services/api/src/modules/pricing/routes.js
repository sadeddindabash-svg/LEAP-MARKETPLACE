const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { calculateBuyerPriceUsd } = require('./engine');
const { refreshLiveFxRate, getFxRateMode } = require('./fxRateRefresh');
const { logAdminAction } = require('../audit/helpers');

/**
 * Admin-only management of the real pricing equation — the fee
 * components and FX rate that services/api/src/modules/pricing/engine.js
 * actually uses to compute every buyer-facing price, live. See that
 * module's header comment for the full calculation design.
 */
const router = express.Router();

const ALLOWED_TYPES = ['percentage', 'flat', 'shipping_volumetric'];

function toFeeComponentDto(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    value: Number(row.value),
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /pricing/fee-components — includes inactive ones too, so an admin
// can see (and re-enable) a fee they turned off, not just the live set.
router.get('/fee-components', requireAuth, requireRole('admin'), requirePageAccess('pricing'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM pricing_fee_components ORDER BY sort_order ASC');
    res.json(rows.map(toFeeComponentDto));
  } catch (err) {
    next(err);
  }
});

router.post('/fee-components', requireAuth, requireRole('admin'), requirePageAccess('pricing'), async (req, res, next) => {
  try {
    const { name, type, value, sortOrder } = req.body || {};
    if (!name || !type || value === undefined || value === null) {
      return res.status(400).json({ error: 'name, type, and value are required' });
    }
    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${ALLOWED_TYPES.join(', ')}` });
    }
    const id = `fee_${Date.now()}`;
    await db.query(
      'INSERT INTO pricing_fee_components (id, name, type, value, sort_order) VALUES ($1, $2, $3, $4, $5)',
      [id, name, type, value, sortOrder ?? 0]
    );
    const { rows } = await db.query('SELECT * FROM pricing_fee_components WHERE id = $1', [id]);
    await logAdminAction(req, 'fee_component_created', 'fee_component', id, { name, type, value });
    res.status(201).json(toFeeComponentDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.patch('/fee-components/:id', requireAuth, requireRole('admin'), requirePageAccess('pricing'), async (req, res, next) => {
  try {
    const { name, type, value, sortOrder, isActive } = req.body || {};
    if (type !== undefined && !ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${ALLOWED_TYPES.join(', ')}` });
    }
    const { rows } = await db.query(
      `UPDATE pricing_fee_components SET
         name = COALESCE($1, name), type = COALESCE($2, type), value = COALESCE($3, value),
         sort_order = COALESCE($4, sort_order), is_active = COALESCE($5, is_active), updated_at = now()
       WHERE id = $6 RETURNING *`,
      [name ?? null, type ?? null, value ?? null, sortOrder ?? null, isActive ?? null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Fee component not found' });
    // Real audit coverage (new) -- a real, genuinely consequential
    // change: fee components directly determine the platform's real
    // commission on every real sale, arguably more consequential than
    // the FX rate changes already logged here.
    await logAdminAction(req, 'fee_component_updated', 'fee_component', req.params.id, { name, type, value, isActive });
    res.json(toFeeComponentDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete('/fee-components/:id', requireAuth, requireRole('admin'), requirePageAccess('pricing'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT name FROM pricing_fee_components WHERE id = $1', [req.params.id]);
    const { rowCount } = await db.query('DELETE FROM pricing_fee_components WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Fee component not found' });
    await logAdminAction(req, 'fee_component_deleted', 'fee_component', req.params.id, { name: rows[0]?.name });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// POST /pricing/fee-components/:id/move — real, atomic reordering.
// Fee components apply "in order, top to bottom" against a running
// total (see engine.js) -- swapping which one runs before another
// genuinely changes the real calculated price, so this is a real
// transactional swap of two real sort_order values, not two separate
// client-side PATCH calls that could leave things inconsistent if one
// succeeded and the other failed.
router.post('/fee-components/:id/move', requireAuth, requireRole('admin'), requirePageAccess('pricing'), async (req, res, next) => {
  const client = await db.getPool().connect();
  try {
    const { direction } = req.body || {};
    if (!['up', 'down'].includes(direction)) {
      return res.status(400).json({ error: 'direction must be "up" or "down"' });
    }

    await client.query('BEGIN');
    const { rows: currentRows } = await client.query('SELECT * FROM pricing_fee_components WHERE id = $1', [req.params.id]);
    if (currentRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Fee component not found' });
    }
    const current = currentRows[0];

    // The real adjacent component in the requested direction, by real
    // sort_order -- 'up' means the real component with the next
    // smaller sort_order (applies earlier); 'down' means the next
    // larger one (applies later).
    const { rows: neighborRows } = await client.query(
      direction === 'up'
        ? 'SELECT * FROM pricing_fee_components WHERE sort_order < $1 ORDER BY sort_order DESC LIMIT 1'
        : 'SELECT * FROM pricing_fee_components WHERE sort_order > $1 ORDER BY sort_order ASC LIMIT 1',
      [current.sort_order]
    );
    if (neighborRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `This is already the ${direction === 'up' ? 'first' : 'last'} fee component.` });
    }
    const neighbor = neighborRows[0];

    // A real, atomic swap of the two real sort_order values.
    await client.query('UPDATE pricing_fee_components SET sort_order = $1, updated_at = now() WHERE id = $2', [neighbor.sort_order, current.id]);
    await client.query('UPDATE pricing_fee_components SET sort_order = $1, updated_at = now() WHERE id = $2', [current.sort_order, neighbor.id]);
    await client.query('COMMIT');
    await logAdminAction(req, 'fee_component_reordered', 'fee_component', current.id, { name: current.name, direction, swappedWith: neighbor.name });

    const { rows } = await db.query('SELECT * FROM pricing_fee_components ORDER BY sort_order ASC');
    res.json(rows.map(toFeeComponentDto));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// GET/PATCH /pricing/fx-rate?pair=CNY_USD — the real manually-set rate
// that actually powers the calculation today (see engine.js's header
// comment on why there's no live provider configured in this
// environment). Shows `source` so an admin can see at a glance whether
// a given rate is the manual fallback or (once wired up) a real live one.
router.get('/fx-rate', requireAuth, requireRole('admin'), requirePageAccess('pricing'), async (req, res, next) => {
  try {
    const pair = req.query.pair || 'CNY_USD';
    const { rows } = await db.query('SELECT * FROM fx_rates WHERE currency_pair = $1', [pair]);
    if (rows.length === 0) return res.status(404).json({ error: `No rate configured for ${pair}` });
    const r = rows[0];
    res.json({ currencyPair: r.currency_pair, rate: Number(r.rate), source: r.source, updatedAt: r.updated_at });
  } catch (err) {
    next(err);
  }
});

router.patch('/fx-rate', requireAuth, requireRole('admin'), requirePageAccess('pricing'), async (req, res, next) => {
  try {
    const { pair, rate } = req.body || {};
    if (!pair || rate === undefined || rate === null || rate <= 0) {
      return res.status(400).json({ error: 'pair and a positive rate are required' });
    }
    // CONFIRMED (migration 028): a real automatic/manual toggle, not a
    // one-way switch -- while in 'automatic' mode, a manual entry here
    // would just get silently overwritten by the next real scheduled
    // refresh, which would be confusing. Require switching to 'manual'
    // mode first, so the person's real intent is unambiguous.
    const { rows: modeRows } = await db.query("SELECT value FROM platform_settings WHERE key = 'fx_rate_mode'");
    if ((modeRows[0]?.value || 'manual') === 'automatic') {
      return res.status(400).json({ error: 'Switch to manual mode first before setting a rate by hand — otherwise the next automatic refresh would just overwrite it.' });
    }
    await db.query(
      `INSERT INTO fx_rates (currency_pair, rate, source, updated_at) VALUES ($1, $2, 'manual', now())
       ON CONFLICT (currency_pair) DO UPDATE SET rate = $2, source = 'manual', updated_at = now()`,
      [pair, rate]
    );
    const { rows } = await db.query('SELECT * FROM fx_rates WHERE currency_pair = $1', [pair]);
    const r = rows[0];
    await logAdminAction(req, 'fx_rate_set_manual', 'fx_rate', pair, { rate: Number(r.rate) });
    res.json({ currencyPair: r.currency_pair, rate: Number(r.rate), source: r.source, updatedAt: r.updated_at });
  } catch (err) {
    next(err);
  }
});

// GET/PATCH /pricing/fx-rate-mode — the real automatic/manual toggle
// (migration 028). Switching TO 'automatic' triggers a real, immediate
// refresh right away, rather than waiting up to a real 24 hours for
// the next scheduled tick.
router.get('/fx-rate-mode', requireAuth, requireRole('admin'), requirePageAccess('pricing'), async (req, res, next) => {
  try {
    const mode = await getFxRateMode();
    res.json({ mode });
  } catch (err) {
    next(err);
  }
});

router.patch('/fx-rate-mode', requireAuth, requireRole('admin'), requirePageAccess('pricing'), async (req, res, next) => {
  try {
    const { mode } = req.body || {};
    if (!['automatic', 'manual'].includes(mode)) {
      return res.status(400).json({ error: "mode must be 'automatic' or 'manual'" });
    }
    await db.query(
      `INSERT INTO platform_settings (key, value, updated_at) VALUES ('fx_rate_mode', $1, now())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
      [mode]
    );
    if (mode === 'automatic') {
      await refreshLiveFxRate('CNY_USD');
    }
    await logAdminAction(req, 'fx_rate_mode_changed', 'platform_setting', 'fx_rate_mode', { mode });
    res.json({ mode });
  } catch (err) {
    next(err);
  }
});

// POST /pricing/preview  { supplierCostCny, weightKg, lengthCm, widthCm, heightCm }
// Lets an admin test the equation against a hypothetical product without
// needing a real one — the full breakdown, same shape the real catalog
// calculation produces internally.
router.post('/preview', requireAuth, requireRole('admin'), requirePageAccess('pricing'), async (req, res, next) => {
  try {
    const { supplierCostCny, weightKg, lengthCm, widthCm, heightCm } = req.body || {};
    const result = await calculateBuyerPriceUsd({ supplierCostCny, weightKg, lengthCm, widthCm, heightCm });
    res.json(result);
  } catch (err) {
    if (err.message && (err.message.includes('must be a positive number') || err.message.includes('missing weight') || err.message.includes('No FX rate'))) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// GET /pricing/display-rates -- public, no auth. Real buyer-facing
// display rates only (see fxRateRefresh.js's startScheduledDisplayCurrencyRefresh),
// never the CNY_USD supplier-pricing rate above -- that one stays
// admin-only via /fx-rate. Returns a plain { currencyCode: rate } map,
// USD -> currencyCode pairs only (1 USD = `rate` units of currencyCode),
// since that's the only real direction the mobile app's own display
// conversion needs.
router.get('/display-rates', async (req, res, next) => {
  try {
    const { rows } = await db.query("SELECT currency_pair, rate FROM fx_rates WHERE currency_pair LIKE 'USD\\_%' ESCAPE '\\'");
    const rates = {};
    for (const row of rows) {
      const currencyCode = row.currency_pair.split('_')[1];
      rates[currencyCode] = Number(row.rate);
    }
    res.json({ rates });
  } catch (err) {
    next(err);
  }
});

function toLoyaltyTierDto(row) {
  return {
    id: row.id, name: row.name, nameAr: row.name_ar,
    spendThreshold: Number(row.spend_threshold), discountPercentage: Number(row.discount_percentage),
    icon: row.icon, color: row.color, sortOrder: row.sort_order,
  };
}

// GET /pricing/loyalty-tiers — public (the mobile app needs this to
// show every buyer their own real progress and the full real tier
// list, logged in or not yet).
router.get('/loyalty-tiers', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM loyalty_tiers ORDER BY sort_order ASC, spend_threshold ASC');
    res.json(rows.map(toLoyaltyTierDto));
  } catch (err) {
    next(err);
  }
});

// Confirmed with the person: a real spend_threshold must be unique
// across tiers (two tiers unlocking at the exact same real spend is
// always a real mistake, not a legitimate design) -- checked here
// rather than left to a database constraint, so the real error
// message can actually say which existing tier collides.
async function validateLoyaltyTierInput(body, excludeId) {
  const { name, nameAr, spendThreshold, discountPercentage, icon, color } = body || {};
  if (!name || !String(name).trim()) return { error: 'name is required' };
  if (spendThreshold === undefined || spendThreshold === null || Number(spendThreshold) < 0) {
    return { error: 'spendThreshold is required and must be 0 or greater' };
  }
  if (discountPercentage === undefined || discountPercentage === null || Number(discountPercentage) < 0 || Number(discountPercentage) >= 100) {
    return { error: 'discountPercentage is required and must be between 0 and 100' };
  }
  const { rows: collision } = await db.query(
    `SELECT id, name FROM loyalty_tiers WHERE spend_threshold = $1 AND id != $2`,
    [Number(spendThreshold), excludeId || 0]
  );
  if (collision.length > 0) {
    return { error: `The tier "${collision[0].name}" already unlocks at this exact spend threshold. Choose a different amount.` };
  }
  return {
    name: String(name).trim(), nameAr: nameAr || null,
    spendThreshold: Number(spendThreshold), discountPercentage: Number(discountPercentage),
    icon: icon || 'medal', color: color || 'gray',
  };
}

router.post('/loyalty-tiers', requireAuth, requireRole('admin'), requirePageAccess('pricing'), async (req, res, next) => {
  try {
    const validated = await validateLoyaltyTierInput(req.body);
    if (validated.error) return res.status(400).json({ error: validated.error });
    const { name, nameAr, spendThreshold, discountPercentage, icon, color } = validated;
    const { rows: maxSort } = await db.query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM loyalty_tiers');
    const { rows } = await db.query(
      `INSERT INTO loyalty_tiers (name, name_ar, spend_threshold, discount_percentage, icon, color, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, nameAr, spendThreshold, discountPercentage, icon, color, maxSort[0].next]
    );
    res.status(201).json(toLoyaltyTierDto(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'A tier with this name already exists' });
    next(err);
  }
});

router.patch('/loyalty-tiers/:id', requireAuth, requireRole('admin'), requirePageAccess('pricing'), async (req, res, next) => {
  try {
    const validated = await validateLoyaltyTierInput(req.body, Number(req.params.id));
    if (validated.error) return res.status(400).json({ error: validated.error });
    const { name, nameAr, spendThreshold, discountPercentage, icon, color } = validated;
    const { rows } = await db.query(
      `UPDATE loyalty_tiers SET
         name = $1, name_ar = $2, spend_threshold = $3, discount_percentage = $4, icon = $5, color = $6, updated_at = now()
       WHERE id = $7 RETURNING *`,
      [name, nameAr, spendThreshold, discountPercentage, icon, color, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Loyalty tier not found' });
    res.json(toLoyaltyTierDto(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'A tier with this name already exists' });
    next(err);
  }
});

router.delete('/loyalty-tiers/:id', requireAuth, requireRole('admin'), requirePageAccess('pricing'), async (req, res, next) => {
  try {
    const { rowCount } = await db.query('DELETE FROM loyalty_tiers WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Loyalty tier not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
