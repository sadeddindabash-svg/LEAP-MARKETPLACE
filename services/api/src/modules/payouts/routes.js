const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { sendTransactionalEmail } = require('../email/client');
const { payoutConfirmationEmail } = require('../email/templates');
const { logAdminAction } = require('../audit/helpers');

/**
 * Real payouts (migration 024). CONFIRMED SCOPE, discussed and refined
 * before building: no automatic payout schedule — real payout timing
 * varies per supplier based on individual agreements, not one
 * platform-wide schedule. Instead, a real, admin-driven "record a
 * payout" action, built on a real, accurate "amount currently owed"
 * calculation. Commission varies by real category (see migration 024's
 * real product_categories.commission_percent, replacing what was
 * previously a hardcoded, fake display-only number in Settings).
 *
 * CONFIRMED: an order becomes eligible for payout only once delivered,
 * the real return window has passed, AND no return case was ever filed
 * for it — this avoids needing a clawback/repayment system for a
 * return that happens after a supplier's already been paid, rather
 * than leaving that as an unhandled gap.
 */
const router = express.Router();

// Real, shared SQL for "which sub-orders are genuinely eligible for
// payout right now" — used by both the owed-amount calculation and the
// actual payout-recording endpoint, so the two can never disagree
// about which sub-orders qualify.
const ELIGIBLE_SUB_ORDERS_CTE = `
  WITH window_setting AS (
    SELECT COALESCE((SELECT value FROM platform_settings WHERE key = 'return_window_days'), '7')::int AS days
  ),
  eligible AS (
    SELECT so.id AS sub_order_id, so.supplier_id,
           oli.unit_price * oli.quantity * (1 - pc.commission_percent / 100.0) AS net_amount
    FROM supplier_sub_orders so
    JOIN hub_shipments hs ON hs.sub_order_id = so.id
    JOIN order_line_items oli ON oli.sub_order_id = so.id
    JOIN products p ON p.id = oli.product_id
    JOIN product_categories pc ON pc.id = p.category
    CROSS JOIN window_setting w
    WHERE hs.status = 'delivered'
      AND hs.delivered_at IS NOT NULL
      AND hs.delivered_at + (w.days || ' days')::interval < now()
      AND so.id NOT IN (SELECT sub_order_id FROM payout_sub_orders)
      AND NOT EXISTS (SELECT 1 FROM return_cases rc WHERE rc.sub_order_id = so.id)
  )
`;

router.get('/owed', requireAuth, requireRole('admin'), requirePageAccess('payouts'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      ${ELIGIBLE_SUB_ORDERS_CTE}
      SELECT s.id AS supplier_id, s.name AS supplier_name,
             COALESCE(SUM(e.net_amount), 0) AS amount_owed,
             COUNT(e.sub_order_id) AS eligible_sub_order_count
      FROM suppliers s
      LEFT JOIN eligible e ON e.supplier_id = s.id
      GROUP BY s.id, s.name
      HAVING COALESCE(SUM(e.net_amount), 0) > 0
      ORDER BY amount_owed DESC
    `);
    res.json(rows.map((r) => ({
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      amountOwed: Number(r.amount_owed),
      eligibleSubOrderCount: Number(r.eligible_sub_order_count),
    })));
  } catch (err) {
    next(err);
  }
});

router.get('/', requireAuth, requireRole('admin'), requirePageAccess('payouts'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT p.*, s.name AS supplier_name,
             (SELECT COUNT(*) FROM payout_sub_orders pso WHERE pso.payout_id = p.id) AS sub_order_count
      FROM payouts p
      JOIN suppliers s ON s.id = p.supplier_id
      ORDER BY p.created_at DESC
    `);
    res.json(rows.map((r) => ({
      id: r.id,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      amount: Number(r.amount),
      currencyCode: r.currency_code,
      notes: r.notes,
      subOrderCount: Number(r.sub_order_count),
      createdAt: r.created_at,
    })));
  } catch (err) {
    next(err);
  }
});

// POST /payouts { supplierId, notes? } — records a real payout covering
// EVERY currently-eligible sub-order for that supplier at this exact
// moment (the real, live amount owed, not a client-supplied number —
// never trust a client-side total for something involving real money).
router.post('/', requireAuth, requireRole('admin'), requirePageAccess('payouts'), async (req, res, next) => {
  const client = await db.getPool().connect();
  try {
    const { supplierId, notes } = req.body || {};
    if (!supplierId) {
      return res.status(400).json({ error: 'supplierId is required' });
    }

    // CONFIRMED (migration 034): a real payout must have somewhere
    // real to go -- recording one without a real payout method on
    // file was a genuine, honest gap. Checked here, before the
    // transaction even opens, so a missing payout method never
    // produces a real payout row with no real destination.
    const { rows: payoutMethodRows } = await client.query('SELECT 1 FROM supplier_payout_methods WHERE supplier_id = $1', [supplierId]);
    if (payoutMethodRows.length === 0) {
      return res.status(400).json({ error: 'This supplier has no payout method on file yet — add their bank details before recording a payout.' });
    }

    await client.query('BEGIN');
    const { rows: eligibleRows } = await client.query(
      `${ELIGIBLE_SUB_ORDERS_CTE}
       SELECT sub_order_id, net_amount FROM eligible WHERE supplier_id = $1`,
      [supplierId]
    );
    if (eligibleRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This supplier has no real amount currently owed.' });
    }
    const totalAmount = eligibleRows.reduce((sum, r) => sum + Number(r.net_amount), 0);

    const { rows: payoutRows } = await client.query(
      `INSERT INTO payouts (supplier_id, amount, notes, created_by_admin_id) VALUES ($1, $2, $3, $4) RETURNING *`,
      [supplierId, totalAmount.toFixed(2), notes || null, req.user.sub]
    );
    const payoutId = payoutRows[0].id;
    for (const row of eligibleRows) {
      await client.query('INSERT INTO payout_sub_orders (payout_id, sub_order_id) VALUES ($1, $2)', [payoutId, row.sub_order_id]);
    }
    await client.query('COMMIT');
    await logAdminAction(req, 'payout_recorded', 'payout', payoutId, { supplierId, amount: Number(totalAmount.toFixed(2)), subOrderCount: eligibleRows.length });

    // Real payout confirmation email (new) -- best-effort, after commit,
    // same reasoning as every other real transactional email trigger:
    // a real SMTP call has no business inside the real payout
    // transaction, and an email hiccup should never affect a payout
    // that's already genuinely recorded.
    try {
      const { rows: userRows } = await db.query('SELECT email, name FROM users WHERE supplier_id = $1 AND role = $2', [supplierId, 'supplier']);
      if (userRows.length > 0) {
        const { html, text } = payoutConfirmationEmail({ recipientName: userRows[0].name, amount: totalAmount, currencyCode: payoutRows[0].currency_code, subOrderCount: eligibleRows.length });
        await sendTransactionalEmail({ to: userRows[0].email, subject: 'Payout recorded', html, text, fallbackLogLabel: 'payout-confirmation' });
      }
    } catch (err) {
      console.error('Payout confirmation email failed (non-fatal):', err.message);
    }

    res.status(201).json({
      id: payoutId,
      supplierId,
      amount: Number(payoutRows[0].amount),
      currencyCode: payoutRows[0].currency_code,
      notes: payoutRows[0].notes,
      subOrderCount: eligibleRows.length,
      createdAt: payoutRows[0].created_at,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
module.exports.ELIGIBLE_SUB_ORDERS_CTE = ELIGIBLE_SUB_ORDERS_CTE;
