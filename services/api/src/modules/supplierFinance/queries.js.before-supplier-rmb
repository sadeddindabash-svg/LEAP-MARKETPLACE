const db = require('../../../db/pool');

/**
 * A supplier's own finance picture, for the supplier portal's Finance page (replaces a page
 * that showed typed-in numbers: "¥54,542", "¥60,210", "12%", and a fake payout history).
 *
 * Everything here is computed from the same rows and the same formula the admin Payouts
 * page uses (services/api/src/modules/payouts/routes.js), so a supplier and an admin always
 * see the same figures:
 *
 *   net amount of an order line = unit_price * quantity * (1 - category commission % / 100)
 *
 * An order is PAYABLE once its hub shipment is delivered, the platform's return window has
 * passed since delivery, it has no return case, and it hasn't already been paid out.
 * An order that is delivered and otherwise clean but still INSIDE the window is "in the
 * return window" -- it will become payable by itself.
 *
 * CURRENCY: unit prices are the buyer-facing USD prices, and payouts are recorded in USD
 * (payouts.currency_code defaults to USD and no route sets another), so every amount here
 * is USD. Nothing is converted to the supplier's own currency -- that would be an invented
 * number.
 */

async function getReturnWindowDays() {
  const { rows } = await db.query(`SELECT COALESCE((SELECT value FROM platform_settings WHERE key = 'return_window_days'), '7')::int AS days`);
  return rows[0].days;
}

// Delivered, unpaid, return-free orders for this supplier, split by whether the return
// window has passed. window_elapsed = true is exactly the set /payouts/owed counts.
async function getUnpaidDelivered(supplierId) {
  const { rows } = await db.query(
    `WITH window_setting AS (
       SELECT COALESCE((SELECT value FROM platform_settings WHERE key = 'return_window_days'), '7')::int AS days
     )
     SELECT (hs.delivered_at + (w.days || ' days')::interval < now()) AS window_elapsed,
            COUNT(DISTINCT so.id) AS order_count,
            COALESCE(SUM(oli.unit_price * oli.quantity * (1 - pc.commission_percent / 100.0)), 0) AS net_amount
     FROM supplier_sub_orders so
     JOIN hub_shipments hs ON hs.sub_order_id = so.id
     JOIN order_line_items oli ON oli.sub_order_id = so.id
     JOIN products p ON p.id = oli.product_id
     JOIN product_categories pc ON pc.id = p.category
     CROSS JOIN window_setting w
     WHERE so.supplier_id = $1
       AND hs.status = 'delivered'
       AND hs.delivered_at IS NOT NULL
       AND so.id NOT IN (SELECT sub_order_id FROM payout_sub_orders)
       AND NOT EXISTS (SELECT 1 FROM return_cases rc WHERE rc.sub_order_id = so.id)
     GROUP BY 1`,
    [supplierId]
  );
  const bucket = (elapsed) => {
    const row = rows.find((r) => r.window_elapsed === elapsed);
    return { amount: row ? Number(Number(row.net_amount).toFixed(2)) : 0, orderCount: row ? Number(row.order_count) : 0 };
  };
  const ready = bucket(true);
  // Payments an admin released for a fault Leap bears the cost of (migration 097): owed at once, no return window.
  const { rows: adjustmentRows } = await db.query(
    `SELECT a.kind, a.amount, so.order_id
     FROM payout_adjustments a JOIN fault_cases fc ON fc.id = a.fault_case_id JOIN supplier_sub_orders so ON so.id = fc.sub_order_id
     WHERE a.supplier_id = $1 AND a.payout_id IS NULL ORDER BY a.id`, [supplierId]
  );
  const adjustments = adjustmentRows.map((r) => ({ kind: r.kind, amount: Number(r.amount), orderId: r.order_id }));
  ready.amount = Number((ready.amount + adjustments.reduce((sum, a) => sum + a.amount, 0)).toFixed(2));
  ready.adjustments = adjustments;
  return { readyToPay: ready, inReturnWindow: bucket(false) };
}

