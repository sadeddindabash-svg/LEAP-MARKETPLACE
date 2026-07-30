// Real, shared helper for anonymizing supplier identity in every
// buyer-facing response (BUSINESS DECISION, confirmed directly, not
// assumed: buyers should never see a real supplier's name or any
// other identifying info anywhere in the app -- search, product
// pages, cart, checkout, orders, tracking, returns, reviews. Internal
// views (admin dashboard, supplier portal, hub portal) are
// deliberately UNCHANGED -- this only ever runs on a real
// buyer-facing response path, never touches the underlying real data
// or what an admin/supplier/hub user sees of their own information.
//
// Numbering scheme (confirmed directly): a context with exactly ONE
// real supplier (a single product, a single return case) shows just
// "Supplier" -- no number, since there's nothing to distinguish from.
// A context with MORE than one real supplier (an order or cart split
// across multiple sellers) shows "Supplier 1", "Supplier 2", etc.,
// numbered by a STABLE sort of the real supplier IDs involved -- so
// the same supplier is always the same number across every real view
// of the SAME order/cart (e.g. the orders list and that order's own
// detail page agree with each other), not a fresh, inconsistent
// random assignment on every request. This numbering is deliberately
// scoped to the one real order/cart being anonymized right now, not a
// globally stable anonymous ID -- a buyer isn't meant to recognize
// "this is the same real supplier as my last order" either.

/**
 * Given an array of real, distinct supplier IDs involved in a single
 * real context (one order, one cart), returns a real Map from
 * supplierId -> anonymized label ("Supplier" if there's only one real
 * supplier, "Supplier 1"/"Supplier 2"/etc. if there's more than one).
 */
function buildSupplierLabelMap(supplierIds) {
  const distinctIds = Array.from(new Set(supplierIds)).sort();
  const map = new Map();
  if (distinctIds.length <= 1) {
    for (const id of distinctIds) map.set(id, 'Supplier');
  } else {
    distinctIds.forEach((id, i) => map.set(id, `Supplier ${i + 1}`));
  }
  return map;
}

module.exports = { buildSupplierLabelMap };
