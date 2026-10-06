const db = require('../../../db/pool');
const { createNotification } = require('../notifications/helpers');

/**
 * Fault cases (migration 091): what happens after an admin confirms that a flagged hub shipment is REALLY
 * faulty. Every function here takes a transaction `client` and does only database work; anything that must
 * reach a person (buyer notice, supplier notice) is returned as `notifications` and sent by the caller
 * AFTER the commit, so a notification problem can never undo or block the decision itself.
 *
 *   awaiting_supplier --(supplier answers)--> awaiting_admin
 *   awaiting_supplier / awaiting_admin --(admin confirms refund)--> refund_pending
 *   refund_pending --(admin marks refunded)--+
 *   (hub returns / discards the unit) -------+--> completed   (needs BOTH)
 *
 * A refund is only RECORDED: the admin refunds manually in Stripe/PayPal and marks it issued with the
 * provider's reference. No refund API is integrated, and nothing is deducted from a supplier's payout.
 */

class FaultCaseError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Buyer-facing text is stored as ONE string (a return-case message / a notification body), so it carries
// both languages: English first, then Arabic, on separate lines. A stopgap until messages are keyed.
const bi = (en, ar) => `${en}\n${ar}`;
const money = (n) => Number(n).toFixed(2);

const BUYER_TEXT = {
  faultConfirmed: (itemCount) => bi(
    `Our inspection confirmed a problem with ${itemCount === 1 ? 'an item' : 'some items'} in this shipment. We are arranging a replacement or a refund and will update you shortly.`,
    `أكد الفحص وجود مشكلة في ${itemCount === 1 ? 'أحد المنتجات' : 'بعض المنتجات'} ضمن هذه الشحنة. نعمل على ترتيب استبدال أو استرداد المبلغ وسنوافيك بالمستجدات قريبًا.`
  ),
  refundConfirmed: (amount) => bi(
    `We are refunding $${money(amount)}. It is being processed and we will confirm once it has been issued.`,
    `سيتم استرداد مبلغ ${money(amount)}$. جارٍ معالجته وسنؤكد لك عند إصداره.`
  ),
  refundIssued: (amount, reference) => bi(
    `Your refund of $${money(amount)} has been issued (reference: ${reference}). It may take a few days to appear with your payment provider.`,
    `تم إصدار استرداد مبلغ ${money(amount)}$ (المرجع: ${reference}). قد يستغرق ظهوره لدى مزوّد الدفع بضعة أيام.`
  ),
  closed: () => bi('This case is now closed. Thank you for your patience.', 'تم إغلاق هذه الحالة. شكرًا لصبرك.'),
};

// Return-case states an automated update may move between. A case an admin has already finalised by hand
// (rejected / completed) is left exactly as they set it: no status change, no message, no second notice.
const AUTO_UPDATABLE = ['awaiting', 'in_progress', 'approved'];

// A Postgres DATE reaches Node as a Date at LOCAL midnight, so reading it back with the local getters
// returns exactly the calendar day that was stored (toISOString() would shift it a day in some timezones).
function dateOnly(v) {
  if (!v) return null;
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  return String(v).slice(0, 10);
}

async function findReturnCase(client, subOrderId) {
  const { rows } = await client.query('SELECT * FROM return_cases WHERE sub_order_id = $1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE', [subOrderId]);
  return rows[0] || null;
}

// Moves the linked return case to `status`, posts `message` to the buyer's thread, and queues the buyer's
// notification. Returns { id, status, updated } (or null when there is no case).
async function advanceReturnCase(client, rc, status, message, notifications) {
  if (!rc) return null;
  if (!AUTO_UPDATABLE.includes(rc.status)) return { id: rc.id, status: rc.status, updated: false };
  await client.query('UPDATE return_cases SET status = $1, updated_at = now() WHERE id = $2', [status, rc.id]);
  await client.query(`INSERT INTO return_case_buyer_messages (case_id, sender_role, message) VALUES ($1, 'admin', $2)`, [rc.id, message]);
  if (rc.buyer_id) { // a guest buyer has no account to notify
    notifications.push({
      userId: rc.buyer_id, type: 'return_status', title: 'Your return request was updated\nتم تحديث طلب الإرجاع الخاص بك',
      body: message, linkType: 'order', linkId: rc.order_id,
    });
  }
  return { id: rc.id, status, updated: true };
}

async function sendNotifications(notifications) {
  for (const n of notifications) {
    try {
      await createNotification(n);
    } catch (err) {
      console.error('[fault-case] notification failed (non-fatal):', err.message);
    }
  }
}

