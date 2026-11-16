const db = require('../../../db/pool');
const { createNotification } = require('../notifications/helpers');

/**
 * Pricing > Discount rules > ⚙ Rules: "How a discount price is held" (confirmed with the person via mockup, migration 143).
 *   1. In the basket nothing is held: the live price; when a discount ends the buyer is told (and, if set, reminded before).
 *   2. Opening checkout holds every line at its price for hold_minutes, discount included, even if the discount ends meanwhile.
 *   3. The same part added again during the hold: after the discount ended it is a NEW line at the live price (held too, until the
 *      same hold ends); while the discount is still on it joins the held line or is a new line (add_while_on).
 *   4. A price that drops: every line of that part takes the lowest price (a held part's own drop follows on_drop).
 *   5. The hold ends without an order: back to the live price (lines join back); a new hold when checkout is opened again
 *      (max_holds_per_day, -1 = no limit).
 *   6. The order is saved at exactly the checkout prices.
 *   7. The admin is told: every time / once a day / only failures. Each buyer message (EN + AR) has its own Yes / No.
 */

const DEFAULT_RULES = {
  tellDiscountEnd: true, remindBefore: false, remindHours: 3, holdMinutes: 60, tellHoldStart: false, addWhileOn: 'join', tellNewLine: true,
  onDrop: 'lower', tellDrop: true, tellHoldEnd: true, maxHoldsPerDay: -1, tellOrderSaving: true, notifyMode: 'daily', summaryHour: 9, summaryTz: 'Asia/Riyadh',
};

class HoldError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function rulesFromRow(r) {
  if (!r) return { ...DEFAULT_RULES, updatedAt: null };
  return {
    tellDiscountEnd: r.tell_discount_end !== false, remindBefore: r.remind_before === true, remindHours: Number(r.remind_hours ?? 3),
    holdMinutes: Number(r.hold_minutes ?? 60), tellHoldStart: r.tell_hold_start === true, addWhileOn: r.add_while_on || 'join', tellNewLine: r.tell_new_line !== false,
    onDrop: r.on_drop || 'lower', tellDrop: r.tell_drop !== false, tellHoldEnd: r.tell_hold_end !== false, maxHoldsPerDay: Number(r.max_holds_per_day ?? -1),
    tellOrderSaving: r.tell_order_saving !== false, notifyMode: r.notify_mode || 'daily', summaryHour: Number(r.summary_hour ?? 9), summaryTz: r.summary_tz || 'Asia/Riyadh',
    lastSummaryAt: r.last_summary_at || null, updatedAt: r.updated_at || null,
  };
}

// The rules, or the defaults when migration 143 has not run yet (the basket keeps working as before: a 60-minute hold).
async function getRules() {
  try {
    const { rows } = await db.query('SELECT * FROM discount_hold_rules WHERE id = 1');
    return rulesFromRow(rows[0]);
  } catch (err) {
    return { ...DEFAULT_RULES, updatedAt: null };
  }
}

