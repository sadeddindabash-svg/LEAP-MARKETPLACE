const db = require('../../../db/pool');
const { createNotification } = require('../notifications/helpers');
const { describeControls } = require('../supplier/orderRules');
const { supplierUnitPriceCny } = require('../shared/supplierMoney');

/**
 * A supplier answers a NEW order (a sub-order that is still "pending"): ACCEPT (the same steps as before: preparing, then ship to the hub) or REFUSE with a reason.
 *   - 24 hours to answer (respond_by, set when the order is placed). A reminder every 4 hours (at 4, 8, 12, 16 and 20 hours); after 24 hours with no answer the ADMIN is told. It is never cancelled silently.
 *   - A refusal cancels ONLY that supplier's part (the parent order is cancelled only when every part is), keeps the reason, tells the buyer (with the way to alternatives) and the admin.
 *   - After accepting, the order can no longer be refused here (late cancellations go through the admin).
 * Payment is not captured yet (see order/routes.js): "the buyer is refunded" means the part is cancelled and the buyer is told they will not be charged for it.
 */
const REFUSAL_REASONS = ['out_of_stock', 'price_changed', 'discontinued', 'cannot_ship_in_time', 'other'];
const ANSWER_WINDOW_HOURS = 24;
const REMINDER_EVERY_HOURS = 4;
const MAX_REMINDERS = ANSWER_WINDOW_HOURS / REMINDER_EVERY_HOURS - 1;       // 5: at 4, 8, 12, 16 and 20 hours; at 24 hours it goes to the admin
const HOUR = 3600 * 1000;

const REASON_TEXT = {
  out_of_stock: { en: 'Out of stock', ar: 'نفد من المخزون' },
  price_changed: { en: "Price changed: can't sell at this price", ar: 'تغيّر السعر: لا يمكن البيع بهذا السعر' },
  discontinued: { en: 'Part discontinued', ar: 'القطعة متوقفة' },
  cannot_ship_in_time: { en: "Can't ship in time", ar: 'لا يمكن الشحن في الوقت المناسب' },
  other: { en: 'Other', ar: 'سبب آخر' },
};

class ResponseError extends Error {
  constructor(message, status = 400, code = null) { super(message); this.status = status; this.code = code; }
}

// What the reminder job should do with a waiting order (pure: easy to test). Catch-up after the server was down sends ONE reminder, not one per missed slot.
function nextStep({ status, respondBy, remindersSent = 0, escalatedAt = null, now = new Date() }) {
  if (status !== 'pending' || escalatedAt || !respondBy) return { action: 'none' };
  const deadline = new Date(respondBy).getTime();
  const nowMs = new Date(now).getTime();
  if (nowMs >= deadline) return { action: 'escalate' };
  const started = deadline - ANSWER_WINDOW_HOURS * HOUR;
  const due = Math.min(MAX_REMINDERS, Math.floor((nowMs - started) / (REMINDER_EVERY_HOURS * HOUR)));
  if (due > remindersSent) return { action: 'remind', remindersDue: due, hoursLeft: Math.max(0, Math.ceil((deadline - nowMs) / HOUR)) };
  return { action: 'none' };
}

