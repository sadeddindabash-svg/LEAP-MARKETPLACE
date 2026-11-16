const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess, hasPageAccess } = require('../auth/middleware');

/**
 * Overview module — real aggregate KPIs for the admin dashboard's
 * landing page (ADM's top-level "how's the business doing" view).
 *
 * DELIBERATELY DOES NOT show a blended dollar GMV figure. Orders span 26+
 * currencies across the 40 confirmed launch markets, and this system has
 * no FX/exchange-rate conversion anywhere — summing raw `orders.total`
 * across currencies would produce a real-looking number that's actually
 * meaningless (a USD total plus a SAR total plus a SEK total is not a
 * dollar amount). The original mock UI showed a fake "$171,450 GMV"
 * figure; this endpoint uses order COUNTS instead wherever a dollar
 * amount would require FX conversion that doesn't exist yet.
 *
 * ALSO DELIBERATELY DOES NOT show "top markets by country" — the orders
 * table has no country field (only currency_code, which isn't a reliable
 * proxy for country). Replaced with "top suppliers by order volume",
 * which IS real and trackable from existing data.
 *
 * ALSO DROPPED entirely: the mock's "$19.8k in payouts scheduled" row —
 * there is no payouts feature in this codebase yet (blocked on an
 * undecided commission-rate business decision, see the Charter).
 * Showing a fake payout figure here would be worse than omitting it.
 */
const router = express.Router();

// Total products (all, and live), total profit (all time, as Financial -> Profits counts it) and what Leap owes suppliers now (as Payouts counts it).
// The two money figures only go to an admin who may open that page. A figure that fails is left out; the page shows the rest.
async function moneyAndProducts(req) {
  const out = {};
  try {
    const { rows: [p] } = await db.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'active') AS live FROM products`);
    out.totalProducts = Number(p.total); out.liveProducts = Number(p.live);
  } catch (err) { console.warn('[overview] products count failed:', err.message); }
  try {
    if (await hasPageAccess(req.user.sub, 'profits')) {
      const profit = await require('../profits/service').allTimeProfit(db);
      out.totalProfitUsd = profit.netProfit; out.profitMargin = profit.margin; out.expectedProfitUsd = profit.expectedProfit;
    }
  } catch (err) { console.warn('[overview] total profit failed:', err.message); }
  try {
    if (await hasPageAccess(req.user.sub, 'payouts')) {
      const totals = Object.values(await require('../payouts/terms').supplierTotals(db));
      const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
      out.owedToSuppliersCny = r2(totals.reduce((s, t) => s + Math.max(0, t.payNow), 0));
      out.notDueToSuppliersCny = r2(totals.reduce((s, t) => s + t.notDue.amount, 0));
      out.suppliersOwed = totals.filter((t) => t.payNow > 0).length;
      // the 5 suppliers owed the most now, for the Overview's bars
      const top = totals.filter((t) => t.payNow > 0).sort((a, b) => b.payNow - a.payNow).slice(0, 5);
      const { rows: names } = top.length ? await db.query('SELECT id, name FROM suppliers WHERE id = ANY($1::text[])', [top.map((t) => String(t.supplierId))]) : { rows: [] };
      const nameOf = Object.fromEntries(names.map((n) => [String(n.id), n.name]));
      out.owedTop = top.map((t) => ({ supplierId: t.supplierId, name: nameOf[String(t.supplierId)] || String(t.supplierId), amountCny: r2(t.payNow) }));
    }
  } catch (err) { console.warn('[overview] owed to suppliers failed:', err.message); }
  // Sales, all time, parts not cancelled and not refused (USD): what the buyers were charged, what goes to the suppliers (at each order's own rate),
  // the shipping inside the prices, and the rest = Leap's markup and fees together (the fee lines are not kept per order). Admins who may open Profits only.
  try {
    if (await hasPageAccess(req.user.sub, 'profits')) {
      const { rows: [s] } = await db.query(`
        SELECT COALESCE(SUM(oli.unit_price * oli.quantity), 0) AS sales,
               COALESCE(SUM(COALESCE(oli.supplier_unit_price_cny, 0) * oli.quantity * COALESCE(o.fx_cny_usd, (SELECT rate FROM fx_rates WHERE currency_pair = 'CNY_USD'), 0)), 0) AS supplier,
               COALESCE(SUM(COALESCE(oli.shipping_planned_usd, 0) * oli.quantity), 0) AS shipping
        FROM order_line_items oli
        JOIN supplier_sub_orders so ON so.id = oli.sub_order_id
        JOIN orders o ON o.id = so.order_id
        WHERE so.status <> 'cancelled' AND so.refused_at IS NULL`);
      const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
      const sales = r2(s.sales); const supplier = r2(s.supplier); const shipping = r2(s.shipping);
      out.salesSplit = { salesUsd: sales, supplierUsd: supplier, shippingUsd: shipping, markupUsd: r2(Math.max(0, sales - supplier - shipping)) };
    }
  } catch (err) { console.warn('[overview] sales split failed:', err.message); }
  // Orders by how they ended: cancelled (every part cancelled or refused), returned (a return was approved), completed (every live part delivered), in progress.
  try {
    const { rows: [o] } = await db.query(`
      WITH x AS (
        SELECT o.id, o.status,
               COALESCE(bool_and(so.status = 'cancelled' OR so.refused_at IS NOT NULL), false) AS all_cancelled,
               COALESCE(bool_or(EXISTS (SELECT 1 FROM return_cases rc WHERE rc.sub_order_id = so.id AND rc.status IN ('approved', 'completed'))), false) AS returned,
               COALESCE(bool_and(so.status = 'cancelled' OR so.refused_at IS NOT NULL OR EXISTS (SELECT 1 FROM hub_shipments hs WHERE hs.sub_order_id = so.id AND hs.status = 'delivered')), false) AS all_delivered,
               COUNT(so.id) AS parts
        FROM orders o LEFT JOIN supplier_sub_orders so ON so.order_id = o.id
        GROUP BY o.id, o.status)
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status = 'cancelled' OR (parts > 0 AND all_cancelled)) AS cancelled,
             COUNT(*) FILTER (WHERE NOT (status = 'cancelled' OR (parts > 0 AND all_cancelled)) AND returned) AS returned,
             COUNT(*) FILTER (WHERE NOT (status = 'cancelled' OR (parts > 0 AND all_cancelled)) AND NOT returned AND parts > 0 AND all_delivered) AS completed
      FROM x`);
    const total = Number(o.total); const cancelled = Number(o.cancelled); const returned = Number(o.returned); const completed = Number(o.completed);
    out.orderSplit = { total, cancelled, returned, completed, inProgress: Math.max(0, total - cancelled - returned - completed) };
  } catch (err) { console.warn('[overview] orders split failed:', err.message); }
  try {
    const { rows: [t] } = await db.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'open') AS open, COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress, COUNT(*) FILTER (WHERE status = 'resolved') AS resolved FROM support_tickets`);
    out.ticketSplit = { total: Number(t.total), open: Number(t.open), inProgress: Number(t.in_progress), resolved: Number(t.resolved) };
  } catch (err) { console.warn('[overview] tickets split failed:', err.message); }
  return out;
}

