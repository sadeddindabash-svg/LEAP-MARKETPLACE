const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { refundPart } = require('../payment/refunds');
const noAnswer = require('../orderResponse/noAnswer');
const { createNotification } = require('../notifications/helpers');

/**
 * Cancelling an order or one supplier's part of it, by the BUYER or by the ADMIN (migration 145), and giving the money back.
 * A supplier's refusal and an order nobody answered keep their own flow (Orders > Refused, ../orderResponse); this file is the other two.
 *   - the part is cancelled, its stock goes back to the product, who / when / why are kept on the part, and it is written to sub_order_events
 *   - when every part of the order is cancelled, the order is cancelled too
 *   - then the refund, by the same rule as a refused part (Orders > Rules > step 5): 'auto' gives the part's share back through the provider the
 *     buyer paid with (../payment/refunds.js); a failed refund, or 'manual', waits for the admin in Orders > Cancelled ("Mark refunded" / "Try again")
 *   - the buyer, the supplier and (for a failure) the admins are told. A free replacement order (migration 095) has nothing to refund.
 */

const REASONS = {
  buyer_request: 'The buyer asked to cancel',
  out_of_stock: 'The part is out of stock',
  price_error: 'The price was wrong',
  suspicious: 'Suspicious order',
  cannot_deliver: 'We cannot deliver to this address',
  duplicate: 'Duplicate order',
  other: 'Other',
};

const words = {
  buyerSelf: (orderId, items) => ({ title: 'Your cancellation is confirmed', body: `Order ${orderId}: ${items} was cancelled as you asked.`, titleAr: 'تم تأكيد الإلغاء', bodyAr: `الطلب ${orderId}: تم إلغاء ${items} بناءً على طلبك.` }),
  buyerByLeap: (orderId, items, why) => ({ title: 'Leap cancelled a part of your order', body: `Order ${orderId}: ${items} was cancelled by Leap${why ? ` (${why})` : ''}.`, titleAr: 'ألغت ليب قطعة من طلبك', bodyAr: `الطلب ${orderId}: ألغت ليب ${items}${why ? ` (${why})` : ''}.` }),
  buyerRefunded: (orderId, amount) => ({ title: 'Your refund has been sent', body: `Order ${orderId}: $${amount} is on its way back to you, through the way you paid. Banks can take a few days to show it.`, titleAr: 'تم إرسال المبلغ المسترد', bodyAr: `الطلب ${orderId}: تمت إعادة ${amount}$ إليك بنفس طريقة الدفع. قد يستغرق ظهوره بضعة أيام لدى البنك.` }),
  buyerNotCharged: (orderId) => ({ title: 'Nothing was charged', body: `Order ${orderId}: no payment had been taken for the cancelled part, so there is nothing to give back.`, titleAr: 'لم يتم خصم أي مبلغ', bodyAr: `الطلب ${orderId}: لم يُخصم أي مبلغ عن القطعة الملغاة، لذلك لا يوجد ما يُعاد.` }),
  buyerRefundComing: (orderId, amount) => ({ title: 'Your refund is being prepared', body: `Order ${orderId}: we are refunding $${amount}; we will tell you when it has been sent.`, titleAr: 'جارٍ تجهيز المبلغ المسترد', bodyAr: `الطلب ${orderId}: سنعيد إليك ${amount}$، وسنبلغك عند إرساله.` }),
  supplierByBuyer: (orderId) => ({ title: 'An order was cancelled', body: `Order ${orderId} was cancelled by the buyer before it shipped. Please do not send it.`, titleAr: 'تم إلغاء طلب', bodyAr: `ألغى المشتري الطلب ${orderId} قبل شحنه. يرجى عدم إرساله.` }),
  supplierByLeap: (orderId) => ({ title: 'Leap cancelled an order', body: `Order ${orderId} was cancelled by Leap. Please do not send it; if it is already on its way to the hub, the hub will return it.`, titleAr: 'ألغت ليب طلبًا', bodyAr: `ألغت ليب الطلب ${orderId}. يرجى عدم إرساله؛ وإذا كان في طريقه إلى مركز الفحص فسيعيده المركز.` }),
  adminManual: (orderId, amount, by) => ({ title: `Refund needed for order ${orderId}`, body: `Order ${orderId} was cancelled by the ${by}: refund $${amount} by hand, then press "Mark refunded" in Orders > Cancelled.` }),      // patch-returns-flow: an object, as the bell needs
  adminFailed: (orderId, amount, error) => ({ title: `Refund failed for order ${orderId}`, body: `Order ${orderId}: the automatic refund of $${amount} failed (${error}). See Orders > Cancelled.` }),
};