// Each recorded payout, with the orders it covered. A payout's amount is computed by the
// server from those orders (never typed), so sales (what the buyers paid for them) minus
// the payout amount is exactly the commission taken -- no estimate involved.
async function getPayoutHistory(supplierId) {
  const { rows } = await db.query(
    `SELECT p.id, p.amount, p.currency_code, p.notes, p.created_at,
            COUNT(DISTINCT pso.sub_order_id) AS order_count,
            COALESCE(SUM(oli.unit_price * oli.quantity), 0) AS sales,
            COALESCE((SELECT SUM(a.gross_amount) FROM payout_adjustments a WHERE a.payout_id = p.id), 0) AS adjustments_gross,
            COALESCE((SELECT SUM(a.amount) FROM payout_adjustments a WHERE a.payout_id = p.id), 0) AS adjustments_net
     FROM payouts p
     LEFT JOIN payout_sub_orders pso ON pso.payout_id = p.id
     LEFT JOIN order_line_items oli ON oli.sub_order_id = pso.sub_order_id
     WHERE p.supplier_id = $1
     GROUP BY p.id
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT 100`,
    [supplierId]
  );
  return rows.map((r) => {
    const amount = Number(r.amount);
    // Released adjustments (migration 097) count as sales at their gross value, so "sales minus the payout" is still exactly the commission.
    const sales = Number((Number(r.sales) + Number(r.adjustments_gross)).toFixed(2));
    return {
      adjustmentsTotal: Number(Number(r.adjustments_net).toFixed(2)),
      id: r.id,
      amount,
      currencyCode: r.currency_code,
      notes: r.notes,
      paidAt: r.created_at,
      orderCount: Number(r.order_count),
      sales,
      commission: Number((sales - amount).toFixed(2)),
    };
  });
}

// Lifetime total across EVERY payout -- deliberately its own query, not a sum of the (capped)
// history list above, so the total stays right for a supplier with more than 100 payouts.
async function getTotalPaid(supplierId) {
  const { rows } = await db.query('SELECT COALESCE(SUM(amount), 0) AS total FROM payouts WHERE supplier_id = $1', [supplierId]);
  return Number(Number(rows[0].total).toFixed(2));
}

// The commission rates that apply to what THIS supplier actually sells: one per category
// they have listings in (rates are set per category by an admin, so there is no single "12%").
async function getCommissionRates(supplierId) {
  const { rows } = await db.query(
    `SELECT DISTINCT pc.id, pc.name_en, pc.name_ar, pc.commission_percent, pc.sort_order
     FROM products p
     JOIN product_categories pc ON pc.id = p.category
     WHERE p.supplier_id = $1
     ORDER BY pc.sort_order, pc.id`,
    [supplierId]
  );
  const categories = rows.map((r) => ({ id: r.id, nameEn: r.name_en, nameAr: r.name_ar, percent: Number(r.commission_percent) }));
  const percents = categories.map((c) => c.percent);
  return {
    minPercent: percents.length ? Math.min(...percents) : null,
    maxPercent: percents.length ? Math.max(...percents) : null,
    categories,
  };
}

async function getSupplierFinance(supplierId) {
  const [returnWindowDays, unpaid, payouts, totalPaid, commission] = await Promise.all([
    getReturnWindowDays(),
    getUnpaidDelivered(supplierId),
    getPayoutHistory(supplierId),
    getTotalPaid(supplierId),
    getCommissionRates(supplierId),
  ]);
  return {
    currencyCode: 'USD',
    returnWindowDays,
    readyToPay: unpaid.readyToPay,
    inReturnWindow: unpaid.inReturnWindow,
    totalPaid,
    lastPayout: payouts.length > 0 ? { amount: payouts[0].amount, paidAt: payouts[0].paidAt } : null,
    commission,
    payouts,
  };
}

module.exports = { getSupplierFinance };