// ---- the words (English and Arabic, like the rest of the notifications)
const names = (items) => items.map((i) => i.name).join(', ');
const messages = {
  partUnavailable: (orderId, items) => ({
    title: 'A part in your order is unavailable',
    body: `The supplier could not supply ${names(items)} from order ${orderId}. You will not be charged for it. Open the part to see alternatives from other suppliers.`,
    titleAr: 'قطعة في طلبك غير متوفرة',
    bodyAr: `تعذّر على المورّد توفير ${names(items)} من الطلب ${orderId}. لن يتم تحصيل ثمنها منك. افتح القطعة لعرض البدائل من موردين آخرين.`,
  }),
  partReassigned: (orderId) => ({
    title: 'We found another supplier for your part',
    body: `Order ${orderId}: the part that was unavailable will now be supplied by another supplier at the same price.`,
    titleAr: 'وجدنا مورّدًا آخر لقطعتك',
    bodyAr: `الطلب ${orderId}: ستتولى جهة توريد أخرى القطعة التي لم تكن متوفرة وبنفس السعر.`,
  }),
  adminRefused: (orderId, supplierName, reason) => ({ title: `Supplier refused order ${orderId}`, body: `${supplierName} refused it: ${REASON_TEXT[reason].en}. Open Refused orders to reassign it or contact the buyer.`, titleAr: `رفض المورّد الطلب ${orderId}`, bodyAr: `${supplierName}: ${REASON_TEXT[reason].ar}.` }),
  adminNoAnswer: (orderId, supplierName) => ({ title: `No answer from ${supplierName} for order ${orderId}`, body: `The supplier has not accepted or refused order ${orderId} within 24 hours. It has NOT been cancelled. Please contact the supplier or reassign it.`, titleAr: `لا رد من ${supplierName} على الطلب ${orderId}`, bodyAr: `لم يقبل المورّد الطلب ${orderId} ولم يرفضه خلال 24 ساعة. لم يتم إلغاؤه.` }),
  supplierReminder: (orderId, hoursLeft) => ({ title: `Please answer order ${orderId}`, body: `Accept or refuse order ${orderId}. About ${hoursLeft} hour${hoursLeft === 1 ? '' : 's'} left before it is passed to Leap.`, titleAr: `يرجى الرد على الطلب ${orderId}`, bodyAr: `اقبل الطلب ${orderId} أو ارفضه. تبقّى نحو ${hoursLeft} ساعة قبل إحالته إلى ليب.` }),
  supplierEscalated: (orderId) => ({ title: `Order ${orderId} was passed to Leap`, body: `You did not answer order ${orderId} within 24 hours, so Leap has been told. Please accept or refuse it now.`, titleAr: `تمت إحالة الطلب ${orderId} إلى ليب`, bodyAr: `لم ترد على الطلب ${orderId} خلال 24 ساعة، لذلك تم إبلاغ ليب. يرجى قبوله أو رفضه الآن.` }),
  supplierNewAssignment: (orderId) => ({ title: `A new order for you: ${orderId}`, body: `Leap assigned order ${orderId} to you. Please accept or refuse it within 24 hours.`, titleAr: `طلب جديد لك: ${orderId}`, bodyAr: `أسند ليب الطلب ${orderId} إليك. يرجى قبوله أو رفضه خلال 24 ساعة.` }),
};

async function notifySupplierUsers(supplierId, msg, orderId, client = db) {
  const { rows } = await client.query("SELECT id FROM users WHERE supplier_id = $1 AND role = 'supplier'", [supplierId]);
  for (const u of rows) await createNotification({ userId: u.id, type: 'supplier_message', ...msg, linkType: 'order', linkId: orderId }, client);
}
async function notifyAdmins(msg, orderId, client = db) {
  const { rows } = await client.query("SELECT id FROM users WHERE role = 'admin'");
  for (const u of rows) await createNotification({ userId: u.id, type: 'supplier_message', ...msg, linkType: 'order', linkId: orderId }, client);
}

// ---- the supplier's answer
async function lockSubOrder(client, subOrderId, supplierId) {
  const { rows } = await client.query('SELECT * FROM supplier_sub_orders WHERE id = $1 AND supplier_id = $2 FOR UPDATE', [subOrderId, supplierId]);
  if (rows.length === 0) throw new ResponseError('Sub-order not found', 404);
  const hub = await client.query('SELECT status FROM hub_shipments WHERE sub_order_id = $1 FOR UPDATE', [subOrderId]);
  return { so: rows[0], controls: describeControls({ status: rows[0].status, hubShipmentStatus: hub.rows[0]?.status || null }) };
}
const cannotAnswer = (so, controls, verb) => {
  if (so.status === 'cancelled') return new ResponseError('This order is already cancelled.', 409, 'order_cancelled');
  if (controls.lockReason === 'at_hub') return new ResponseError('This parcel has reached the inspection hub, so it can no longer be changed here.', 409, 'order_locked_at_hub');
  return new ResponseError(verb === 'refuse' ? 'You already accepted this order, so it can no longer be refused here. Contact Leap if there is a problem.' : 'You already accepted this order.', 409, 'already_accepted');
};