const r2 = (n) => Number(Number(n).toFixed(2));

// Cancels these parts of the order, inside the caller's transaction (the caller locked the order row and checked each part may be cancelled).
async function cancelParts(client, { orderId, subOrderIds, by, reason = null, adminId = null }) {
  const { rows: [order] } = await client.query('SELECT id, buyer_id, replacement_of FROM orders WHERE id = $1', [orderId]);
  const parts = [];
  for (const id of subOrderIds) {
    const { rows: [so] } = await client.query('SELECT * FROM supplier_sub_orders WHERE id = $1 AND order_id = $2 FOR UPDATE', [id, orderId]);
    if (!so || so.status === 'cancelled') continue;
    const { rows: lines } = await client.query('SELECT oli.product_id, oli.quantity, oli.unit_price, p.name FROM order_line_items oli JOIN products p ON p.id = oli.product_id WHERE oli.sub_order_id = $1', [id]);
    const amount = order.replacement_of ? 0 : r2(lines.reduce((s, l) => s + Number(l.unit_price) * l.quantity, 0));
    for (const l of lines) await client.query('UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2', [l.quantity, l.product_id]);
    await client.query(
      `UPDATE supplier_sub_orders SET status = 'cancelled', cancelled_at = now(), cancelled_by = $2, cancel_reason = $3, cancelled_by_admin = $4,
         refund_needed_amount = $5, refund_status = $6 WHERE id = $1`,
      [id, by, reason, adminId, amount > 0 ? amount : null, amount > 0 ? 'pending' : null]
    );
    await noAnswer.recordEvent(client, { subOrderId: id, orderId, kind: 'cancelled', detail: `cancelled by the ${by}${reason ? `: ${reason}` : ''}${amount > 0 ? ` (refund $${amount.toFixed(2)})` : ''}`, byAdmin: adminId });
    parts.push({ order, subOrderId: id, supplierId: so.supplier_id, amount, items: lines.map((l) => l.name).join(', ') || 'the part' });
  }
  const { rows: siblings } = await client.query('SELECT status FROM supplier_sub_orders WHERE order_id = $1', [orderId]);
  const orderCancelled = siblings.length > 0 && siblings.every((s) => s.status === 'cancelled');
  if (orderCancelled) await client.query("UPDATE orders SET status = 'cancelled' WHERE id = $1", [orderId]);
  return { parts, orderCancelled };
}

async function notify(userId, msg, orderId) {
  try { if (userId) await createNotification({ userId, type: 'order_status', ...msg, linkType: 'order', linkId: orderId }); }
  catch (err) { console.error('[cancel] notification failed (non-fatal):', err.message); }
}
async function notifySupplier(supplierId, msg, orderId) {
  try {
    const { rows } = await db.query("SELECT id FROM users WHERE supplier_id = $1 AND role = 'supplier'", [supplierId]);
    for (const u of rows) await notify(u.id, msg, orderId);
  } catch (err) { console.error('[cancel] supplier notification failed (non-fatal):', err.message); }
}

// After the commit: tell the buyer and the supplier, then the refund. Never throws.
async function afterCancel({ parts }, { by, reasonText = null }) {
  for (const p of parts) {
    try {
      await notify(p.order.buyer_id, by === 'buyer' ? words.buyerSelf(p.order.id, p.items) : words.buyerByLeap(p.order.id, p.items, reasonText), p.order.id);
      await notifySupplier(p.supplierId, by === 'buyer' ? words.supplierByBuyer(p.order.id) : words.supplierByLeap(p.order.id), p.order.id);
      await refundCancelledPart(p, { by });
    } catch (err) { console.error('[cancel] after-cancel step failed (non-fatal):', err.message); }
  }
}

