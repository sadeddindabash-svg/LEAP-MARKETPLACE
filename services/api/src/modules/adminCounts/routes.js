const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { countsFor } = require('./service');

// GET /admin-counts -- the numbers in the admin portal's side menu (see ./service.js). A number for a page this admin may not open is null.
const router = express.Router();
const PAGE_OF = { orders: 'orders', suppliers: 'suppliers', supplierMessages: 'supplierMessages', returns: 'returns', flagged: 'flagged', tickets: 'tickets', shippingCosts: 'shippingCosts' };

// the same check as requirePageAccess, as a yes / no
const mayOpen = (req, pageId) => new Promise((resolve) => {
  const res = { status: () => ({ json: () => resolve(false) }) };
  requirePageAccess(pageId)(req, res, (err) => resolve(!err));
});

router.get('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const counts = await countsFor(db);
    const out = {};
    for (const [key, pageId] of Object.entries(PAGE_OF)) out[key] = (await mayOpen(req, pageId)) ? counts[key] : null;
    res.json(out);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