async function acceptSubOrder(client, { subOrderId, supplierId }) {
  const { so, controls } = await lockSubOrder(client, subOrderId, supplierId);
  if (!controls.canAccept) throw cannotAnswer(so, controls, 'accept');
  const { rows } = await client.query("UPDATE supplier_sub_orders SET status = 'preparing', accepted_at = now() WHERE id = $1 RETURNING *", [subOrderId]);
  return rows[0];
}

async function refuseSubOrder(client, { subOrderId, supplierId, reason, note }) {
  if (!REFUSAL_REASONS.includes(reason)) throw new ResponseError(`reason must be one of: ${REFUSAL_REASONS.join(', ')}`);
  const cleanNote = typeof note === 'string' ? note.trim().slice(0, 300) : '';
  if (reason === 'other' && cleanNote.length < 3) throw new ResponseError('Please write a short note explaining the reason.');
  const { so, controls } = await lockSubOrder(client, subOrderId, supplierId);
  if (!controls.canRefuse) throw cannotAnswer(so, controls, 'refuse');
  const { rows: items } = await client.query('SELECT oli.product_id, oli.quantity, p.name FROM order_line_items oli JOIN products p ON p.id = oli.product_id WHERE oli.sub_order_id = $1', [subOrderId]);
  const { rows: updated } = await client.query("UPDATE supplier_sub_orders SET status = 'cancelled', refused_at = now(), refusal_reason = $2, refusal_note = $3 WHERE id = $1 RETURNING *", [subOrderId, reason, cleanNote || null]);
  const { rows: siblings } = await client.query('SELECT status FROM supplier_sub_orders WHERE order_id = $1', [so.order_id]);
  const orderCancelled = siblings.every((s) => s.status === 'cancelled');
  if (orderCancelled) await client.query("UPDATE orders SET status = 'cancelled' WHERE id = $1", [so.order_id]);
  // What the reason does to the part: out of stock = none left; discontinued = no longer sold; any other reason = the units that were set aside for this order go back on the shelf.
  for (const it of items) {
    if (reason === 'out_of_stock') await client.query('UPDATE products SET stock_quantity = 0 WHERE id = $1 AND supplier_id = $2', [it.product_id, supplierId]);
    else if (reason === 'discontinued') await client.query("UPDATE products SET status = 'inactive' WHERE id = $1 AND supplier_id = $2", [it.product_id, supplierId]);
    else await client.query('UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2 AND supplier_id = $3', [it.quantity, it.product_id, supplierId]);
  }
  const { rows: orderRows } = await client.query('SELECT id, buyer_id, guest_email FROM orders WHERE id = $1', [so.order_id]);
  return { subOrder: updated[0], order: orderRows[0], items, orderCancelled, reason };
}

// After the answer is saved (never part of it: a notification problem must not undo a refusal).
async function announceRefusal({ subOrder, order, items, reason }) {
  try {
    if (order.buyer_id) await createNotification({ userId: order.buyer_id, type: 'order_status', ...messages.partUnavailable(order.id, items), linkType: 'product', linkId: items[0]?.product_id || order.id });
    const { rows } = await db.query('SELECT name FROM suppliers WHERE id = $1', [subOrder.supplier_id]);
    await notifyAdmins(messages.adminRefused(order.id, rows[0]?.name || subOrder.supplier_id, reason), order.id);
  } catch (err) { console.error('[order-response] refusal notifications failed (non-fatal):', err.message); }
}

