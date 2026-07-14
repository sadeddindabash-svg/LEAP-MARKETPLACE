const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole } = require('../auth/middleware');

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

router.get('/', requireAuth, requireRole('admin'), async (req, res, next) => {
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
        SELECT date_trunc('day', placed_at) AS day, COUNT(*) AS n
        FROM orders
        WHERE placed_at > now() - interval '7 days'
        GROUP BY day ORDER BY day ASC
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
      ordersByDay: ordersByDay.rows.map((r) => ({ day: r.day, count: Number(r.n) })),
      unitsByCategory: unitsByCategory.rows.map((r) => ({ category: r.category, units: Number(r.units) })),
      topSuppliers: topSuppliers.rows.map((r) => ({ id: r.id, name: r.name, orderCount: Number(r.order_count) })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