async function loadItems(client, faultCaseId) {
  const { rows } = await client.query(
    `SELECT i.product_id, i.quantity, i.unit_price, p.name
     FROM fault_case_items i LEFT JOIN products p ON p.id = i.product_id
     WHERE i.fault_case_id = $1 ORDER BY i.product_id`,
    [faultCaseId]
  );
  return rows.map((r) => ({ productId: r.product_id, name: r.name, quantity: r.quantity, unitPrice: Number(r.unit_price) }));
}

// What the buyer actually PAID for the faulty items -- the right default for a refund.
//
// Item prices (order_line_items.unit_price) are the prices BEFORE any order-level discount (a promo code or the loyalty
// discount), so the faulty items' list value can be MORE than the buyer paid -- with every item faulty it is the whole
// subtotal, which is more than the order total whenever a discount applied. Refunding list value would over-refund and
// the server (rightly) refuses anything above the order total.
//
// The buyer paid `orders.total` for ALL the order's items, so the faulty items' share of what was really paid is
//     faultyValue x (orders.total / value of every item in the order)
// With no discount the ratio is 1 and this is exactly the faulty items' value; with a discount it is that value minus
// their proportional share of the discount. The admin can still lower it, never above the order total.
async function computeRefundSuggestion(client, row, items) {
  const { rows } = await client.query(
    `SELECT o.total,
            (SELECT COALESCE(SUM(oli.unit_price * oli.quantity), 0)
             FROM order_line_items oli JOIN supplier_sub_orders s2 ON s2.id = oli.sub_order_id
             WHERE s2.order_id = o.id) AS all_items_value
     FROM supplier_sub_orders so JOIN orders o ON o.id = so.order_id
     WHERE so.id = $1`,
    [row.sub_order_id]
  );
  const orderTotal = Number(rows[0].total);
  const allItemsValue = Number(rows[0].all_items_value);
  const orderedValue = Number(items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0).toFixed(2));
  const paid = allItemsValue > 0 ? (orderedValue * orderTotal) / allItemsValue : orderedValue;
  const suggested = Number(Math.min(paid, orderTotal).toFixed(2));
  return { orderedValue, discountShare: Number((orderedValue - suggested).toFixed(2)), suggested, orderTotal };
}

// The full picture, for the admin.
async function toAdminDto(client, row) {
  const items = await loadItems(client, row.id);
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    status: row.status,
    costBearer: row.cost_bearer,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    items,
    // What the buyer really paid for these items (see computeRefundSuggestion): the refund's default amount.
    refundSuggestion: await computeRefundSuggestion(client, row, items),
    supplier: {
      answered: row.supplier_answered_at !== null,
      canReplace: row.supplier_can_replace,
      eta: dateOnly(row.supplier_eta),
      note: row.supplier_note,
      answeredAt: row.supplier_answered_at,
    },
    outcome: row.outcome,
    refund: row.refund_status
      ? { amount: Number(row.refund_amount), status: row.refund_status, reference: row.refund_reference, refundedAt: row.refunded_at }
      : null,
    hubReturn: row.hub_return,
    hubReturnedAt: row.hub_returned_at,
    completedAt: row.completed_at,
  };
}

// What hub staff need: which items to send back, and whether they still have to. Deliberately NO money
// (refund amount) and NO cost bearer: those are the platform's business.
async function toHubDto(client, row) {
  return {
    id: row.id,
    items: (await loadItems(client, row.id)).map(({ productId, name, quantity }) => ({ productId, name, quantity })),
    hubReturn: row.hub_return,
    needsReturn: row.hub_return === null,
    // Where the PLATFORM is on this case, in words that say nothing about money or who decided what:
    //   reviewing  = still deciding what to do (waiting for the supplier / for a decision)
    //   finalising = decided, finishing it off
    //   closed     = done
    // So hub staff always know whether anything is left for THEM (only the unit: needsReturn), without seeing refund details.
    platformStage: row.status === 'completed' ? 'closed' : row.status === 'refund_pending' ? 'finalising' : 'reviewing',
  };
}

// ---------------------------------------------------------------------------------------------------

