const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { sendTransactionalEmail } = require('../email/client');
const { payoutConfirmationEmail } = require('../email/templates');
const { logAdminAction } = require('../audit/helpers');
const { ledgerCte, supplierTotals, supplierOrders, readTerm, termText, DEFAULT_TERM } = require('./terms');

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
 *
 * SINCE MIGRATION 122: when an order is owed depends on the supplier's own PAYMENT TERMS (before shipping, on arrival at the hub, after
 * delivery, after the return window, or N days after shipping) -- see ./terms.js. An order lost after it was paid (cancelled, refused,
 * returned) is "to recover": taken off the next payout and recorded in supplier_recoveries.
 */
const router = express.Router();

// Real, shared SQL for "which sub-orders are genuinely eligible for
// payout right now" — used by both the owed-amount calculation and the
// actual payout-recording endpoint, so the two can never disagree
// about which sub-orders qualify.
// One row per owed sub-order (migration 122: decided by the supplier's payment terms; see ./terms.js), with its supplier's net amount.
const ELIGIBLE_SUB_ORDERS_CTE = `${ledgerCte()},
  eligible AS (SELECT sub_order_id, supplier_id, net_amount FROM ledger WHERE state = 'owed')
`;

// GET /payouts/owed: per supplier, what is owed now (orders due by their terms + released fault payments), what must be recovered, what
// would be paid now (owed - to recover), and what is not due yet. A supplier with nothing in any of these is left out.
router.get('/owed', requireAuth, requireRole('admin'), requirePageAccess('payouts'), async (req, res, next) => {
  try {
    const totals = await supplierTotals(db);
    const { rows: suppliers } = await db.query('SELECT id, name, payment_term, payment_term_days FROM suppliers');
    const out = [];
    for (const s of suppliers) {
      const t = totals[s.id];
      if (!t) continue;
      const owedNow = Number((t.owed.amount + t.adjustments.amount).toFixed(2));
      if (owedNow <= 0 && t.toRecover.amount <= 0 && t.notDue.count === 0) continue;
      out.push({
        supplierId: s.id,
        supplierName: s.name,
        amountOwed: owedNow,                    // owed now: due orders + released fault payments (before anything is recovered)
        currencyCode: 'CNY',
        eligibleSubOrderCount: t.owed.count,
        adjustmentCount: t.adjustments.count,
        paymentTerm: s.payment_term || DEFAULT_TERM,
        paymentTermDays: s.payment_term_days,
        paymentTermText: termText(s.payment_term, s.payment_term_days),
        toRecover: t.toRecover,                 // { amount, count }: paid, then cancelled / refused / returned
        payNow: t.payNow,                       // what "Record payout" pays: owed now - to recover
        notDue: t.notDue,                       // { amount, count, nextDueAt }
        onHold: t.onHold,
      });
    }
    out.sort((a, b) => b.amountOwed - a.amountOwed || b.notDue.amount - a.notDue.amount);
    res.json(out);
  } catch (err) {
    next(err);
  }
});

// GET /payouts/owed/:supplierId: the orders behind the figures (why each is owed, recovered, waiting or on hold).
router.get('/owed/:supplierId', requireAuth, requireRole('admin'), requirePageAccess('payouts'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT id, name, payment_term, payment_term_days FROM suppliers WHERE id = $1', [req.params.supplierId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Supplier not found' });
    res.json({
      supplierId: rows[0].id, supplierName: rows[0].name,
      paymentTerm: rows[0].payment_term, paymentTermDays: rows[0].payment_term_days, paymentTermText: termText(rows[0].payment_term, rows[0].payment_term_days),
      totals: await supplierTotals(db, rows[0].id),
      orders: await supplierOrders(db, rows[0].id),
    });
  } catch (err) {
    next(err);
  }
});

// GET / PUT /payouts/terms/:supplierId  { paymentTerm, paymentTermDays? }: the supplier's payment terms, set on the admin's supplier page.
// Only for a VERIFIED supplier. A change applies to every order that is not paid yet.
router.get('/terms/:supplierId', requireAuth, requireRole('admin'), requirePageAccess('suppliers'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT id, verification_status, payment_term, payment_term_days FROM suppliers WHERE id = $1', [req.params.supplierId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Supplier not found' });
    res.json({ supplierId: rows[0].id, verified: rows[0].verification_status === 'verified', paymentTerm: rows[0].payment_term, paymentTermDays: rows[0].payment_term_days, paymentTermText: termText(rows[0].payment_term, rows[0].payment_term_days) });
  } catch (err) {
    next(err);
  }
});