// ---- the admin's side
async function listForAdmin({ filter = 'open' } = {}) {
  const where = {
    open: "((so.status = 'cancelled' AND so.refused_at IS NOT NULL) OR (so.status = 'pending' AND so.escalated_at IS NOT NULL)) AND so.refusal_handled_at IS NULL",
    handled: 'so.refusal_handled_at IS NOT NULL',
    all: "(so.refused_at IS NOT NULL OR so.escalated_at IS NOT NULL)",
  }[filter] || null;
  if (!where) throw new ResponseError("filter must be 'open', 'handled' or 'all'");
  const { rows } = await db.query(
    `SELECT so.*, s.name AS supplier_name, o.buyer_id, o.guest_email, o.status AS order_status, o.placed_at, u.email AS buyer_email
     FROM supplier_sub_orders so JOIN suppliers s ON s.id = so.supplier_id JOIN orders o ON o.id = so.order_id LEFT JOIN users u ON u.id = o.buyer_id
     WHERE ${where} ORDER BY COALESCE(so.refused_at, so.escalated_at) DESC`
  );
  const out = [];
  for (const r of rows) {
    const { rows: items } = await db.query('SELECT oli.product_id, oli.quantity, oli.unit_price, oli.supplier_unit_price_cny, p.name, p.oem_number FROM order_line_items oli JOIN products p ON p.id = oli.product_id WHERE oli.sub_order_id = $1', [r.id]);
    out.push({
      subOrderId: r.id, orderId: r.order_id, kind: r.refused_at ? 'refused' : 'no_answer', status: r.status, orderStatus: r.order_status, placedAt: r.placed_at,
      supplierId: r.supplier_id, supplierName: r.supplier_name, buyerId: r.buyer_id, buyerContact: r.buyer_email || r.guest_email || null,
      reason: r.refusal_reason, reasonText: r.refusal_reason ? REASON_TEXT[r.refusal_reason].en : null, note: r.refusal_note, refusedAt: r.refused_at, respondBy: r.respond_by, escalatedAt: r.escalated_at,
      handledAt: r.refusal_handled_at, handledBy: r.refusal_handled_by, handledNote: r.refusal_handled_note, reassignedToSubOrderId: r.reassigned_to_sub_order_id,
      items: items.map((i) => ({ productId: i.product_id, name: i.name, oemNumber: i.oem_number, quantity: i.quantity, buyerUnitPriceUsd: Number(i.unit_price), supplierUnitPriceCny: i.supplier_unit_price_cny == null ? null : Number(i.supplier_unit_price_cny) })),
    });
  }
  return out;
}

// Other suppliers' live parts with the SAME OEM number and enough stock, for each item of a refused order.
async function alternativesFor(subOrderId) {
  const { rows: so } = await db.query('SELECT supplier_id FROM supplier_sub_orders WHERE id = $1', [subOrderId]);
  if (so.length === 0) throw new ResponseError('Sub-order not found', 404);
  const { rows: items } = await db.query('SELECT oli.product_id, oli.quantity, p.name, p.oem_number FROM order_line_items oli JOIN products p ON p.id = oli.product_id WHERE oli.sub_order_id = $1', [subOrderId]);
  const result = [];
  for (const it of items) {
    let alternatives = [];
    if (it.oem_number && String(it.oem_number).trim() !== '') {
      const { rows } = await db.query(
        `SELECT p.id, p.name, p.supplier_id, s.name AS supplier_name, p.stock_quantity, p.price, p.currency_code
         FROM products p JOIN suppliers s ON s.id = p.supplier_id
         WHERE p.oem_number = $1 AND p.id <> $2 AND p.supplier_id <> $3 AND p.status = 'active' AND p.stock_quantity >= $4 ORDER BY p.price ASC LIMIT 10`,
        [it.oem_number, it.product_id, so[0].supplier_id, it.quantity]
      );
      alternatives = rows.map((r) => ({ productId: r.id, name: r.name, supplierId: r.supplier_id, supplierName: r.supplier_name, stockQuantity: r.stock_quantity, supplierPriceCny: supplierUnitPriceCny({ currency_code: r.currency_code, price: r.price }) }));
    }
    result.push({ productId: it.product_id, name: it.name, oemNumber: it.oem_number, quantity: it.quantity, alternatives });
  }
  return result;
}

async function markHandled(subOrderId, adminId, note) {
  const { rows } = await db.query(
    `UPDATE supplier_sub_orders SET refusal_handled_at = now(), refusal_handled_by = $2, refusal_handled_note = $3
     WHERE id = $1 AND refusal_handled_at IS NULL AND (refused_at IS NOT NULL OR escalated_at IS NOT NULL) RETURNING id`,
    [subOrderId, adminId, typeof note === 'string' ? note.trim().slice(0, 300) || null : null]
  );
  if (rows.length === 0) {
    const { rows: exists } = await db.query('SELECT refusal_handled_at FROM supplier_sub_orders WHERE id = $1', [subOrderId]);
    if (exists.length === 0) throw new ResponseError('Sub-order not found', 404);
    throw new ResponseError(exists[0].refusal_handled_at ? 'Already marked as handled.' : 'This order was neither refused nor left unanswered.', 409);
  }
}

