const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole } = require('../auth/middleware');
const { calculateBuyerPriceUsd } = require('./engine');

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
router.get('/fee-components', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM pricing_fee_components ORDER BY sort_order ASC');
    res.json(rows.map(toFeeComponentDto));
  } catch (err) {
    next(err);
  }
});

router.post('/fee-components', requireAuth, requireRole('admin'), async (req, res, next) => {
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
    res.status(201).json(toFeeComponentDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.patch('/fee-components/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
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
    res.json(toFeeComponentDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete('/fee-components/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rowCount } = await db.query('DELETE FROM pricing_fee_components WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Fee component not found' });
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
router.post('/fee-components/:id/move', requireAuth, requireRole('admin'), async (req, res, next) => {
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
router.get('/fx-rate', requireAuth, requireRole('admin'), async (req, res, next) => {
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

router.patch('/fx-rate', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { pair, rate } = req.body || {};
    if (!pair || rate === undefined || rate === null || rate <= 0) {
      return res.status(400).json({ error: 'pair and a positive rate are required' });
    }
    await db.query(
      `INSERT INTO fx_rates (currency_pair, rate, source, updated_at) VALUES ($1, $2, 'manual', now())
       ON CONFLICT (currency_pair) DO UPDATE SET rate = $2, source = 'manual', updated_at = now()`,
      [pair, rate]
    );
    const { rows } = await db.query('SELECT * FROM fx_rates WHERE currency_pair = $1', [pair]);
    const r = rows[0];
    res.json({ currencyPair: r.currency_pair, rate: Number(r.rate), source: r.source, updatedAt: r.updated_at });
  } catch (err) {
    next(err);
  }
});

// POST /pricing/preview  { supplierCostCny, weightKg, lengthCm, widthCm, heightCm }
// Lets an admin test the equation against a hypothetical product without
// needing a real one — the full breakdown, same shape the real catalog
// calculation produces internally.
router.post('/preview', requireAuth, requireRole('admin'), async (req, res, next) => {
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

module.exports = router;