router.put('/terms/:supplierId', requireAuth, requireRole('admin'), requirePageAccess('suppliers'), async (req, res, next) => {
  try {
    const t = readTerm(req.body || {});
    if (t.error) return res.status(400).json({ error: t.error });
    const { rows } = await db.query('SELECT verification_status, payment_term, payment_term_days FROM suppliers WHERE id = $1', [req.params.supplierId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Supplier not found' });
    if (rows[0].verification_status !== 'verified') return res.status(409).json({ error: 'Payment terms can be set once the supplier is verified.' });
    await db.query('UPDATE suppliers SET payment_term = $1, payment_term_days = $2 WHERE id = $3', [t.term, t.days, req.params.supplierId]);
    const from = termText(rows[0].payment_term, rows[0].payment_term_days), to = termText(t.term, t.days);
    if (from !== to) await logAdminAction(req, 'supplier_payment_terms_changed', 'supplier', req.params.supplierId, { from, to });
    res.json({ supplierId: req.params.supplierId, verified: true, paymentTerm: t.term, paymentTermDays: t.days, paymentTermText: to });
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
    const { rows: eligibleLineRows } = await client.query(
      `${ELIGIBLE_SUB_ORDERS_CTE}
       SELECT sub_order_id, net_amount FROM eligible WHERE supplier_id = $1`,
      [supplierId]
    );
    const { rows: adjustmentRows } = await client.query('SELECT id, amount FROM payout_adjustments WHERE supplier_id = $1 AND payout_id IS NULL AND currency_code = \'CNY\' FOR UPDATE', [supplierId]);
    // paid earlier, then cancelled / refused / returned (migration 122): taken off this payout
    const { rows: recoverRows } = await client.query(`${ledgerCte('so.supplier_id = $1')} SELECT sub_order_id, net_amount, lost_reason FROM ledger WHERE state = 'recover'`, [supplierId]);
    // The eligible rows are one per order LINE: add them up per sub-order, so a sub-order with several lines is recorded once (it used to fail with a duplicate key) and is counted once.
    const eligibleRows = Object.values(eligibleLineRows.reduce((acc, r) => { (acc[r.sub_order_id] ||= { sub_order_id: r.sub_order_id, net_amount: 0 }).net_amount += Number(r.net_amount); return acc; }, {}));
    if (eligibleRows.length === 0 && adjustmentRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This supplier has no real amount currently owed.' });
    }
    const recoverAmount = recoverRows.reduce((sum, r) => sum + Number(r.net_amount), 0);
    const totalAmount = eligibleRows.reduce((sum, r) => sum + Number(r.net_amount), 0) + adjustmentRows.reduce((sum, r) => sum + Number(r.amount), 0) - recoverAmount;
    if (totalAmount <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Nothing to pay this time: ¥${recoverAmount.toFixed(2)} must still be recovered from this supplier, which is more than is owed. It will be taken off a later payout.`, code: 'recover_exceeds_owed' });
    }

    const { rows: payoutRows } = await client.query(
      `INSERT INTO payouts (supplier_id, amount, currency_code, notes, created_by_admin_id) VALUES ($1, $2, 'CNY', $3, $4) RETURNING *`,
      [supplierId, totalAmount.toFixed(2), notes || null, req.user.sub]
    );
    const payoutId = payoutRows[0].id;
    for (const row of eligibleRows) {
      await client.query('INSERT INTO payout_sub_orders (payout_id, sub_order_id) VALUES ($1, $2)', [payoutId, row.sub_order_id]);
    }
    if (adjustmentRows.length > 0) {
      await client.query('UPDATE payout_adjustments SET payout_id = $1 WHERE id = ANY($2::int[])', [payoutId, adjustmentRows.map((r) => r.id)]);
    }
    for (const r of recoverRows) {
      await client.query('INSERT INTO supplier_recoveries (sub_order_id, supplier_id, amount, reason, payout_id) VALUES ($1, $2, $3, $4, $5)', [r.sub_order_id, supplierId, Number(r.net_amount).toFixed(2), r.lost_reason, payoutId]);
    }
    await client.query('COMMIT');
    await logAdminAction(req, 'payout_recorded', 'payout', payoutId, { supplierId, amount: Number(totalAmount.toFixed(2)), subOrderCount: eligibleRows.length, recovered: Number(recoverAmount.toFixed(2)), recoveredOrders: recoverRows.length });

    // REAL BUG FOUND AND FIXED HERE (same real bug already found and
    // fixed on hub/routes.js, order/routes.js, and supplier/routes.js
    // in this same pass): res.json now happens FIRST -- a real,
    // best-effort email must never be able to block the real,
    // already-recorded payout's own response if an SMTP server is ever
    // slow or unreachable.
    res.status(201).json({
      id: payoutId,
      supplierId,
      amount: Number(payoutRows[0].amount),
      currencyCode: payoutRows[0].currency_code,
      notes: payoutRows[0].notes,
      subOrderCount: eligibleRows.length,
      adjustmentCount: adjustmentRows.length,
      recoveredAmount: Number(recoverAmount.toFixed(2)),
      recoveredCount: recoverRows.length,
      createdAt: payoutRows[0].created_at,
    });

    (async () => {
      try {
        const { rows: userRows } = await db.query('SELECT email, name FROM users WHERE supplier_id = $1 AND role = $2', [supplierId, 'supplier']);
        if (userRows.length > 0) {
          const { html, text } = payoutConfirmationEmail({ recipientName: userRows[0].name, amount: totalAmount, currencyCode: payoutRows[0].currency_code, subOrderCount: eligibleRows.length });
          await sendTransactionalEmail({ to: userRows[0].email, subject: 'Payout recorded', html, text, fallbackLogLabel: 'payout-confirmation' });
        }
      } catch (err) {
        console.error('Payout confirmation email failed (non-fatal):', err.message);
      }
    })();
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
module.exports.ELIGIBLE_SUB_ORDERS_CTE = ELIGIBLE_SUB_ORDERS_CTE;