async function saveRules(input, adminId) {
  const r = { ...DEFAULT_RULES, ...(input || {}) };
  const int = (v, lo, hi, name) => { const n = Number(v); if (!Number.isInteger(n) || n < lo || n > hi) throw new HoldError(`${name} must be a whole number from ${lo} to ${hi}`); return n; };
  const bool = (v, name) => { if (typeof v !== 'boolean') throw new HoldError(`${name} must be true or false`); return v; };
  const pick = (v, list, name) => { if (!list.includes(v)) throw new HoldError(`${name} must be one of: ${list.join(', ')}`); return v; };
  const v = {
    tellDiscountEnd: bool(r.tellDiscountEnd, 'tellDiscountEnd'), remindBefore: bool(r.remindBefore, 'remindBefore'), remindHours: int(r.remindHours, 1, 24, 'remindHours'),
    holdMinutes: int(r.holdMinutes, 15, 180, 'holdMinutes'), tellHoldStart: bool(r.tellHoldStart, 'tellHoldStart'), addWhileOn: pick(r.addWhileOn, ['join', 'new'], 'addWhileOn'),
    tellNewLine: bool(r.tellNewLine, 'tellNewLine'), onDrop: pick(r.onDrop, ['lower', 'keep'], 'onDrop'), tellDrop: bool(r.tellDrop, 'tellDrop'), tellHoldEnd: bool(r.tellHoldEnd, 'tellHoldEnd'),
    maxHoldsPerDay: int(r.maxHoldsPerDay, -1, 3, 'maxHoldsPerDay'), tellOrderSaving: bool(r.tellOrderSaving, 'tellOrderSaving'),
    notifyMode: pick(r.notifyMode, ['each', 'daily', 'failures'], 'notifyMode'), summaryHour: int(r.summaryHour, 0, 23, 'summaryHour'),
  };
  let tz = typeof r.summaryTz === 'string' && r.summaryTz ? r.summaryTz : 'Asia/Riyadh';
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch { tz = 'Asia/Riyadh'; }
  const cols = ['tell_discount_end', 'remind_before', 'remind_hours', 'hold_minutes', 'tell_hold_start', 'add_while_on', 'tell_new_line', 'on_drop', 'tell_drop', 'tell_hold_end', 'max_holds_per_day', 'tell_order_saving', 'notify_mode', 'summary_hour', 'summary_tz'];
  const vals = [v.tellDiscountEnd, v.remindBefore, v.remindHours, v.holdMinutes, v.tellHoldStart, v.addWhileOn, v.tellNewLine, v.onDrop, v.tellDrop, v.tellHoldEnd, v.maxHoldsPerDay, v.tellOrderSaving, v.notifyMode, v.summaryHour, tz];
  const { rows } = await db.query(
    `INSERT INTO discount_hold_rules (id, ${cols.join(', ')}, updated_at, updated_by) VALUES (1, ${cols.map((_, i) => `$${i + 1}`).join(', ')}, now(), $${cols.length + 1})
     ON CONFLICT (id) DO UPDATE SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')}, updated_at = now(), updated_by = $${cols.length + 1}
     RETURNING *`,
    [...vals, adminId || null]
  );
  return rulesFromRow(rows[0]);
}

const holdMs = (rules) => Math.max(15, Number(rules.holdMinutes) || 60) * 60 * 1000;
const isLockActive = (lockedAt, rules, now = Date.now()) => lockedAt !== null && lockedAt !== undefined && now - new Date(lockedAt).getTime() < holdMs(rules);
const near = (a, b) => Math.abs(a - b) < 0.005;

/**
 * The price lines of one basket part. Outside a hold: one line at the live price. During a hold: the held units at the held price and
 * the units added during the hold at the price they were added at; a lower live price lowers them (steps 3 and 4); two lines at the
 * same price are shown as one. Returns { lines: [{ quantity, price, held, lowered, isNew, originalPrice }], total, price (average) }.
 */
function priceLines(row, live, lockActive, rules) {
  const quantity = Number(row.quantity);
  const base = live.originalPrice ?? null;
  if (!lockActive || row.locked_price === null || row.locked_price === undefined) {
    const line = { quantity, price: live.price, held: false, lowered: false, isNew: false, originalPrice: base };
    return { lines: [line], total: live.price * quantity, price: live.price };
  }
  const heldQty = Math.max(0, Math.min(quantity, row.held_quantity === null || row.held_quantity === undefined ? quantity : Number(row.held_quantity)));
  const extraQty = quantity - heldQty;
  const lockedPrice = Number(row.locked_price);
  let heldPrice = lockedPrice;
  let lowered = false;
  if (rules.onDrop === 'lower' && live.price < heldPrice - 0.004) { heldPrice = live.price; lowered = true; }
  let extraPrice = row.extra_locked_price === null || row.extra_locked_price === undefined ? live.price : Number(row.extra_locked_price);
  let extraLowered = false;
  if (extraQty > 0) {
    if (live.price < extraPrice - 0.004) { extraPrice = live.price; extraLowered = true; }
    // the same part on two lines: both take the lower price (the person's rule)
    if (heldQty > 0 && extraPrice < heldPrice - 0.004) { heldPrice = extraPrice; lowered = true; }
  }
  // the price before any discount, for the struck-through price: the live one, or the live price itself when the discount is over
  const before = (p) => (base !== null && base > p + 0.004 ? base : live.price > p + 0.004 ? live.price : null);
  const lines = [];
  if (heldQty > 0) lines.push({ quantity: heldQty, price: heldPrice, held: true, lowered, isNew: false, originalPrice: before(heldPrice) });
  if (extraQty > 0) {
    if (heldQty > 0 && near(extraPrice, heldPrice)) lines[0].quantity += extraQty;
    else lines.push({ quantity: extraQty, price: extraPrice, held: true, lowered: extraLowered, isNew: heldQty > 0, originalPrice: before(extraPrice) });
  }
  const total = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  return { lines, total, price: quantity > 0 ? total / quantity : live.price };
}

