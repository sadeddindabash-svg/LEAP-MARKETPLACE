const db = require('../../../db/pool');
const { ELIGIBLE_SUB_ORDERS_CTE } = require('../payouts/routes');

/**
 * Real supplier analytics (confirmed scope, picked from a list of 10
 * real options): revenue over time, order volume over time,
 * top-selling products, order status breakdown, low-stock products at
 * a glance, and payout summary. Every function here is parameterized
 * by a real supplierId, shared by both real real callers -- the
 * supplier portal's own Overview page (forced to that supplier's own
 * ID) and the admin dashboard's Overview page (an admin picks which
 * real supplier to view).
 */

// 1 & 2: real revenue and real order volume over time, combined into
// one real query (grouped by real calendar day) since both come from
// the exact same real underlying rows.
async function getRevenueAndVolumeOverTime(supplierId, days = 30) {
  const { rows } = await db.query(
    `SELECT date_trunc('day', o.placed_at) AS day,
            COUNT(DISTINCT so.id) AS order_count,
            COALESCE(SUM(oli.quantity * COALESCE(oli.supplier_unit_price_cny, 0)), 0) AS revenue
     FROM supplier_sub_orders so
     JOIN orders o ON o.id = so.order_id
     JOIN order_line_items oli ON oli.sub_order_id = so.id
     WHERE so.supplier_id = $1 AND o.placed_at >= now() - ($2 || ' days')::interval
     GROUP BY day
     ORDER BY day ASC`,
    [supplierId, days]
  );
  return rows.map((r) => ({ day: r.day, orderCount: Number(r.order_count), revenue: Number(r.revenue) }));
}

// 3: real top-selling products, by real quantity sold.
async function getTopSellingProducts(supplierId, limit = 5) {
  const { rows } = await db.query(
    `SELECT p.id, p.name, SUM(oli.quantity) AS units_sold, SUM(oli.quantity * COALESCE(oli.supplier_unit_price_cny, 0)) AS revenue
     FROM order_line_items oli
     JOIN supplier_sub_orders so ON so.id = oli.sub_order_id
     JOIN products p ON p.id = oli.product_id
     WHERE so.supplier_id = $1
     GROUP BY p.id, p.name
     ORDER BY units_sold DESC
     LIMIT $2`,
    [supplierId, limit]
  );
  return rows.map((r) => ({ productId: r.id, name: r.name, unitsSold: Number(r.units_sold), revenue: Number(r.revenue) }));
}

// 5 (confirmed numbering: order status breakdown): a real, current
// snapshot count by real sub-order status.
async function getOrderStatusBreakdown(supplierId) {
  const { rows } = await db.query(
    `SELECT status, COUNT(*) AS count FROM supplier_sub_orders WHERE supplier_id = $1 GROUP BY status`,
    [supplierId]
  );
  return rows.map((r) => ({ status: r.status, count: Number(r.count) }));
}

// 9: real low-stock products at a glance -- reuses the exact same real
// threshold comparison the low-stock alert itself checks (migration
// 037), just as a real, glanceable list rather than a one-time
// notification.
async function getLowStockProducts(supplierId) {
  const { rows } = await db.query(
    `SELECT id, name, stock_quantity, low_stock_threshold
     FROM products
     WHERE supplier_id = $1 AND stock_quantity <= low_stock_threshold AND status = 'active'
     ORDER BY stock_quantity ASC`,
    [supplierId]
  );
  return rows.map((r) => ({ productId: r.id, name: r.name, stockQuantity: r.stock_quantity, lowStockThreshold: r.low_stock_threshold }));
}

// 10: real payout summary -- total real amount actually paid out
// historically, plus the real current amount owed, reusing the EXACT
// same real eligible-sub-orders logic the Payouts page's own "Amount
// owed" figure uses (services/api/src/modules/payouts/routes.js),
// rather than a second, potentially-drifting reimplementation.
async function getPayoutSummary(supplierId) {
  const { rows: paidRows } = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payouts WHERE supplier_id = $1 AND currency_code = 'CNY'`,
    [supplierId]
  );
  const { rows: owedRows } = await db.query(
    `${ELIGIBLE_SUB_ORDERS_CTE}
     SELECT COALESCE(SUM(net_amount), 0) AS amount_owed FROM eligible WHERE supplier_id = $1`,
    [supplierId]
  );
  return {
    currencyCode: 'CNY',
    totalPaid: Number(paidRows[0].total_paid),
    amountOwed: Number(owedRows[0].amount_owed),
  };
}

// How the supplier's orders ended up, for the Overview pie chart. Every order (sub-order) is in exactly ONE group:
//   cancelled   = cancelled (by the buyer, or refused by the supplier)
//   returned    = a return case that was not rejected
//   succeeded   = delivered to the buyer and not returned
//   inProgress  = everything else (not delivered yet)
async function getOrderOutcomes(supplierId) {
  const { rows } = await db.query(
    `SELECT CASE
              WHEN so.status = 'cancelled' THEN 'cancelled'
              WHEN EXISTS (SELECT 1 FROM return_cases rc WHERE rc.sub_order_id = so.id AND rc.status <> 'rejected') THEN 'returned'
              WHEN EXISTS (SELECT 1 FROM hub_shipments hs WHERE hs.sub_order_id = so.id AND hs.status = 'delivered') THEN 'succeeded'
              ELSE 'inProgress'
            END AS outcome, COUNT(*) AS n
     FROM supplier_sub_orders so WHERE so.supplier_id = $1 GROUP BY 1`,
    [supplierId]
  );
  const out = { total: 0, succeeded: 0, inProgress: 0, cancelled: 0, returned: 0 };
  for (const r of rows) { out[r.outcome] = Number(r.n); out.total += Number(r.n); }
  return out;
}

async function getSupplierAnalytics(supplierId) {
  const [revenueAndVolume, topProducts, statusBreakdown, lowStockProducts, payoutSummary, outcomes] = await Promise.all([
    getRevenueAndVolumeOverTime(supplierId),
    getTopSellingProducts(supplierId),
    getOrderStatusBreakdown(supplierId),
    getLowStockProducts(supplierId),
    getPayoutSummary(supplierId),
    getOrderOutcomes(supplierId),
  ]);
  return { revenueAndVolume, topProducts, statusBreakdown, lowStockProducts, payoutSummary, outcomes };
}

module.exports = {
  getRevenueAndVolumeOverTime,
  getTopSellingProducts,
  getOrderStatusBreakdown,
  getLowStockProducts,
  getPayoutSummary,
  getOrderOutcomes,
  getSupplierAnalytics,
};
