const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');
const helpers = require('./helpers');

const { FaultCaseError } = helpers;
const router = express.Router();

/**
 * Fault cases (migration 091) -- see helpers.js for the rules and the state flow.
 *
 * ADMIN (needs access to the Flagged page):
 *   POST /fault-cases                      { shipmentId, items:[productId], costBearer, notes? }  open a case (real fault)
 *   POST /fault-cases/:id/confirm-refund   { amount? }          confirm a refund (default amount = the faulty items' value)
 *   POST /fault-cases/:id/mark-refunded    { reference }        the refund was made manually in Stripe/PayPal
 * SUPPLIER (their own cases only):
 *   GET  /fault-cases/supplier/me                                 the replacement questions and their outcomes
 *   POST /fault-cases/supplier/me/:id/answer { canReplace, eta?, note? }
 *
 * Each endpoint runs in ONE transaction; notices to buyers and suppliers go out only after the commit.
 */

// Runs `work(client)` in a transaction, then sends the notifications it returned. FaultCaseError becomes
// its own status code; anything else is a real server error.
async function inTransaction(res, next, work) {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    const outcome = await work(client);
    await client.query('COMMIT');
    if (outcome.notifications) await helpers.sendNotifications(outcome.notifications);
    return outcome;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* already rolled back */ }
    if (err instanceof FaultCaseError) {
      res.status(err.status).json({ error: err.message });
      return null;
    }
    next(err);
    return null;
  } finally {
    client.release();
  }
}

const adminOnly = [requireAuth, requireRole('admin'), requirePageAccess('flagged')];
const supplierOnly = [requireAuth, requireRole('supplier')];

// ------------------------------- supplier (declared first: '/supplier/me' must not match '/:id') -------------------------------

