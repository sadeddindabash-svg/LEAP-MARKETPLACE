const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');
const costs = require('./service');

// Parcel shipping costs (migration 127; see ./service.js).
//   Hub staff:  GET  /parcel-costs/hub/:shipmentId     whether it may ship (never an amount)
//               POST /parcel-costs/hub/:shipmentId     { amount, currency, carrier, receiptPhoto?, parcelPhoto? }
//   Admin:      GET  /parcel-costs?period=&date=       every parcel's cost in the period, the totals, the parcels waiting
//               POST /parcel-costs/:id/approve | /parcel-costs/:id/send-back { note? }
const router = express.Router();

const answer = (res, next) => (err) => {
  if (err instanceof costs.ParcelCostError) return res.status(err.status).json({ error: err.message, code: err.code });
  next(err);
};

router.get('/hub/:shipmentId', requireAuth, requireRole('hub_staff'), (req, res, next) => {
  costs.hubStatus(db, { shipmentId: req.params.shipmentId, hubId: req.user.hubId }).then((x) => res.json(x)).catch(answer(res, next));
});

router.post('/hub/:shipmentId', requireAuth, requireRole('hub_staff'), (req, res, next) => {
  costs.hubSave(db, { shipmentId: req.params.shipmentId, hubId: req.user.hubId, userId: req.user.sub, body: req.body || {} })
    .then((x) => res.status(201).json(x)).catch(answer(res, next));
});

router.get('/', requireAuth, requireRole('admin'), requirePageAccess('shippingCosts'), (req, res, next) => {
  costs.adminReport(db, { kind: req.query.period || 'month', date: req.query.date || undefined }).then((x) => res.json(x)).catch(answer(res, next));
});

for (const [path, approve] of [['approve', true], ['send-back', false]]) {
  router.post(`/:id/${path}`, requireAuth, requireRole('admin'), requirePageAccess('shippingCosts'), async (req, res, next) => {
    try {
      const row = await costs.decide(db, { id: req.params.id, adminId: req.user.sub, approve, note: req.body && req.body.note });
      await logAdminAction(req, approve ? 'parcel_cost_approved' : 'parcel_cost_sent_back', 'hub_shipment', String(row.shipment_id),
        { amount: Number(row.amount), currency: row.currency, paidUsd: Number(row.amount_usd), plannedUsd: row.planned_usd === null ? null : Number(row.planned_usd), note: row.admin_note });
      res.json(costs.adminDto({ ...row, order_id: null, weight_kg: null, entered_local: new Date().toISOString() }));
    } catch (err) {
      answer(res, next)(err);
    }
  });
}

module.exports = router;