async function createFaultCase(client, { shipmentId, items, costBearer, notes, adminId }) {
  if (!['supplier', 'leap'].includes(costBearer)) throw new FaultCaseError("costBearer must be 'supplier' or 'leap'");
  if (!Array.isArray(items) || items.length === 0) throw new FaultCaseError('Choose at least one faulty item.');

  const { rows: shipRows } = await client.query('SELECT * FROM hub_shipments WHERE id = $1 FOR UPDATE', [shipmentId]);
  if (shipRows.length === 0) throw new FaultCaseError('Shipment not found', 404);
  const shipment = shipRows[0];
  if (shipment.status !== 'flagged' || shipment.resolved_at) throw new FaultCaseError('This shipment is not an unresolved flag.');
  const { rows: existing } = await client.query('SELECT 1 FROM fault_cases WHERE shipment_id = $1', [shipment.id]);
  if (existing.length > 0) throw new FaultCaseError('This shipment already has a fault case.');

  const { rows: subRows } = await client.query(
    `SELECT so.id, so.order_id, so.supplier_id, so.status FROM supplier_sub_orders so WHERE so.id = $1`, [shipment.sub_order_id]
  );
  const subOrder = subRows[0];
  if (subOrder.status === 'cancelled') throw new FaultCaseError('This part was already cancelled by the buyer.');

  const { rows: lines } = await client.query('SELECT product_id, quantity, unit_price FROM order_line_items WHERE sub_order_id = $1', [subOrder.id]);
  const chosen = [];
  for (const productId of new Set(items)) {
    const line = lines.find((l) => l.product_id === productId);
    if (!line) throw new FaultCaseError(`"${productId}" is not an item in this shipment.`);
    chosen.push(line); // whole line: the faulty quantity is the quantity ordered
  }

  const { rows: caseRows } = await client.query(
    `INSERT INTO fault_cases (shipment_id, sub_order_id, cost_bearer, admin_notes, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [shipment.id, subOrder.id, costBearer, notes ? String(notes).trim() || null : null, adminId]
  );
  const faultCase = caseRows[0];
  for (const line of chosen) {
    await client.query('INSERT INTO fault_case_items (fault_case_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)', [faultCase.id, line.product_id, line.quantity, line.unit_price]);
  }

  const notifications = [];
  const rc = await findReturnCase(client, subOrder.id);
  const returnCase = await advanceReturnCase(client, rc, 'in_progress', BUYER_TEXT.faultConfirmed(chosen.length), notifications);

  // Ask the supplier whether they can replace. Every user of that supplier account sees it.
  const { rows: supplierUsers } = await client.query(`SELECT id FROM users WHERE supplier_id = $1 AND role = 'supplier'`, [subOrder.supplier_id]);
  for (const u of supplierUsers) {
    notifications.push({
      userId: u.id, type: 'supplier_message',
      title: `Can you replace? Order ${subOrder.order_id}`,
      body: `Leap's inspection found a fault in ${chosen.length} item${chosen.length === 1 ? '' : 's'} of order ${subOrder.order_id}. Please tell us in your Returns page whether you can send a replacement, and when.`,
      linkType: 'order', linkId: subOrder.order_id,
    });
  }
  return { faultCase, returnCase, orderId: subOrder.order_id, notifications };
}

async function recordSupplierAnswer(client, { caseId, supplierId, userId, canReplace, eta, note }) {
  const { rows } = await client.query(
    `SELECT fc.*, so.supplier_id FROM fault_cases fc JOIN supplier_sub_orders so ON so.id = fc.sub_order_id WHERE fc.id = $1 FOR UPDATE OF fc`, [caseId]
  );
  // another supplier's case is indistinguishable from a missing one
  if (rows.length === 0 || rows[0].supplier_id !== supplierId) throw new FaultCaseError('Case not found', 404);
  if (rows[0].status !== 'awaiting_supplier') throw new FaultCaseError('This question has already been answered.');
  if (typeof canReplace !== 'boolean') throw new FaultCaseError('canReplace must be true or false.');

  let etaDate = null;
  if (canReplace) {
    if (typeof eta !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(eta) || Number.isNaN(Date.parse(eta))) {
      throw new FaultCaseError('Give the date you can send the replacement (YYYY-MM-DD).');
    }
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10); // one day of slack for timezones
    if (eta < yesterday) throw new FaultCaseError('The replacement date cannot be in the past.');
    etaDate = eta;
  }
  const cleanNote = typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : null;
  const { rows: updated } = await client.query(
    `UPDATE fault_cases SET supplier_can_replace = $1, supplier_eta = $2, supplier_note = $3, supplier_answered_at = now(),
            supplier_answered_by = $4, status = 'awaiting_admin', updated_at = now() WHERE id = $5 RETURNING *`,
    [canReplace, etaDate, cleanNote, userId, caseId]
  );
  return { faultCase: updated[0] };
}

