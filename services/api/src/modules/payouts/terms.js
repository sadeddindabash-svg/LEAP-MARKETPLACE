/**
 * Supplier PAYMENT TERMS (migration 122): when an order becomes money Leap owes a supplier, per supplier.
 *
 * One shared SQL "ledger" with one row per supplier sub-order, used by admin Payouts (owed list, details, recording a payout), the supplier
 * portal's Finance page and its Overview, so they can never disagree:
 *
 *   state   owed      due by the supplier's term, not paid yet
 *           not_due   still in progress (with due_at when it is already known, e.g. "10 days after shipping")
 *           on_hold   an open return or a fault case Leap pays for, or a line without a supplier price: waits
 *           lost      cancelled / refused / returned / a fault the supplier bears, BEFORE it was paid: never owed
 *           paid      paid in a payout
 *           recover   paid, then lost: taken off the next payout (then recorded in supplier_recoveries)
 *           recovered taken off a payout already
 *
 * A return that admin REJECTED does not stop a payment (it used to block it for good).
 */
const PAYMENT_TERMS = ['before_shipping', 'hub_arrival', 'after_delivery', 'after_return_window', 'days_after_shipping'];
const DEFAULT_TERM = 'after_return_window';

function readTerm(body) {
  const term = body && body.paymentTerm;
  if (!PAYMENT_TERMS.includes(term)) return { error: `paymentTerm must be one of: ${PAYMENT_TERMS.join(', ')}` };
  if (term !== 'days_after_shipping') return { term, days: null };
  const days = Number(body.paymentTermDays);
  if (!Number.isInteger(days) || days < 1 || days > 30) return { error: 'paymentTermDays must be a whole number from 1 to 30.' };
  return { term, days };
}

const TERM_TEXT = {
  before_shipping: () => 'Pay before shipping',
  hub_arrival: () => 'Pay when it arrives at the inspection hub',
  after_delivery: () => 'Pay after delivery',
  after_return_window: () => 'Pay after the return window',
  days_after_shipping: (d) => `Pay ${d} day${d === 1 ? '' : 's'} after shipping`,
};
const termText = (term, days) => (TERM_TEXT[term] || TERM_TEXT[DEFAULT_TERM])(days);

// `where` filters supplier_sub_orders (alias so), e.g. 'so.supplier_id = $1'. Produces the CTE "ledger".
function ledgerCte(where = 'TRUE') {
  return `
  WITH window_setting AS (
    SELECT COALESCE((SELECT value FROM platform_settings WHERE key = 'return_window_days'), '7')::int AS days
  ),
  part AS (
    SELECT so.id AS sub_order_id, so.supplier_id, so.order_id, so.status AS part_status, so.accepted_at, so.refused_at,
           s.payment_term, s.payment_term_days,
           hs.id AS shipment_id, hs.status AS hub_status, hs.created_at AS shipped_at, hs.delivered_at,
           (SELECT MIN(e.created_at) FROM hub_shipment_events e WHERE e.shipment_id = hs.id AND e.step = 'received') AS hub_received_at,
           COALESCE((SELECT SUM(COALESCE(oli.supplier_unit_price_cny, 0) * oli.quantity) FROM order_line_items oli WHERE oli.sub_order_id = so.id), 0) AS net_amount,
           EXISTS (SELECT 1 FROM order_line_items nl WHERE nl.sub_order_id = so.id AND nl.supplier_unit_price_cny IS NULL) AS unpriced,
           (SELECT pso.payout_id FROM payout_sub_orders pso WHERE pso.sub_order_id = so.id LIMIT 1) AS payout_id,
           (SELECT r.payout_id FROM supplier_recoveries r WHERE r.sub_order_id = so.id) AS recovered_in_payout_id,
           EXISTS (SELECT 1 FROM return_cases rc WHERE rc.sub_order_id = so.id AND rc.status IN ('approved', 'completed')) AS returned,
           EXISTS (SELECT 1 FROM return_cases rc WHERE rc.sub_order_id = so.id AND rc.status IN ('awaiting', 'in_progress')) AS return_open,
           EXISTS (SELECT 1 FROM fault_cases fc WHERE fc.sub_order_id = so.id AND fc.cost_bearer = 'supplier') AS supplier_fault,
           EXISTS (SELECT 1 FROM fault_cases fc WHERE fc.sub_order_id = so.id AND fc.cost_bearer <> 'supplier') AS leap_fault
    FROM supplier_sub_orders so
    JOIN suppliers s ON s.id = so.supplier_id
    LEFT JOIN hub_shipments hs ON hs.sub_order_id = so.id
    WHERE ${where}
  ),
  timed AS (
    SELECT part.*,
           CASE
             WHEN part_status = 'cancelled' THEN 'cancelled'
             WHEN refused_at IS NOT NULL THEN 'refused by the supplier'
             WHEN returned THEN 'returned by the buyer'
             WHEN supplier_fault THEN 'a fault the supplier bears'
           END AS lost_reason,
           CASE payment_term
             WHEN 'before_shipping' THEN CASE WHEN accepted_at IS NOT NULL OR part_status IN ('preparing', 'shipped', 'delivered') OR shipment_id IS NOT NULL
                                              THEN COALESCE(accepted_at, shipped_at) END
             WHEN 'hub_arrival' THEN hub_received_at
             WHEN 'after_delivery' THEN CASE WHEN hub_status = 'delivered' THEN delivered_at END
             WHEN 'days_after_shipping' THEN shipped_at + (payment_term_days || ' days')::interval
             ELSE CASE WHEN hub_status = 'delivered' THEN delivered_at + (w.days || ' days')::interval END
           END AS due_at
    FROM part CROSS JOIN window_setting w
  ),
  ledger AS (
    SELECT timed.*,
           CASE
             WHEN payout_id IS NOT NULL AND recovered_in_payout_id IS NOT NULL THEN 'recovered'
             WHEN payout_id IS NOT NULL AND lost_reason IS NOT NULL THEN 'recover'
             WHEN payout_id IS NOT NULL THEN 'paid'
             WHEN lost_reason IS NOT NULL THEN 'lost'
             WHEN unpriced OR return_open OR leap_fault THEN 'on_hold'
             WHEN due_at IS NOT NULL AND due_at <= now() THEN 'owed'
             ELSE 'not_due'
           END AS state
    FROM timed
  )`;
}