// ---------------------------------------------------------------- buyer and admin messages (English + Arabic)
const usd = (n) => `$${Number(n).toFixed(2)}`;
const words = {
  discountEnded: (name, price, was) => ({ title: `The discount on ${name} ended`, body: `The price in your basket is now ${usd(price)} (was ${usd(was)}).`, titleAr: `انتهى الخصم على ${name}`, bodyAr: `السعر في سلتك الآن ${usd(price)} (كان ${usd(was)}).` }),
  endsSoon: (name, hours, price) => ({ title: `The discount on ${name} ends soon`, body: `It ends in about ${hours} hour${hours === 1 ? '' : 's'}. Check out now to keep ${usd(price)}.`, titleAr: `الخصم على ${name} ينتهي قريبًا`, bodyAr: `ينتهي خلال ${hours} ساعة تقريبًا. أتمم الشراء الآن لتحتفظ بسعر ${usd(price)}.` }),
  holdStarted: (minutes) => ({ title: 'Your prices are held', body: `The prices in your basket are held for ${minutes} minutes while you check out.`, titleAr: 'أسعارك محجوزة', bodyAr: `أسعار سلتك محجوزة لمدة ${minutes} دقيقة أثناء إتمام الشراء.` }),
  newLine: (name, price, held) => ({ title: `${name} was added at today's price`, body: `The discount has ended, so the new one is ${usd(price)}. The one you already had keeps ${usd(held)} until your hold ends.`, titleAr: `أُضيف ${name} بسعر اليوم`, bodyAr: `انتهى الخصم، لذلك سعر القطعة الجديدة ${usd(price)}. القطعة الموجودة تحتفظ بسعر ${usd(held)} حتى ينتهي الحجز.` }),
  priceDropped: (name, price) => ({ title: `Good news: ${name} is cheaper`, body: `The price dropped to ${usd(price)}; your basket uses the new price.`, titleAr: `خبر سار: ${name} أرخص الآن`, bodyAr: `انخفض السعر إلى ${usd(price)}، وتم تطبيق السعر الجديد في سلتك.` }),
  holdEnded: () => ({ title: 'Your price hold ended', body: 'Some prices in your basket are back to today\'s price. Open checkout to hold them again.', titleAr: 'انتهى حجز الأسعار', bodyAr: 'عادت بعض الأسعار في سلتك إلى سعر اليوم. افتح صفحة الدفع لحجزها من جديد.' }),
  orderSaving: (orderId, saved) => ({ title: `You saved ${usd(saved)} on order ${orderId}`, body: `Your price hold kept the discount price for you.`, titleAr: `وفّرت ${usd(saved)} في الطلب ${orderId}`, bodyAr: 'حافظ حجز الأسعار على سعر الخصم لك.' }),
  adminMismatch: (orderId, detail) => ({ title: `Order ${orderId}: price check`, body: detail }),
  adminSummary: (c) => ({ title: 'Discount holds: today', body: `${c.hold_started} price hold(s) started, ${c.order_saved} order(s) kept a held price, ${c.new_line} part(s) added at a new price, ${c.lowered} price drop(s), ${c.discount_ended} discount end notice(s).` }),
};

async function recordEvent({ cartId = null, productId = null, orderId = null, kind, detail = null }, client = db) {
  try { await client.query('INSERT INTO discount_hold_events (cart_id, product_id, order_id, kind, detail) VALUES ($1, $2, $3, $4, $5)', [cartId, productId, orderId, kind, detail]); }
  catch (err) { console.error('[discount-hold] event not written (non-fatal):', err.message); }
}