async function refundCancelledPart(p, { by = 'admin' } = {}) {
  if (!(p.amount > 0)) return { refunded: false, nothingToRefund: true };
  const amount = p.amount.toFixed(2);
  const { refundMode } = await noAnswer.getRules();
  if (refundMode !== 'auto') {
    await notify(p.order.buyer_id, words.buyerRefundComing(p.order.id, amount), p.order.id);
    await noAnswer.tellAdmins('failure', words.adminManual(p.order.id, amount, by), p.order.id);
    return { refunded: false };
  }
  const r = await refundPart({ orderId: p.order.id, amountUsd: p.amount });
  if (r.ok) {
    await db.query(
      `UPDATE supplier_sub_orders SET refund_status = 'auto_done', refund_issued_at = now(), refund_reference = $2, refund_provider = $3, refund_error = NULL WHERE id = $1`,
      [p.subOrderId, r.reference, r.provider]
    );
    await noAnswer.recordEvent(db, { subOrderId: p.subOrderId, orderId: p.order.id, kind: 'refunded', detail: `refunded automatically: ${r.note} (${r.reference})` });
    await notify(p.order.buyer_id, r.reference === 'no-payment-taken' ? words.buyerNotCharged(p.order.id) : words.buyerRefunded(p.order.id, amount), p.order.id);
    return { refunded: true };
  }
  await db.query("UPDATE supplier_sub_orders SET refund_status = 'failed', refund_error = $2, refund_provider = $3 WHERE id = $1", [p.subOrderId, String(r.error).slice(0, 300), r.provider || null]);
  await noAnswer.recordEvent(db, { subOrderId: p.subOrderId, orderId: p.order.id, kind: 'refund_failed', detail: r.error });
  await notify(p.order.buyer_id, words.buyerRefundComing(p.order.id, amount), p.order.id);
  await noAnswer.tellAdmins('failure', words.adminFailed(p.order.id, amount, r.error), p.order.id);
  return { refunded: false, error: r.error };
}

// ---------------- the admin's list: Orders > Cancelled, mounted at /order-cancellations
const adminRouter = express.Router();
const admin = [requireAuth, requireRole('admin'), requirePageAccess('orders')];

const REFUSAL_WORDS = { out_of_stock: 'Out of stock', price_changed: 'The price changed', discontinued: 'No longer made', cannot_ship_in_time: 'Cannot ship in time', other: 'Other' };