// GET /fault-cases/supplier/me -- unanswered questions first, then everything else, newest first.
router.get('/supplier/me', ...supplierOnly, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT fc.*, so.order_id FROM fault_cases fc JOIN supplier_sub_orders so ON so.id = fc.sub_order_id
       WHERE so.supplier_id = $1
       ORDER BY (fc.status = 'awaiting_supplier') DESC, fc.created_at DESC`,
      [req.user.supplierId]
    );
    res.json(await Promise.all(rows.map(async (r) => {
      const dto = await helpers.toAdminDto(db, r);
      // The supplier needs the question, their own answer and how it ended. They do NOT see the
      // platform's private notes, who bears the cost, or the refund amount.
      return {
        id: dto.id, orderId: r.order_id, status: dto.status, createdAt: dto.createdAt, items: dto.items.map(({ productId, name, quantity }) => ({ productId, name, quantity })),
        answered: dto.supplier.answered, canReplace: dto.supplier.canReplace, eta: dto.supplier.eta, note: dto.supplier.note,
        outcome: dto.outcome, hubReturn: dto.hubReturn, returnTrackingNumber: dto.hubReturnTracking,
        // WHY it was flagged: the inspector's note, the kind of problem and the photos (not the platform's private notes)
        evidence: dto.evidence,
        // the replacement order the supplier has to ship (migration 095)
        replacementOrderId: dto.replacement ? dto.replacement.orderId : null,
      };
    })));
  } catch (err) {
    next(err);
  }
});

// POST /fault-cases/supplier/me/:id/answer { canReplace, eta?, note? }
router.post('/supplier/me/:id/answer', ...supplierOnly, async (req, res, next) => {
  const { canReplace, eta, note } = req.body || {};
  const outcome = await inTransaction(res, next, (client) => helpers.recordSupplierAnswer(client, {
    caseId: Number(req.params.id), supplierId: req.user.supplierId, userId: req.user.sub, canReplace, eta, note,
  }));
  if (!outcome) return;
  res.json(await helpers.toAdminDto(db, outcome.faultCase).then((d) => ({ id: d.id, status: d.status, answered: d.supplier.answered, canReplace: d.supplier.canReplace, eta: d.supplier.eta, note: d.supplier.note })));
});

// ------------------------------------------------------- admin -------------------------------------------------------

router.post('/', ...adminOnly, async (req, res, next) => {
  const { shipmentId, items, costBearer, notes } = req.body || {};
  const outcome = await inTransaction(res, next, (client) => helpers.createFaultCase(client, { shipmentId: Number(shipmentId), items, costBearer, notes, adminId: req.user.sub }));
  if (!outcome) return;
  await logAdminAction(req, 'fault_case_created', 'fault_case', String(outcome.faultCase.id), {
    shipmentId: outcome.faultCase.shipment_id, orderId: outcome.orderId, items, costBearer, returnCaseId: outcome.returnCase ? outcome.returnCase.id : null,
  });
  res.status(201).json({ faultCase: await helpers.toAdminDto(db, outcome.faultCase), returnCase: outcome.returnCase });
});

router.post('/:id/confirm-refund', ...adminOnly, async (req, res, next) => {
  const outcome = await inTransaction(res, next, (client) => helpers.confirmRefund(client, { caseId: Number(req.params.id), amount: req.body?.amount, adminId: req.user.sub }));
  if (!outcome) return;
  await logAdminAction(req, 'fault_case_refund_confirmed', 'fault_case', String(outcome.faultCase.id), {
    amount: Number(outcome.faultCase.refund_amount), suggestedAmount: outcome.suggestedAmount, returnCaseId: outcome.returnCase ? outcome.returnCase.id : null,
  });
  res.json({ faultCase: await helpers.toAdminDto(db, outcome.faultCase), returnCase: outcome.returnCase });
});

router.post('/:id/confirm-replacement', ...adminOnly, async (req, res, next) => {
  const outcome = await inTransaction(res, next, (client) => helpers.confirmReplacement(client, { caseId: Number(req.params.id), adminId: req.user.sub }));
  if (!outcome) return;
  await logAdminAction(req, 'fault_case_replacement_confirmed', 'fault_case', String(outcome.faultCase.id), {
    replacementOrderId: outcome.replacementOrderId, costBearer: outcome.faultCase.cost_bearer, returnCaseId: outcome.returnCase ? outcome.returnCase.id : null,
  });
  res.json({ faultCase: await helpers.toAdminDto(db, outcome.faultCase), returnCase: outcome.returnCase });
});

router.post('/:id/release-supplier-payment', ...adminOnly, async (req, res, next) => {
  const outcome = await inTransaction(res, next, (client) => helpers.releaseSupplierPayment(client, {
    caseId: Number(req.params.id), adminId: req.user.sub, localShippingAmount: (req.body || {}).localShippingAmount, note: (req.body || {}).note,
  }));
  if (!outcome) return;
  await logAdminAction(req, 'fault_case_supplier_payment_released', 'fault_case', String(req.params.id), { originalOrder: outcome.originalOrder, localShipping: outcome.localShipping });
  const { rows } = await db.query('SELECT * FROM fault_cases WHERE id = $1', [req.params.id]);
  res.json({ faultCase: await helpers.toAdminDto(db, rows[0]) });
});

router.post('/:id/close', ...adminOnly, async (req, res, next) => {
  const outcome = await inTransaction(res, next, (client) => helpers.closeCaseManually(client, { caseId: Number(req.params.id), adminId: req.user.sub, note: (req.body || {}).note }));
  if (!outcome) return;
  await logAdminAction(req, 'fault_case_closed_manually', 'fault_case', String(outcome.faultCase.id), { note: outcome.faultCase.closed_manually_note, returnCaseId: outcome.returnCase ? outcome.returnCase.id : null });
  res.json({ faultCase: await helpers.toAdminDto(db, outcome.faultCase), returnCase: outcome.returnCase });
});

router.post('/:id/mark-refunded', ...adminOnly, async (req, res, next) => {
  const outcome = await inTransaction(res, next, (client) => helpers.markRefunded(client, { caseId: Number(req.params.id), reference: req.body?.reference, adminId: req.user.sub }));
  if (!outcome) return;
  await logAdminAction(req, 'fault_case_refund_issued', 'fault_case', String(outcome.faultCase.id), {
    amount: Number(outcome.faultCase.refund_amount), reference: outcome.faultCase.refund_reference, completed: outcome.faultCase.status === 'completed',
  });
  res.json({ faultCase: await helpers.toAdminDto(db, outcome.faultCase), returnCase: outcome.returnCase });
});

module.exports = router;