// Gives a REFUSED part to another supplier. The buyer keeps the price they agreed; the new supplier is asked (24 hours) like for any new order.
async function reassignRefused(client, { subOrderId, adminId, mapping }) {
  const { rows } = await client.query('SELECT * FROM supplier_sub_orders WHERE id = $1 FOR UPDATE', [subOrderId]);
  if (rows.length === 0) throw new ResponseError('Sub-order not found', 404);
  const old = rows[0];
  if (old.status !== 'cancelled' || !old.refused_at) throw new ResponseError('Only a refused order can be reassigned.', 409);
  if (old.refusal_handled_at) throw new ResponseError('This refused order was already handled' + (old.reassigned_to_sub_order_id ? ' (it was reassigned).' : '.'), 409);
  const { rows: lines } = await client.query('SELECT * FROM order_line_items WHERE sub_order_id = $1 ORDER BY id', [subOrderId]);
  if (!Array.isArray(mapping) || mapping.length !== lines.length) throw new ResponseError('Choose an alternative for every item of the order.');
  const picks = [];
  let newSupplier = null;
  for (const line of lines) {
    const m = mapping.find((x) => x && x.productId === line.product_id);
    if (!m || !m.alternativeProductId) throw new ResponseError('Choose an alternative for every item of the order.');
    const { rows: orig } = await client.query('SELECT oem_number FROM products WHERE id = $1', [line.product_id]);
    const { rows: alt } = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [m.alternativeProductId]);
    if (alt.length === 0 || alt[0].status !== 'active') throw new ResponseError('That alternative is not available.');
    if (alt[0].supplier_id === old.supplier_id) throw new ResponseError('The alternative must come from a different supplier.');
    if (!orig[0].oem_number || alt[0].oem_number !== orig[0].oem_number) throw new ResponseError('The alternative must have the same OEM number.');
    if (alt[0].stock_quantity < line.quantity) throw new ResponseError(`Not enough stock of ${alt[0].name}.`, 409);
    if (newSupplier && newSupplier !== alt[0].supplier_id) throw new ResponseError('Choose alternatives from ONE supplier (one new order).');
    newSupplier = alt[0].supplier_id;
    picks.push({ line, alt: alt[0] });
  }
  const { rows: created } = await client.query("INSERT INTO supplier_sub_orders (order_id, supplier_id, status, hub_id) VALUES ($1, $2, 'pending', $3) RETURNING id", [old.order_id, newSupplier, old.hub_id]);
  for (const { line, alt } of picks) {
    await client.query('INSERT INTO order_line_items (sub_order_id, product_id, quantity, unit_price, supplier_unit_price_cny) VALUES ($1, $2, $3, $4, $5)', [created[0].id, alt.id, line.quantity, line.unit_price, supplierUnitPriceCny(alt)]);
    await client.query('UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2', [line.quantity, alt.id]);
  }
  await client.query("UPDATE supplier_sub_orders SET reassigned_to_sub_order_id = $2, refusal_handled_at = now(), refusal_handled_by = $3 WHERE id = $1", [subOrderId, created[0].id, adminId]);
  await client.query("UPDATE orders SET status = 'to_ship' WHERE id = $1 AND status = 'cancelled'", [old.order_id]);
  const { rows: orderRows } = await client.query('SELECT id, buyer_id FROM orders WHERE id = $1', [old.order_id]);
  return { newSubOrderId: created[0].id, newSupplierId: newSupplier, order: orderRows[0] };
}
async function announceReassignment({ order, newSupplierId }) {
  try {
    if (order.buyer_id) await createNotification({ userId: order.buyer_id, type: 'order_status', ...messages.partReassigned(order.id), linkType: 'order', linkId: order.id });
    await notifySupplierUsers(newSupplierId, messages.supplierNewAssignment(order.id), order.id);
  } catch (err) { console.error('[order-response] reassignment notifications failed (non-fatal):', err.message); }
}

module.exports = { REFUSAL_REASONS, ANSWER_WINDOW_HOURS, REMINDER_EVERY_HOURS, MAX_REMINDERS, REASON_TEXT, ResponseError, nextStep, messages, notifySupplierUsers, notifyAdmins, acceptSubOrder, refuseSubOrder, announceRefusal, listForAdmin, alternativesFor, markHandled, reassignRefused, announceReassignment };
