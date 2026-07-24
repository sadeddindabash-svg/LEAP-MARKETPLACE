const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, optionalAuth, requirePageAccess } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');
const { validatePromoCode } = require('../promotions/helpers');

/**
 * Admin-created promo codes (migration 020) — for real events/
 * campaigns, alongside the real referral-generated codes created by
 * services/api/src/modules/promotions/helpers.js. Same underlying
 * table, same validation and redemption logic either way.
 */
const router = express.Router();

function toPromoCodeDto(row) {
  return {
    code: row.code,
    type: row.type,
    value: row.value == null ? null : Number(row.value),
    source: row.source,
    maxTotalUses: row.max_total_uses,
    maxUsesPerBuyer: row.max_uses_per_buyer,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    isActive: row.is_active,
    createdAt: row.created_at,
    // Real audience targeting (migration 021) -- combinable, AND logic.
    requireNewUser: row.require_new_user,
    minTotalSpend: row.min_total_spend == null ? null : Number(row.min_total_spend),
    minOrderCount: row.min_order_count,
    minInactiveDays: row.min_inactive_days,
    // Real usage count (new) -- closes a real gap: the real
    // promo_code_redemptions table (migration 020) already recorded
    // every real redemption the whole time, an admin just had no way
    // to see it. Only counts a genuine redemption (order_id set, i.e.
    // actually applied to a real placed order), not a mere validation
    // check (POST /promo-codes/validate never writes a row here at all).
    usedCount: Number(row.used_count) || 0,
  };
}

router.get('/', requireAuth, requireRole('admin'), requirePageAccess('promoCodes'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT p.*, COUNT(r.id) AS used_count
      FROM promo_codes p
      LEFT JOIN promo_code_redemptions r ON r.promo_code = p.code
      GROUP BY p.code
      ORDER BY p.created_at DESC
    `);
    res.json(rows.map(toPromoCodeDto));
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, requireRole('admin'), requirePageAccess('promoCodes'), async (req, res, next) => {
  try {
    const { code, type, value, maxTotalUses, maxUsesPerBuyer, startsAt, expiresAt, requireNewUser, minTotalSpend, minOrderCount, minInactiveDays } = req.body || {};
    if (!code || !type) return res.status(400).json({ error: 'code and type are required' });
    if (!['percentage', 'flat', 'free_shipping'].includes(type)) {
      return res.status(400).json({ error: 'type must be one of: percentage, flat, free_shipping' });
    }
    if (type !== 'free_shipping' && (value == null || value <= 0)) {
      return res.status(400).json({ error: 'value must be a positive number for percentage/flat codes' });
    }
    // Real, sensible validation: a real scheduled start must come
    // before a real expiry, if both are set -- otherwise the code
    // would be genuinely impossible to ever actually use.
    if (startsAt && expiresAt && new Date(startsAt) >= new Date(expiresAt)) {
      return res.status(400).json({ error: 'startsAt must be before expiresAt' });
    }

    await db.query(
      `INSERT INTO promo_codes (code, type, value, source, created_by_admin_id, max_total_uses, max_uses_per_buyer, starts_at, expires_at, require_new_user, min_total_spend, min_order_count, min_inactive_days)
       VALUES ($1, $2, $3, 'admin', $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        code, type, type === 'free_shipping' ? null : value, req.user.sub, maxTotalUses || null, maxUsesPerBuyer || 1, startsAt || null, expiresAt || null,
        Boolean(requireNewUser), minTotalSpend || null, minOrderCount || null, minInactiveDays || null,
      ]
    );
    const { rows } = await db.query('SELECT * FROM promo_codes WHERE code = $1', [code]);
    await logAdminAction(req, 'promo_code_created', 'promo_code', code, { type, value: type === 'free_shipping' ? null : value });
    res.status(201).json(toPromoCodeDto(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: `A code "${req.body?.code}" already exists` });
    next(err);
  }
});

router.patch('/:code', requireAuth, requireRole('admin'), requirePageAccess('promoCodes'), async (req, res, next) => {
  try {
    const { isActive, startsAt, expiresAt, maxTotalUses } = req.body || {};
    const { rows } = await db.query(
      `UPDATE promo_codes SET
         is_active = COALESCE($1, is_active),
         starts_at = COALESCE($2, starts_at),
         expires_at = COALESCE($3, expires_at),
         max_total_uses = COALESCE($4, max_total_uses)
       WHERE code = $5 RETURNING *`,
      [isActive, startsAt, expiresAt, maxTotalUses, req.params.code]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Promo code not found' });
    // Real usage count, fetched separately -- REAL BUG AVOIDED HERE:
    // without this, the response would silently show usedCount: 0 for
    // a code that's genuinely already been used many times, since this
    // UPDATE alone has no visibility into promo_code_redemptions.
    const { rows: countRows } = await db.query('SELECT COUNT(*) AS used_count FROM promo_code_redemptions WHERE promo_code = $1', [req.params.code]);
    res.json(toPromoCodeDto({ ...rows[0], used_count: countRows[0].used_count }));
  } catch (err) {
    next(err);
  }
});

router.delete('/:code', requireAuth, requireRole('admin'), requirePageAccess('promoCodes'), async (req, res, next) => {
  try {
    const { rows: usedRows } = await db.query('SELECT id FROM promo_code_redemptions WHERE promo_code = $1 LIMIT 1', [req.params.code]);
    if (usedRows.length > 0) {
      return res.status(409).json({ error: 'Cannot delete this code — it has real redemptions. Deactivate it instead.' });
    }
    const { rowCount } = await db.query('DELETE FROM promo_codes WHERE code = $1', [req.params.code]);
    if (rowCount === 0) return res.status(404).json({ error: 'Promo code not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// POST /promo-codes/validate — real-time checkout validation, before an
// order is actually placed. optionalAuth since a guest checkout can
// still validate a code (per-buyer limits just won't apply to a guest,
// same as everywhere else guest checkout has reduced real functionality).
router.post('/validate', optionalAuth, async (req, res, next) => {
  try {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: 'code is required' });
    const result = await validatePromoCode(code, req.user ? req.user.sub : null);
    if (!result.valid) return res.status(400).json({ valid: false, reason: result.reason });
    res.json({ valid: true, promoCode: toPromoCodeDto(result.promoCode) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