// Best-effort: a message that fails never undoes the step. Guests have no account, so only signed-in buyers are told.
async function tellBuyer(buyerId, msg, link = {}) {
  if (!buyerId) return;
  try { await createNotification({ userId: buyerId, type: 'price_drop', ...msg, linkType: link.type || null, linkId: link.id || null }); }
  catch (err) { console.error('[discount-hold] buyer message failed (non-fatal):', err.message); }
}
async function notifyAdmins(msg, orderId = null) {
  try {
    const { rows } = await db.query("SELECT id FROM users WHERE role = 'admin'");
    for (const u of rows) await createNotification({ userId: u.id, type: 'price_drop', ...msg, linkType: orderId ? 'order' : null, linkId: orderId });
  } catch (err) { console.error('[discount-hold] admin message failed (non-fatal):', err.message); }
}
async function tellAdmins(kind, msg, orderId, rules) {
  const r = rules || (await getRules());
  if (kind === 'failure' || r.notifyMode === 'each') await notifyAdmins(msg, orderId);
}

/**
 * Step 6: the prices an order is saved at. `liveUnitPrices` are the prices worked out now (discount included). When the buyer's
 * basket has an active hold, each part is priced from its basket lines (held units first, then the others) with the same rules as
 * the basket shows. Returns { byProduct: { [productId]: { unitPrice, total, live, saved } }, cartId, buyerId }.
 */
async function heldPricesForOrder(client, { cartId, userId, items, liveUnitPrices }) {
  const out = { byProduct: {}, cartId: null, buyerId: userId || null };
  try {
    const rules = await getRules();
    let cart = null;
    if (typeof cartId === 'string' && cartId) {
      const { rows } = await client.query('SELECT id, buyer_id, checkout_locked_at FROM carts WHERE id = $1', [cartId]);
      // someone else's basket never lends its prices
      if (rows[0] && (!rows[0].buyer_id || (userId && String(rows[0].buyer_id) === String(userId)))) cart = rows[0];
    }
    if (!cart && userId) {
      const { rows } = await client.query('SELECT id, buyer_id, checkout_locked_at FROM carts WHERE buyer_id = $1 AND merged_into IS NULL ORDER BY checkout_locked_at DESC NULLS LAST, created_at DESC LIMIT 1', [userId]);
      cart = rows[0] || null;
    }
    if (!cart || !isLockActive(cart.checkout_locked_at, rules)) return out;
    out.cartId = cart.id;
    const { rows } = await client.query('SELECT product_id, quantity, locked_price, held_quantity, extra_locked_price FROM cart_items WHERE cart_id = $1', [cart.id]);
    const byId = new Map(rows.map((r) => [String(r.product_id), r]));
    for (const it of items) {
      const row = byId.get(String(it.productId));
      const live = liveUnitPrices[it.productId];
      if (!row || live === undefined) continue;
      const qty = Number(it.quantity) || 1;
      const heldQty = Math.min(row.held_quantity === null ? Number(row.quantity) : Number(row.held_quantity), qty);
      const p = priceLines({ ...row, quantity: qty, held_quantity: heldQty }, { price: live, originalPrice: null }, true, rules);
      out.byProduct[it.productId] = { unitPrice: p.price, total: p.total, live, saved: Math.max(0, live * qty - p.total) };
    }
  } catch (err) {
    // the hold can never block an order: the live (discounted) price is used
    console.error('[discount-hold] held prices not read, using live prices:', err.message);
    out.byProduct = {};
  }
  return out;
}

// After the order is committed (best-effort): the events, the buyer's "you saved" message, and the hold is closed.
async function afterOrder({ orderId, held }) {
  const rules = await getRules();
  const saved = Object.values(held.byProduct).reduce((s, h) => s + h.saved, 0);
  if (Object.keys(held.byProduct).length) await recordEvent({ cartId: held.cartId, orderId, kind: 'order_saved', detail: saved > 0.004 ? `kept held prices, saved ${usd(saved)}` : 'saved at the held prices' });
  if (saved > 0.004 && rules.tellOrderSaving) await tellBuyer(held.buyerId, words.orderSaving(orderId, saved), { type: 'order', id: orderId });
  if (saved > 0.004) await tellAdmins('step', { title: `Order ${orderId} kept a held price`, body: `The buyer saved ${usd(saved)} thanks to the checkout price hold.` }, orderId, rules);
}

module.exports = { DEFAULT_RULES, HoldError, getRules, saveRules, holdMs, isLockActive, priceLines, words, recordEvent, tellBuyer, notifyAdmins, tellAdmins, heldPricesForOrder, afterOrder, usd };