router.get('/', requireAuth, requireRole('admin'), requirePageAccess('overview'), async (req, res, next) => {
  try {
    const [
      totalOrders,
      activeSuppliers,
      pendingSuppliers,
      openDisputes,
      pendingModeration,
      openTickets,
      ordersByDay,
      unitsByCategory,
      topSuppliers,
    ] = await Promise.all([
      db.query('SELECT COUNT(*) AS n FROM orders'),
      db.query(`SELECT COUNT(*) AS n FROM suppliers WHERE verification_status = 'verified'`),
      db.query(`SELECT COUNT(*) AS n FROM suppliers WHERE verification_status = 'pending'`),
      db.query(`SELECT COUNT(*) AS n FROM return_cases WHERE status IN ('awaiting', 'in_progress')`),
      db.query(`SELECT COUNT(*) AS n FROM products WHERE status = 'translating'`),
      db.query(`SELECT COUNT(*) AS n FROM support_tickets WHERE status != 'resolved'`),
      db.query(`
        -- EVERY one of the last 7 days (today and the 6 before), with 0 for a day without orders. Before, only days that HAD orders were returned, so a
        -- chart with two busy days was a straight line between two points and the quiet days were simply missing.
        SELECT d AS day, COALESCE(c.n, 0) AS n
        FROM generate_series(date_trunc('day', now()) - interval '6 days', date_trunc('day', now()), interval '1 day') AS d
        LEFT JOIN (
          SELECT date_trunc('day', placed_at) AS day, COUNT(*) AS n FROM orders
          WHERE placed_at >= date_trunc('day', now()) - interval '6 days' GROUP BY 1
        ) c ON c.day = d
        ORDER BY d ASC
      `),
      db.query(`
        SELECT p.category, SUM(oli.quantity) AS units
        FROM order_line_items oli JOIN products p ON p.id = oli.product_id
        GROUP BY p.category ORDER BY units DESC
      `),
      db.query(`
        SELECT s.id, s.name, COUNT(DISTINCT so.order_id) AS order_count
        FROM supplier_sub_orders so JOIN suppliers s ON s.id = so.supplier_id
        GROUP BY s.id, s.name ORDER BY order_count DESC LIMIT 5
      `),
    ]);

    res.json({
      totalOrders: Number(totalOrders.rows[0].n),
      activeSuppliers: Number(activeSuppliers.rows[0].n),
      pendingSuppliers: Number(pendingSuppliers.rows[0].n),
      openDisputes: Number(openDisputes.rows[0].n),
      pendingModeration: Number(pendingModeration.rows[0].n),
      openTickets: Number(openTickets.rows[0].n),
      shippingCostsWaiting: await require('../parcelCosts/service').waitingCount(db),      // parcels waiting for approval (migration 127)
      ordersByDay: ordersByDay.rows.map((r) => ({ day: r.day, count: Number(r.n) })),
      unitsByCategory: unitsByCategory.rows.map((r) => ({ category: r.category, units: Number(r.units) })),
      topSuppliers: topSuppliers.rows.map((r) => ({ id: r.id, name: r.name, orderCount: Number(r.order_count) })),
      ...(await moneyAndProducts(req)),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
