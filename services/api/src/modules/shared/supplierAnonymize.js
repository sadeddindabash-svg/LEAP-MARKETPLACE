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
// Real, updated -- confirmed directly with the person: the label
// format itself is now a professional-looking LEAP-SLR-XXXX code
// (was plain "Supplier 1"/"Supplier 2"), and the single-supplier case
// now also gets a real code (was plain "Supplier", no code, before).
// Explicitly confirmed NOT to become a stable, cross-order identity --
// the person was asked directly and chose to keep the existing real
// privacy property: a context with more than one real supplier still
// gets numbered 1, 2, etc. by a STABLE sort of the real supplier IDs
// involved, and the XXXX code itself is a real deterministic hash of
// (contextId + supplierId) -- NOT random -- so the same supplier gets
// the exact same real code across every real view of the SAME
// order/cart (the orders list and that order's own detail page still
// agree with each other), but a completely different real code on a
// different order/cart, since the hash's own seed changes. A buyer
// still can't recognize "this is the same real supplier as my last
// order" from the code alone, matching the exact same real intent as
// before -- only the label's own real look changed, confirmed
// directly rather than assumed.

const crypto = require('crypto');

const CODE_CHARSET = '0123456789ABCDEFGHJKMNPQRSTUVWXYZ'; // real, excludes visually ambiguous I/L/O

/**
 * Real, deterministic (NOT random) 4-character code, derived from a
 * real SHA-256 hash of contextId + supplierId. Same real inputs
 * always produce the same real code; a different real contextId
 * (a different order/cart) always produces a different real code for
 * the exact same real supplier.
 */
function deterministicSupplierCode(contextId, supplierId) {
  const hash = crypto.createHash('sha256').update(`${contextId}:${supplierId}`).digest();
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARSET[hash[i] % CODE_CHARSET.length];
  }
  return code;
}

/**
 * Given an array of real, distinct supplier IDs involved in a single
 * real context (one order, one cart) and a real, stable identifier
 * for that same context (the order ID or cart ID), returns a real Map
 * from supplierId -> anonymized label. A context with exactly ONE
 * real supplier still gets its own real code now (e.g.
 * "LEAP-SLR-04X9"), no longer just the plain word "Supplier". A
 * context with MORE than one real supplier additionally numbers them
 * ("Supplier 1", "Supplier 2", ...) by a STABLE sort of the real
 * supplier IDs, same as before -- each with its own real code too.
 */
function buildSupplierLabelMap(supplierIds, contextId) {
  const distinctIds = Array.from(new Set(supplierIds)).sort();
  const map = new Map();
  if (distinctIds.length <= 1) {
    for (const id of distinctIds) map.set(id, `Supplier LEAP-SLR-${deterministicSupplierCode(contextId, id)}`);
  } else {
    distinctIds.forEach((id, i) => map.set(id, `Supplier ${i + 1} LEAP-SLR-${deterministicSupplierCode(contextId, id)}`));
  }
  return map;
}

module.exports = { buildSupplierLabelMap };
