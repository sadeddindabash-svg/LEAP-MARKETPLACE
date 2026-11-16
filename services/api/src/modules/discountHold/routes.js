const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');
const hold = require('./rules');

// Pricing > Discount rules > ⚙ Rules (migration 143). Mounted at /admin/discount-hold.
const router = express.Router();
const admin = [requireAuth, requireRole('admin'), requirePageAccess('products')];
const fail = (res, err, next) => (err instanceof hold.HoldError ? res.status(err.status).json({ error: err.message }) : next(err));

router.get('/rules', ...admin, async (req, res, next) => {
  try { res.json(await hold.getRules()); } catch (err) { fail(res, err, next); }
});
router.put('/rules', ...admin, async (req, res, next) => {
  try {
    const saved = await hold.saveRules(req.body, req.user.sub);
    await logAdminAction(req, 'discount_hold_rules_saved', 'settings', 'discount_hold_rules', saved);
    res.json(saved);
  } catch (err) { fail(res, err, next); }
});
// What happened lately: the automatic steps, newest first (?limit=1..200).
router.get('/events', ...admin, async (req, res, next) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const { rows } = await db.query(
      `SELECT e.id, e.cart_id, e.product_id, e.order_id, e.kind, e.detail, e.created_at, p.name AS product_name
       FROM discount_hold_events e LEFT JOIN products p ON p.id = e.product_id ORDER BY e.created_at DESC, e.id DESC LIMIT $1`, [limit]);
    res.json(rows.map((r) => ({ id: Number(r.id), cartId: r.cart_id, productId: r.product_id, productName: r.product_name, orderId: r.order_id, kind: r.kind, detail: r.detail, at: r.created_at })));
  } catch (err) { fail(res, err, next); }
});

module.exports = router;
