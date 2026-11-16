const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');
const { describeControls } = require('../supplier/orderRules');
const { REFUSAL_REASONS, ResponseError, acceptSubOrder, refuseSubOrder, announceRefusal, listForAdmin, alternativesFor, markHandled, reassignRefused, announceReassignment } = require('./helpers');

// ---------------- the supplier's answer: mounted at /supplier/me/orders
const supplierRouter = express.Router();

async function inTransaction(fn) {
  const client = await db.getPool().connect();
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}
const fail = (res, err, next) => (err instanceof ResponseError ? res.status(err.status).json({ error: err.message, ...(err.code ? { code: err.code } : {}) }) : next(err));

// POST /:subOrderId/accept   the same steps as before (preparing, then ship to the hub); after this the order can no longer be refused here
supplierRouter.post('/:subOrderId/accept', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try {
    const row = await inTransaction((client) => acceptSubOrder(client, { subOrderId: req.params.subOrderId, supplierId: req.user.supplierId }));
    res.json({ subOrderId: row.id, orderId: row.order_id, status: row.status, acceptedAt: row.accepted_at, ...describeControls({ status: row.status, hubShipmentStatus: null }) });
  } catch (err) { fail(res, err, next); }
});

// POST /:subOrderId/refuse  { reason, note? }   reason: out_of_stock | price_changed | discontinued | cannot_ship_in_time | other (other needs a short note)
supplierRouter.post('/:subOrderId/refuse', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try {
    const { reason, note } = req.body || {};
    const result = await inTransaction((client) => refuseSubOrder(client, { subOrderId: req.params.subOrderId, supplierId: req.user.supplierId, reason, note }));
    res.json({ subOrderId: result.subOrder.id, orderId: result.subOrder.order_id, status: result.subOrder.status, refusalReason: result.subOrder.refusal_reason, orderCancelled: result.orderCancelled, ...describeControls({ status: 'cancelled', hubShipmentStatus: null }) });
    announceRefusal(result);
  } catch (err) { fail(res, err, next); }
});

// ---------------- the admin's side: mounted at /supplier-responses
const adminRouter = express.Router();
const admin = [requireAuth, requireRole('admin'), requirePageAccess('orders')];

// GET /?filter=open|handled|all   the refused orders and the ones nobody answered in 24 hours
adminRouter.get('/', ...admin, async (req, res, next) => {
  try { res.json(await listForAdmin({ filter: req.query.filter || 'open' })); } catch (err) { fail(res, err, next); }
});
adminRouter.get('/reasons', ...admin, (req, res) => res.json(REFUSAL_REASONS));
adminRouter.get('/:subOrderId/alternatives', ...admin, async (req, res, next) => {
  try { res.json(await alternativesFor(req.params.subOrderId)); } catch (err) { fail(res, err, next); }
});
adminRouter.post('/:subOrderId/handled', ...admin, async (req, res, next) => {
  try { await markHandled(req.params.subOrderId, req.user.sub, req.body?.note); await logAdminAction(req, 'supplier_refusal_handled', 'sub_order', req.params.subOrderId, {}); res.json({ subOrderId: Number(req.params.subOrderId), handled: true }); } catch (err) { fail(res, err, next); }
});
// POST /:subOrderId/reassign  { items: [{ productId, alternativeProductId }] }
adminRouter.post('/:subOrderId/reassign', ...admin, async (req, res, next) => {
  try {
    const result = await inTransaction((client) => reassignRefused(client, { subOrderId: req.params.subOrderId, adminId: req.user.sub, mapping: req.body?.items }));
    await logAdminAction(req, 'supplier_refusal_reassigned', 'sub_order', req.params.subOrderId, { newSubOrderId: result.newSubOrderId, newSupplierId: result.newSupplierId });
    res.status(201).json({ subOrderId: Number(req.params.subOrderId), reassignedTo: { subOrderId: result.newSubOrderId, supplierId: result.newSupplierId } });
    announceReassignment(result);
  } catch (err) { fail(res, err, next); }
});

module.exports = { supplierRouter, adminRouter };
