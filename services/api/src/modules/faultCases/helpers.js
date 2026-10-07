const db = require('../../../db/pool');
const { createNotification } = require('../notifications/helpers');
const { getReturnAddress } = require('../supplierReturnAddress/helpers');
const messages = require('../notifications/messages');

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
const pair = (en, ar) => ({ en, ar });
// The return-case THREAD shows both languages together, English first, then Arabic. (A notification keeps them in separate fields.)
const both = ({ en, ar }) => `${en}\n${ar}`;
const money = (n) => Number(n).toFixed(2);

const BUYER_TEXT = {
  faultConfirmed: (itemCount) => pair(
    `Our inspection confirmed a problem with ${itemCount === 1 ? 'an item' : 'some items'} in this shipment. We are arranging a replacement or a refund and will update you shortly.`,
    `أكد الفحص وجود مشكلة في ${itemCount === 1 ? 'أحد المنتجات' : 'بعض المنتجات'} ضمن هذه الشحنة. نعمل على ترتيب استبدال أو استرداد المبلغ وسنوافيك بالمستجدات قريبًا.`
  ),
  refundConfirmed: (amount) => pair(
    `We are refunding $${money(amount)}. It is being processed and we will confirm once it has been issued.`,
    `سيتم استرداد مبلغ ${money(amount)}$. جارٍ معالجته وسنؤكد لك عند إصداره.`
  ),
  refundIssued: (amount, reference) => pair(
    `Your refund of $${money(amount)} has been issued (reference: ${reference}). It may take a few days to appear with your payment provider.`,
    `تم إصدار استرداد مبلغ ${money(amount)}$ (المرجع: ${reference}). قد يستغرق ظهوره لدى مزوّد الدفع بضعة أيام.`
  ),
  replacementConfirmed: (orderId) => pair(
    `We are sending you a replacement at no charge. It is order ${orderId}: you can follow it in My Orders, and we will tell you when it ships.`,
    `سنرسل لك بديلًا مجانًا. رقم الطلب ${orderId}، ويمكنك متابعته في طلباتي، وسنخبرك عند شحنه.`
  ),
  closed: () => pair('This case is now closed. Thank you for your patience.', 'تم إغلاق هذه الحالة. شكرًا لصبرك.'),
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

// Moves the linked return case to `status`, posts `message` ({ en, ar }) to the buyer's thread, and queues the buyer's
// notification. Returns { id, status, updated } (or null when there is no case).
async function advanceReturnCase(client, rc, status, message, notifications) {
  if (!rc) return null;
  if (!AUTO_UPDATABLE.includes(rc.status)) return { id: rc.id, status: rc.status, updated: false };
  await client.query('UPDATE return_cases SET status = $1, updated_at = now() WHERE id = $2', [status, rc.id]);
  await client.query(`INSERT INTO return_case_buyer_messages (case_id, sender_role, message) VALUES ($1, 'admin', $2)`, [rc.id, both(message)]);
  if (rc.buyer_id) { // a guest buyer has no account to notify
    notifications.push({ userId: rc.buyer_id, type: 'return_status', ...messages.returnCaseMessage(message), linkType: 'order', linkId: rc.order_id });
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
     FROM supplier_sub_orders so JOIN orders o0 ON o0.id = so.order_id JOIN orders o ON o.id = COALESCE(o0.replacement_of, o0.id)
     WHERE so.id = $1`,
    [row.sub_order_id]
  );
  // `o` is the order the buyer PAID for: a replacement is free, so if the replacement itself turns out faulty, a refund is still
  // measured against the original payment, never against the replacement's total of zero.
  const orderTotal = Number(rows[0].total);
  const allItemsValue = Number(rows[0].all_items_value);
  const orderedValue = Number(items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0).toFixed(2));
  const paid = allItemsValue > 0 ? (orderedValue * orderTotal) / allItemsValue : orderedValue;
  const suggested = Number(Math.min(paid, orderTotal).toFixed(2));
  return { orderedValue, discountShare: Number((orderedValue - suggested).toFixed(2)), suggested, orderTotal };
}

// The hub's evidence for the flag that started this case: what kind of problem, the inspector's note, and the photos. This is what
// tells a supplier WHY a replacement is being asked for. (The admin's own private notes are a different field and never go here.)
async function loadFlagEvidence(client, shipmentId) {
  const { rows } = await client.query(
    `SELECT id, notes, damage_type, created_at FROM hub_shipment_events WHERE shipment_id = $1 AND step = 'flagged' ORDER BY created_at DESC, id DESC LIMIT 1`,
    [shipmentId]
  );
  if (rows.length === 0) return null;
  const { rows: photos } = await client.query('SELECT url FROM hub_shipment_photos WHERE event_id = $1 ORDER BY sort_order', [rows[0].id]);
  return { note: rows[0].notes, damageType: rows[0].damage_type, flaggedAt: rows[0].created_at, photos: photos.map((p) => p.url) };
}

async function supplierIdOf(client, subOrderId) {
  const { rows } = await client.query('SELECT supplier_id FROM supplier_sub_orders WHERE id = $1', [subOrderId]);
  return rows[0].supplier_id;
}

// The tracking number the hub entered when it sent the faulty unit back (null if it was discarded, or not sent yet).
async function returnTrackingOf(client, shipmentId) {
  const { rows } = await client.query(
    `SELECT tracking_number FROM hub_shipment_events WHERE shipment_id = $1 AND step = 'returned_to_supplier' ORDER BY created_at DESC, id DESC LIMIT 1`,
    [shipmentId]
  );
  return rows[0] ? rows[0].tracking_number : null;
}

const round2 = (value) => Number(Number(value).toFixed(2));

// The original order's value, before and after the platform's commission: the same arithmetic the payout rules use.
async function computeOriginalOrder(client, subOrderId) {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(oli.unit_price * oli.quantity), 0) AS gross,
            COALESCE(SUM(oli.unit_price * oli.quantity * (1 - pc.commission_percent / 100.0)), 0) AS net
     FROM order_line_items oli JOIN products p ON p.id = oli.product_id JOIN product_categories pc ON pc.id = p.category
     WHERE oli.sub_order_id = $1`, [subOrderId]
  );
  return { gross: round2(rows[0].gross), net: round2(rows[0].net) };
}

async function supplierPaymentView(client, row) {
  const { rows } = await client.query('SELECT kind, amount, payout_id, created_at FROM payout_adjustments WHERE fault_case_id = $1', [row.id]);
  if (rows.length === 0) {
    return { released: false, originalOrder: (await computeOriginalOrder(client, row.sub_order_id)).net, localShipping: null, releasedAt: null, paidOut: false };
  }
  const amountOf = (kind) => { const found = rows.find((r) => r.kind === kind); return found ? Number(found.amount) : null; };
  return { released: true, originalOrder: amountOf('original_order'), localShipping: amountOf('local_shipping'), releasedAt: rows[0].created_at, paidOut: rows.every((r) => r.payout_id !== null) };
}

// When LEAP bears the cost, an admin releases what Leap owes the supplier for the ORIGINAL order (it cannot be paid by the normal rules: it has a return
// case) plus the supplier's local shipping charges. They join the supplier's next payout. When the SUPPLIER is at fault nothing is released: they are
// paid once, for the unit the buyer finally receives, and bear everything else. The replacement needs nothing here: it is paid on delivery as usual.
async function releaseSupplierPayment(client, { caseId, adminId, localShippingAmount, note }) {
  const { rows } = await client.query('SELECT * FROM fault_cases WHERE id = $1 FOR UPDATE', [caseId]);
  if (rows.length === 0) throw new FaultCaseError('Fault case not found', 404);
  const fc = rows[0];
  if (fc.cost_bearer !== 'leap') throw new FaultCaseError('The supplier is at fault, so they bear the cost and nothing is released. They are paid once, for the unit the buyer finally receives.');
  if (!fc.outcome) throw new FaultCaseError('Confirm the refund or the replacement first: the supplier payment is released after that.');

  let shipping = 0;
  if (localShippingAmount !== undefined && localShippingAmount !== null && localShippingAmount !== '') {
    shipping = Number(localShippingAmount);
    if (!Number.isFinite(shipping) || shipping < 0) throw new FaultCaseError('Local shipping charges must be a number, 0 or more.');
    if (shipping > 100000) throw new FaultCaseError('That local shipping amount is too large. Check it.');
    shipping = round2(shipping);
  }
  const { rows: existing } = await client.query('SELECT 1 FROM payout_adjustments WHERE fault_case_id = $1', [caseId]);
  if (existing.length > 0) throw new FaultCaseError('The supplier payment for this case has already been released.', 409);
  const { rows: subRows } = await client.query('SELECT so.supplier_id, so.order_id FROM supplier_sub_orders so WHERE so.id = $1', [fc.sub_order_id]);
  const { rows: alreadyPaid } = await client.query('SELECT 1 FROM payout_sub_orders WHERE sub_order_id = $1', [fc.sub_order_id]);
  if (alreadyPaid.length > 0) throw new FaultCaseError('This order was already paid out, so there is nothing to release.', 409);
  const original = await computeOriginalOrder(client, fc.sub_order_id);
  if (original.net <= 0) throw new FaultCaseError('This order has no priced items, so there is nothing to release.');

  const noteText = typeof note === 'string' && note.trim() ? note.trim().slice(0, 300) : null;
  await client.query(
    `INSERT INTO payout_adjustments (supplier_id, fault_case_id, kind, amount, gross_amount, note, created_by_admin_id) VALUES ($1, $2, 'original_order', $3, $4, $5, $6)`,
    [subRows[0].supplier_id, caseId, original.net, original.gross, noteText, adminId]
  );
  if (shipping > 0) {
    await client.query(
      `INSERT INTO payout_adjustments (supplier_id, fault_case_id, kind, amount, gross_amount, note, created_by_admin_id) VALUES ($1, $2, 'local_shipping', $3, $3, $4, $5)`,
      [subRows[0].supplier_id, caseId, shipping, noteText, adminId]
    );
  }
  const notifications = [];
  const { rows: supplierUsers } = await client.query(`SELECT id FROM users WHERE supplier_id = $1 AND role = 'supplier'`, [subRows[0].supplier_id]);
  for (const u of supplierUsers) {
    notifications.push({
      userId: u.id, type: 'supplier_message', title: `Payment released for order ${subRows[0].order_id}`,
      body: `The fault on order ${subRows[0].order_id} happened in Leap's care, so Leap is paying you for the original order ($${money(original.net)} after commission)${shipping > 0 ? ` and your local shipping charges ($${money(shipping)})` : ''}. It will be included in your next payout; the replacement is paid when it is delivered.`,
      linkType: 'order', linkId: subRows[0].order_id,
    });
  }
  return { faultCase: fc, originalOrder: original.net, localShipping: shipping, notifications };
}

// Where a replacement order is up to, from the supplier's and the hub's own records.
async function replacementStage(client, orderId) {
  const { rows } = await client.query(
    `SELECT hs.status AS hub_status FROM supplier_sub_orders so LEFT JOIN hub_shipments hs ON hs.sub_order_id = so.id WHERE so.order_id = $1 LIMIT 1`, [orderId]
  );
  const hubStatus = rows[0] ? rows[0].hub_status : null;
  if (hubStatus === 'delivered') return 'delivered';
  if (hubStatus === 'shipped_to_buyer') return 'shipped_to_buyer';
  if (hubStatus) return 'at_hub';
  return 'waiting_for_supplier';
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
    // Set when an admin closed the case by hand (migration 098): who and why.
    closedManually: row.closed_manually_by ? { note: row.closed_manually_note, at: row.completed_at } : null,
    // Only when LEAP bears the cost: what the supplier is owed for the ORIGINAL order, and whether the admin has released it (migration 097).
    supplierPayment: row.cost_bearer === 'leap' ? await supplierPaymentView(client, row) : null,
    // The replacement order (when the outcome is a replacement) and where it is up to: waiting_for_supplier | at_hub | shipped_to_buyer | delivered
    replacement: row.replacement_order_id
      ? { orderId: row.replacement_order_id, createdAt: row.replacement_created_at, deliveredAt: row.replacement_delivered_at, stage: await replacementStage(client, row.replacement_order_id) }
      : null,
    refund: row.refund_status
      ? { amount: Number(row.refund_amount), status: row.refund_status, reference: row.refund_reference, refundedAt: row.refunded_at }
      : null,
    hubReturn: row.hub_return,
    hubReturnedAt: row.hub_returned_at,
    hubReturnTracking: row.hub_return === 'returned' ? await returnTrackingOf(client, row.shipment_id) : null,
    returnAddressOnFile: (await getReturnAddress(await supplierIdOf(client, row.sub_order_id), client)) !== null,
    evidence: await loadFlagEvidence(client, row.shipment_id),
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
    // Where to send the unit (migration 092): the supplier's return address, or null if they haven't entered one.
    returnAddress: await getReturnAddress(await supplierIdOf(client, row.sub_order_id), client),
    // Where the PLATFORM is on this case, in words that say nothing about money or who decided what:
    //   reviewing  = still deciding what to do (waiting for the supplier / for a decision)
    //   finalising = decided, finishing it off
    //   closed     = done
    // So hub staff always know whether anything is left for THEM (only the unit: needsReturn), without seeing refund details.
    platformStage: row.status === 'completed' ? 'closed' : (row.status === 'refund_pending' || row.status === 'replacement_pending') ? 'finalising' : 'reviewing',
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
  // The hub has to send the faulty unit back, so the supplier is also asked for a return address if they have none yet.
  const hasReturnAddress = (await getReturnAddress(subOrder.supplier_id, client)) !== null;
  for (const u of supplierUsers) {
    notifications.push({
      userId: u.id, type: 'supplier_message',
      title: `Can you replace? Order ${subOrder.order_id}`,
      body: `Leap's inspection found a fault in ${chosen.length} item${chosen.length === 1 ? '' : 's'} of order ${subOrder.order_id}. Please tell us in your Returns page whether you can send a replacement, and when.${hasReturnAddress ? '' : ' You have no return address on file: please add one in Settings so the inspection hub knows where to send the faulty unit.'}`,
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
    `SELECT so.status, so.order_id, po.total FROM supplier_sub_orders so JOIN orders o ON o.id = so.order_id JOIN orders po ON po.id = COALESCE(o.replacement_of, o.id) WHERE so.id = $1`, [fc.sub_order_id]
  );
  if (sub[0].status === 'cancelled') throw new FaultCaseError('This part was already cancelled by the buyer.');
  const items = await loadItems(client, fc.id);
  const suggestion = await computeRefundSuggestion(client, fc, items);
  const refundAmount = amount === undefined || amount === null ? suggestion.suggested : Number(amount);
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) throw new FaultCaseError('The refund amount must be greater than zero.');
  if (refundAmount > Number(sub[0].total)) throw new FaultCaseError(`The refund cannot be more than what the buyer paid ($${money(sub[0].total)}).`);
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

// An admin confirms a REPLACEMENT (migration 095). Needs the supplier to have said they CAN replace it. Creates a new order, free to the buyer,
// numbered from the order the buyer paid for ("LP-200934-R1"), with the faulty items at their ORIGINAL prices (see the migration for why),
// the same delivery address (including its English version) and the same inspection hub. It then flows through the normal pipeline: the
// supplier ships it to the hub, the hub receives, inspects and ships it, and delivery completes the case (with the unit's return).
async function confirmReplacement(client, { caseId, adminId }) {
  const { rows } = await client.query('SELECT * FROM fault_cases WHERE id = $1 FOR UPDATE', [caseId]);
  if (rows.length === 0) throw new FaultCaseError('Fault case not found', 404);
  const fc = rows[0];
  if (!['awaiting_supplier', 'awaiting_admin'].includes(fc.status)) throw new FaultCaseError('A replacement can only be confirmed before a refund or another replacement has been confirmed.');
  if (!fc.supplier_answered_at) throw new FaultCaseError('The supplier has not answered yet. A replacement needs the supplier to say they can send one.');
  if (!fc.supplier_can_replace) throw new FaultCaseError('The supplier said they cannot replace this. Refund the buyer instead.');

  const { rows: subRows } = await client.query(
    `SELECT so.*, o.buyer_id, o.guest_email, o.currency_code, COALESCE(o.replacement_of, o.id) AS root_order_id
     FROM supplier_sub_orders so JOIN orders o ON o.id = so.order_id WHERE so.id = $1`, [fc.sub_order_id]
  );
  const original = subRows[0];
  if (original.status === 'cancelled') throw new FaultCaseError('This part was already cancelled by the buyer.');
  if (!original.hub_id) throw new FaultCaseError('This part has no inspection hub, so a replacement cannot be routed.');
  const items = await loadItems(client, fc.id);

  // numbered from the order the buyer PAID for: LP-200934-R1, -R2 ... (a unique index stops two admins taking the same number)
  const { rows: nextNumber } = await client.query('SELECT COALESCE(MAX(replacement_number), 0) + 1 AS n FROM orders WHERE replacement_of = $1', [original.root_order_id]);
  const number = Number(nextNumber[0].n);
  const replacementOrderId = `${original.root_order_id}-R${number}`;

  await client.query(
    `INSERT INTO orders (id, buyer_id, guest_email, status, total, currency_code, discount_amount, wait_for_all_shipments, replacement_of, replacement_number)
     VALUES ($1, $2, $3, 'to_ship', 0, $4, 0, false, $5, $6)`,
    [replacementOrderId, original.buyer_id, original.guest_email, original.currency_code, original.root_order_id, number]
  );
  await client.query(
    `INSERT INTO order_addresses (order_id, recipient_name, phone, country, city, street_address, postal_code, state, national_address, source,
                                  recipient_name_en, country_en, city_en, street_address_en, state_en, english_source, english_updated_at, english_updated_by)
     SELECT $1, recipient_name, phone, country, city, street_address, postal_code, state, national_address, source,
            recipient_name_en, country_en, city_en, street_address_en, state_en, english_source, english_updated_at, english_updated_by
     FROM order_addresses WHERE order_id = $2`,
    [replacementOrderId, original.order_id]
  );
  const { rows: newSub } = await client.query(
    `INSERT INTO supplier_sub_orders (order_id, supplier_id, status, hub_id) VALUES ($1, $2, 'pending', $3) RETURNING id`,
    [replacementOrderId, original.supplier_id, original.hub_id]
  );
  for (const item of items) {
    await client.query('INSERT INTO order_line_items (sub_order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)', [newSub[0].id, item.productId, item.quantity, item.unitPrice]);
  }

  const { rows: updated } = await client.query(
    `UPDATE fault_cases SET outcome = 'replacement', status = 'replacement_pending', replacement_order_id = $1, replacement_confirmed_by = $2,
            replacement_created_at = now(), updated_at = now() WHERE id = $3 RETURNING *`,
    [replacementOrderId, adminId, caseId]
  );

  const notifications = [];
  const returnCase = await advanceReturnCase(client, await findReturnCase(client, fc.sub_order_id), 'approved', BUYER_TEXT.replacementConfirmed(replacementOrderId), notifications);
  const { rows: supplierUsers } = await client.query(`SELECT id FROM users WHERE supplier_id = $1 AND role = 'supplier'`, [original.supplier_id]);
  for (const u of supplierUsers) {
    notifications.push({
      userId: u.id, type: 'supplier_message', title: `Replacement order ${replacementOrderId}`,
      body: `Leap has confirmed a replacement for order ${original.order_id}. Please ship order ${replacementOrderId} to our inspection hub${fc.supplier_eta ? ` by ${dateOnly(fc.supplier_eta)}` : ''}. It is free for the buyer; you are paid for it once, as for the original sale.`,
      linkType: 'order', linkId: replacementOrderId,
    });
  }
  return { faultCase: updated[0], replacementOrderId, returnCase, notifications };
}

// A shipment was just delivered (by the hub, by the carrier's webhook, or by the courier link). If it is a REPLACEMENT for a fault case, record
// it: the case completes once the faulty unit is also back from the hub. Best-effort and in its own transaction, so it can never undo or block
// the delivery itself.
async function onShipmentDelivered(subOrderId) {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT fc.id FROM fault_cases fc JOIN supplier_sub_orders so ON so.order_id = fc.replacement_order_id
       WHERE so.id = $1 AND fc.replacement_delivered_at IS NULL FOR UPDATE OF fc`, [subOrderId]
    );
    if (rows.length === 0) { await client.query('ROLLBACK'); return; }
    await client.query('UPDATE fault_cases SET replacement_delivered_at = now(), updated_at = now() WHERE id = $1', [rows[0].id]);
    const notifications = [];
    await maybeComplete(client, rows[0].id, notifications);
    await client.query('COMMIT');
    await sendNotifications(notifications);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Recording a replacement delivery failed (non-fatal):', err.message);
  } finally {
    client.release();
  }
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
  const settled = (fc.outcome === 'refund' && fc.refund_status === 'issued') || (fc.outcome === 'replacement' && fc.replacement_delivered_at !== null);
  if (fc.status === 'completed' || !settled || !fc.hub_return) return null;
  const { rows: done } = await client.query(`UPDATE fault_cases SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = $1 RETURNING *`, [caseId]);
  await client.query(
    `UPDATE hub_shipments SET resolution = $1, resolved_at = now(), resolved_by = $2, updated_at = now() WHERE id = $3`,
    [fc.outcome === 'replacement' ? 'fault_replacement' : 'fault_refund', fc.outcome === 'replacement' ? fc.replacement_confirmed_by : fc.refunded_by, fc.shipment_id]
  );
  await advanceReturnCase(client, await findReturnCase(client, fc.sub_order_id), 'completed', BUYER_TEXT.closed(), notifications);
  return done[0];
}

// An admin closes a case BY HAND, with a written reason (migration 098): for a case that is stuck (the hub never confirms the unit's return, a
// replacement was cancelled by agreement, a case was opened twice). It is not a way round money: a refund the buyer is expecting has to be
// recorded as refunded first. The flag leaves the hub queue, and the buyer's return case closes with the usual "this case is closed" message.
async function closeCaseManually(client, { caseId, adminId, note }) {
  const { rows } = await client.query('SELECT * FROM fault_cases WHERE id = $1 FOR UPDATE', [caseId]);
  if (rows.length === 0) throw new FaultCaseError('Fault case not found', 404);
  const fc = rows[0];
  const reason = typeof note === 'string' ? note.trim() : '';
  if (reason.length < 5) throw new FaultCaseError('Write the reason for closing this case (at least a few words): it is kept on the record.');
  if (reason.length > 500) throw new FaultCaseError('The reason is too long (500 characters at most).');
  if (fc.status === 'completed') throw new FaultCaseError('This case is already closed.');
  if (fc.outcome === 'refund' && fc.refund_status !== 'issued') {
    throw new FaultCaseError('The buyer is expecting a refund that has not been recorded as issued yet. Record it as refunded first, then the case can be closed.');
  }
  const { rows: done } = await client.query(
    `UPDATE fault_cases SET status = 'completed', completed_at = now(), updated_at = now(), closed_manually_by = $1, closed_manually_note = $2 WHERE id = $3 RETURNING *`,
    [adminId, reason, caseId]
  );
  await client.query(
    `UPDATE hub_shipments SET resolution = 'fault_closed_manually', resolved_at = now(), resolved_by = $1, updated_at = now() WHERE id = $2 AND resolved_at IS NULL`,
    [adminId, fc.shipment_id]
  );
  const notifications = [];
  const returnCase = await advanceReturnCase(client, await findReturnCase(client, fc.sub_order_id), 'completed', BUYER_TEXT.closed(), notifications);
  return { faultCase: done[0], returnCase, notifications };
}

module.exports = {
  closeCaseManually, FaultCaseError, createFaultCase, recordSupplierAnswer, confirmRefund, markRefunded, confirmReplacement, releaseSupplierPayment, onShipmentDelivered, recordHubReturn,
  toAdminDto, toHubDto, sendNotifications,
};