// Shown next to an order: why it is owed / not yet / on hold.
function explain(row) {
  const day = (t) => (t ? new Date(t).toISOString().slice(0, 10) : null);
  switch (row.state) {
    case 'recover': return `${row.lost_reason} after it was paid (payout #${row.payout_id})`;
    case 'recovered': return `${row.lost_reason} after it was paid: taken off payout #${row.recovered_in_payout_id}`;
    case 'on_hold': return row.return_open ? 'a return is open' : row.leap_fault ? 'a fault case Leap pays for (paid separately)' : 'a line has no supplier price';
    case 'lost': return row.lost_reason;
    case 'paid': return `paid (payout #${row.payout_id})`;
    default: {
      const due = day(row.due_at);
      const by = {
        before_shipping: 'accepted', hub_arrival: 'arrived at the hub', after_delivery: 'delivered',
        after_return_window: 'return window ended', days_after_shipping: `shipped ${day(row.shipped_at)} + ${row.payment_term_days} days`,
      }[row.payment_term];
      if (row.state === 'owed') return `${by}${due ? ` (${due})` : ''}`;
      return due ? `due ${due}: ${by}` : {
        before_shipping: 'due when the supplier accepts', hub_arrival: 'due when the hub receives it', after_delivery: 'due when it is delivered',
        after_return_window: 'due when the return window ends after delivery', days_after_shipping: 'due after the supplier ships',
      }[row.payment_term];
    }
  }
}

const money = (n) => Number(Number(n || 0).toFixed(2));

// Totals for one supplier (or every supplier when supplierId is null): owed, to recover, not due, on hold; plus unpaid fault payments.
async function supplierTotals(db, supplierId = null) {
  const where = supplierId ? 'so.supplier_id = $1' : 'TRUE';
  const params = supplierId ? [supplierId] : [];
  const { rows } = await db.query(
    `${ledgerCte(where)}
     SELECT supplier_id, state, COUNT(*) AS n, COALESCE(SUM(net_amount), 0) AS amount, MIN(due_at) FILTER (WHERE due_at > now()) AS next_due
     FROM ledger WHERE state IN ('owed', 'recover', 'not_due', 'on_hold') GROUP BY supplier_id, state`, params
  );
  const { rows: adj } = await db.query(
    `SELECT supplier_id, COUNT(*) AS n, COALESCE(SUM(amount), 0) AS amount FROM payout_adjustments
     WHERE payout_id IS NULL AND currency_code = 'CNY' ${supplierId ? 'AND supplier_id = $1' : ''} GROUP BY supplier_id`, params
  );
  const out = {};
  const get = (id) => (out[id] ||= { supplierId: id, owed: { amount: 0, count: 0 }, toRecover: { amount: 0, count: 0 }, notDue: { amount: 0, count: 0, nextDueAt: null }, onHold: { amount: 0, count: 0 }, adjustments: { amount: 0, count: 0 } });
  const key = { owed: 'owed', recover: 'toRecover', not_due: 'notDue', on_hold: 'onHold' };
  for (const r of rows) {
    const t = get(r.supplier_id)[key[r.state]];
    t.amount = money(r.amount); t.count = Number(r.n);
    if (r.state === 'not_due') t.nextDueAt = r.next_due || null;
  }
  for (const a of adj) Object.assign(get(a.supplier_id).adjustments, { amount: money(a.amount), count: Number(a.n) });
  for (const t of Object.values(out)) t.payNow = money(t.owed.amount + t.adjustments.amount - t.toRecover.amount);
  return supplierId ? (out[supplierId] || get(supplierId)) : out;
}

// The orders behind the figures, for admin's details and the supplier's Finance table.
async function supplierOrders(db, supplierId, states = ['owed', 'recover', 'not_due', 'on_hold']) {
  const { rows } = await db.query(
    `${ledgerCte('so.supplier_id = $1')}
     SELECT * FROM ledger WHERE state = ANY($2::text[]) ORDER BY CASE state WHEN 'recover' THEN 0 WHEN 'owed' THEN 1 WHEN 'on_hold' THEN 2 ELSE 3 END, due_at NULLS LAST, sub_order_id
     LIMIT 300`, [supplierId, states]
  );
  return rows.map((r) => ({
    subOrderId: r.sub_order_id, orderId: r.order_id, state: r.state, amount: money(r.net_amount),
    dueAt: r.due_at || null, reason: explain(r), payoutId: r.payout_id || null,
  }));
}

module.exports = { PAYMENT_TERMS, DEFAULT_TERM, readTerm, termText, ledgerCte, supplierTotals, supplierOrders, explain };