// GET /   every cancelled part (a part that was only moved to another supplier is not a cancellation), newest first
adminRouter.get('/', ...admin, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT so.id, so.order_id, so.cancelled_at, so.cancelled_by, so.cancel_reason, so.refused_at, so.refusal_reason, so.refusal_note, so.no_answer_closed_at,
              so.refund_needed_amount, so.refund_status, so.refund_error, so.refund_reference, so.refund_issued_at,
              s.name AS supplier_name, o.guest_email, u.email AS buyer_email, o.replacement_of,
              (SELECT string_agg(p.name || ' × ' || oli.quantity, ', ') FROM order_line_items oli JOIN products p ON p.id = oli.product_id WHERE oli.sub_order_id = so.id) AS items,
              (SELECT COALESCE(SUM(oli.unit_price * oli.quantity), 0) FROM order_line_items oli WHERE oli.sub_order_id = so.id) AS part_value
       FROM supplier_sub_orders so
       JOIN orders o ON o.id = so.order_id
       JOIN suppliers s ON s.id = so.supplier_id
       LEFT JOIN users u ON u.id = o.buyer_id
       WHERE so.status = 'cancelled' AND so.reassigned_to_sub_order_id IS NULL
       ORDER BY COALESCE(so.cancelled_at, so.refused_at, so.no_answer_closed_at, o.placed_at) DESC
       LIMIT 500`
    );
    res.json(rows.map((r) => {
      const by = r.cancelled_by || (r.refused_at ? 'supplier' : r.no_answer_closed_at ? 'no_answer' : 'buyer');
      const reason = r.cancelled_by
        ? (r.cancel_reason || (r.cancelled_by === 'buyer' ? 'Cancelled from the buyer\'s account' : null))
        : r.refused_at ? [REFUSAL_WORDS[r.refusal_reason] || r.refusal_reason, r.refusal_note].filter(Boolean).join(': ')
        : r.no_answer_closed_at ? 'No supplier could take it in time' : 'Cancelled from the buyer\'s account (before cancellations were recorded)';
      const refund = r.replacement_of ? 'none' : r.refund_needed_amount == null ? (r.cancelled_by ? 'none' : 'unknown') : (r.refund_status || 'pending');
      return {
        subOrderId: r.id, orderId: r.order_id, supplierName: r.supplier_name, buyer: r.buyer_email || r.guest_email || null, items: r.items || '',
        cancelledBy: by, cancelledAt: r.cancelled_at || r.refused_at || r.no_answer_closed_at || null, reason,
        partValue: Number(r.part_value), refundAmount: r.refund_needed_amount == null ? null : Number(r.refund_needed_amount),
        refundStatus: refund, refundError: r.refund_error || null, refundReference: r.refund_reference || null, refundedAt: r.refund_issued_at || null,
        canMarkRefunded: r.refund_needed_amount != null && !r.refund_issued_at,
        canRetry: r.refund_needed_amount != null && !r.refund_issued_at && ['failed', 'pending'].includes(r.refund_status),
      };
    }));
  } catch (err) { next(err); }
});

// POST /:subOrderId/refunded { reference }   the admin refunded the buyer by hand (the payment provider's reference)
adminRouter.post('/:subOrderId/refunded', ...admin, async (req, res, next) => {
  try {
    const result = await noAnswer.inTransaction((client) => noAnswer.markRefunded(client, { subOrderId: req.params.subOrderId, reference: req.body?.reference, byAdmin: req.user.sub }));
    noAnswer.announceRefunded(result);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof noAnswer.NoAnswerError) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /:subOrderId/retry   try the automatic refund again (after a failure, or after setting up the payment provider)
adminRouter.post('/:subOrderId/retry', ...admin, async (req, res, next) => {
  try {
    const { rows: [so] } = await db.query(
      `SELECT so.*, o.buyer_id, o.replacement_of FROM supplier_sub_orders so JOIN orders o ON o.id = so.order_id
       WHERE so.id = $1 AND so.status = 'cancelled' AND so.refund_needed_amount IS NOT NULL AND so.refund_issued_at IS NULL`, [req.params.subOrderId]);
    if (!so) return res.status(409).json({ error: 'There is no refund waiting for this part.' });
    const r = await refundPart({ orderId: so.order_id, amountUsd: Number(so.refund_needed_amount) });
    if (r.ok) {
      await db.query(`UPDATE supplier_sub_orders SET refund_status = 'auto_done', refund_issued_at = now(), refund_reference = $2, refund_provider = $3, refund_error = NULL WHERE id = $1`, [so.id, r.reference, r.provider]);
      await noAnswer.recordEvent(db, { subOrderId: so.id, orderId: so.order_id, kind: 'refunded', detail: `refunded on the admin's retry: ${r.note} (${r.reference})`, byAdmin: req.user.sub });
      await notify(so.buyer_id, r.reference === 'no-payment-taken' ? words.buyerNotCharged(so.order_id) : words.buyerRefunded(so.order_id, Number(so.refund_needed_amount).toFixed(2)), so.order_id);
      return res.json({ ok: true, reference: r.reference });
    }
    await db.query("UPDATE supplier_sub_orders SET refund_status = 'failed', refund_error = $2, refund_provider = $3 WHERE id = $1", [so.id, String(r.error).slice(0, 300), r.provider || null]);
    res.status(502).json({ error: r.error });
  } catch (err) { next(err); }
});

module.exports = { REASONS, cancelParts, afterCancel, refundCancelledPart, adminRouter };
