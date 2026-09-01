// Confirmed with the person: the real hub shipment workflow's real
// stage order, extracted here from hub/routes.js's own original
// definition so order/routes.js can reuse this exact same real
// ordering (for aggregating an order's real hub status across
// however many real supplier sub-orders it split into) rather than a
// second, separately-maintained copy that could drift out of sync.
const STATUS_ORDER = ['awaiting_receipt', 'received', 'opened', 'inspected', 'packed', 'shipped_to_buyer'];

module.exports = { STATUS_ORDER };
