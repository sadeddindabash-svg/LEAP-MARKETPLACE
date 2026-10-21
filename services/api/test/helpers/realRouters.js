// Loads the REAL order, supplier, catalog and login routers for the tests. Some project files are not present in every working copy (loyalty, hub status order, supplier labels, shared product
// validation, discount rules, delivery estimate): for those, and ONLY if the file really cannot be found, a tiny stand-in is used that none of the code under test relies on. In a full project the stand-ins are never used.
const Module = require('module');
const STAND_INS = {
  'loyalty/helpers': { getLoyaltyDiscountPercentage: async () => 0 },
  'shared/hubStatusOrder': { STATUS_ORDER: [] },
  'shared/supplierAnonymize': { buildSupplierLabelMap: () => new Map() },
  'shared/productValidation': new Proxy({}, { get: () => () => ({}) }),
  'pricing/discountRules': { findMatchingDiscountRule: async () => null },
  'deliveryEstimate/engine': { resolveDestinationIsoCode: async () => null, calculateDeliveryDays: () => null },
};
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  try { return originalLoad.apply(this, arguments); }
  catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND' && typeof request === 'string' && request.startsWith('.')) {
      for (const [suffix, stub] of Object.entries(STAND_INS)) if (request.endsWith(suffix)) return stub;
    }
    throw err;
  }
};
const express = require('express');
function buildApp() {
  const app = express(); app.use(express.json());
  app.use('/auth', require('../../src/modules/auth/routes'));
  app.use('/orders', require('../../src/modules/order/routes'));
  app.use('/supplier', require('../../src/modules/supplier/routes'));
  app.use('/catalog', require('../../src/modules/catalog/routes'));
  app.use('/platform-settings', require('../../src/modules/platform-settings/routes'));
  app.use((err, req, res, next) => res.status(500).json({ error: err.message }));
  return app;
}
module.exports = { buildApp };