async function confirmRefund(client, { caseId, amount, adminId }) {
  const { rows } = await client.query('SELECT * FROM fault_cases WHERE id = $1 FOR UPDATE', [caseId]);
  if (rows.length === 0) throw new FaultCaseError('Fault case not found', 404);
  const fc = rows[0];
  if (!['awaiting_supplier', 'awaiting_admin'].includes(fc.status)) throw new FaultCaseError('A refund can only be confirmed before one has been confirmed.');

  const { rows: sub } = await client.query(
    `SELECT so.status, so.order_id, o.total FROM supplier_sub_orders so JOIN orders o ON o.id = so.order_id WHERE so.id = $1`, [fc.sub_order_id]
  );
  if (sub[0].status === 'cancelled') throw new FaultCaseError('This part was already cancelled by the buyer.');
  const items = await loadItems(client, fc.id);
  const suggestion = await computeRefundSuggestion(client, fc, items);
  const refundAmount = amount === undefined || amount === null ? suggestion.suggested : Number(amount);
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) throw new FaultCaseError('The refund amount must be greater than zero.');
  if (refundAmount > Number(sub[0].total)) throw new FaultCaseError(`The refund cannot be more than the order total ($${money(sub[0].total)}).`);
  const finalAmount = Number(refundAmount.toFixed(2));

  const { rows: updated } = await client.query(
    `UPDATE fault_cases SET outcome = 'refund', refund_amount = $1, refund_status = 'pending', refund_confirmed_by = $2,
            status = 'refund_pending', updated_at = now() WHERE id = $3 RETURNING *`,
    [finalAmount, adminId, caseId]
  );
  const notifications = [];
  const returnCase = await advanceReturnCase(client, await findReturnCase(client, fc.sub_order_id), 'approved', BUYER_TEXT.refundConfirmed(finalAmount), notifications);
  return { faultCase: updated[0], returnCase, notifications, suggestedAmount: suggestion.suggested };
}

async function markRefunded(client, { caseId, reference, adminId }) {
  const { rows } = await client.query('SELECT * FROM fault_cases WHERE id = $1 FOR UPDATE', [caseId]);
  if (rows.length === 0) throw new FaultCaseError('Fault case not found', 404);
  if (rows[0].status !== 'refund_pending') throw new FaultCaseError('There is no pending refund to mark as issued.');
  const ref = typeof reference === 'string' ? reference.trim() : '';
  if (ref.length < 3) throw new FaultCaseError('Enter the Stripe/PayPal refund reference (or a note) so the refund can be traced.');

  const { rows: updated } = await client.query(
    `UPDATE fault_cases SET refund_status = 'issued', refund_reference = $1, refunded_at = now(), refunded_by = $2, updated_at = now()
     WHERE id = $3 RETURNING *`,
    [ref.slice(0, 120), adminId, caseId]
  );
  const notifications = [];
  const returnCase = await advanceReturnCase(client, await findReturnCase(client, updated[0].sub_order_id), 'approved', BUYER_TEXT.refundIssued(updated[0].refund_amount, ref.slice(0, 120)), notifications);
  const completed = await maybeComplete(client, updated[0].id, notifications);
  return { faultCase: completed || updated[0], returnCase, notifications };
}

// The hub has physically dealt with the faulty unit. Called inside the hub event transaction.
async function recordHubReturn(client, { shipmentId, method }) {
  const { rows } = await client.query('SELECT * FROM fault_cases WHERE shipment_id = $1 FOR UPDATE', [shipmentId]);
  if (rows.length === 0) throw new FaultCaseError('There is no fault case for this shipment, so there is nothing to send back.');
  if (rows[0].hub_return) throw new FaultCaseError('This unit has already been returned or discarded.');
  await client.query(`UPDATE fault_cases SET hub_return = $1, hub_returned_at = now(), updated_at = now() WHERE id = $2`, [method, rows[0].id]);
  const notifications = [];
  const completed = await maybeComplete(client, rows[0].id, notifications);
  return { notifications, completed };
}

// A case is complete once the refund is issued AND the unit has left the hub. Closes the flag (it leaves the
// admin queue and the hub workload) and the buyer's return case.
async function maybeComplete(client, caseId, notifications) {
  const { rows } = await client.query('SELECT * FROM fault_cases WHERE id = $1 FOR UPDATE', [caseId]);
  const fc = rows[0];
  if (fc.status === 'completed' || fc.refund_status !== 'issued' || !fc.hub_return) return null;
  const { rows: done } = await client.query(`UPDATE fault_cases SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = $1 RETURNING *`, [caseId]);
  await client.query(
    `UPDATE hub_shipments SET resolution = 'fault_refund', resolved_at = now(), resolved_by = $1, updated_at = now() WHERE id = $2`,
    [fc.refunded_by, fc.shipment_id]
  );
  await advanceReturnCase(client, await findReturnCase(client, fc.sub_order_id), 'completed', BUYER_TEXT.closed(), notifications);
  return done[0];
}

module.exports = {
  FaultCaseError, createFaultCase, recordSupplierAnswer, confirmRefund, markRefunded, recordHubReturn,
  toAdminDto, toHubDto, sendNotifications,
};
