const db = require('../../../db/pool');
const { calculateBuyerPriceUsd } = require('../pricing/engine');
const { withEffectiveShipping } = require('../shared/partShipping');
const { findActiveDiscount } = require('../pricing/discountRules');
const { CAR_JOIN, CAR_COLUMNS, buyerName } = require('../shared/carName');
const hold = require('./rules');

/**
 * The scheduled check of Pricing > Discount rules > Rules (every 15 minutes, safe to run twice: each message is claimed with an
 * atomic UPDATE first). Only signed-in buyers can be told (a guest basket has no account).
 *   step 1: a basket part whose discount ended -> "The discount on … ended" (not while a checkout hold covers it); and, when set,
 *           "… ends soon" a few hours before the end.
 *   step 5: a hold that ended without an order and a price went back up -> "Your price hold ended".
 *   step 7: the admin's daily summary.
 */
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

// The buyer price now without any discount (the same sums as the basket).
async function basePriceUsd(p) {
  if (p.currency_code !== 'CNY') return Number(p.price);
  const shipped = await withEffectiveShipping(p);
  const r = await calculateBuyerPriceUsd({
    supplierCostCny: Number(p.price),
    weightKg: shipped.weight_kg === null ? null : Number(shipped.weight_kg),
    lengthCm: shipped.length_cm === null ? null : Number(shipped.length_cm),
    widthCm: shipped.width_cm === null ? null : Number(shipped.width_cm),
    heightCm: shipped.height_cm === null ? null : Number(shipped.height_cm),
  });
  return r.buyerPriceUsd;
}

async function checkBasketDiscounts(rules, now = new Date()) {
  const done = { ended: 0, reminded: 0 };
  const { rows } = await db.query(
    `SELECT ci.cart_id, ci.product_id, ci.discount_seen_pct, ci.reminded_for_end, ci.locked_price, c.buyer_id, c.checkout_locked_at, c.hold_end_told_at,
            p.id, p.name, p.name_ar, p.price, p.currency_code, p.category, p.part, p.weight_kg, p.length_cm, p.width_cm, p.height_cm, ${CAR_COLUMNS}
     FROM cart_items ci JOIN carts c ON c.id = ci.cart_id JOIN products p ON p.id = ci.product_id ${CAR_JOIN}
     WHERE c.buyer_id IS NOT NULL AND c.merged_into IS NULL AND c.updated_at > now() - interval '60 days'`
  );
  for (const r of rows) {
    try {
      const active = await findActiveDiscount(r.product_id);
      const covered = r.locked_price !== null && hold.isLockActive(r.checkout_locked_at, rules, now.getTime());
      const name = buyerName(r, 'en');
      // a hold that just ended will send "Your price hold ended" (step 5): no second message for the same price
      const holdEndComing = rules.tellHoldEnd && r.locked_price !== null && !covered && r.checkout_locked_at && !r.hold_end_told_at && now.getTime() - new Date(r.checkout_locked_at).getTime() < 2 * 86400000;
      if (active) {
        if (r.discount_seen_pct === null || Number(r.discount_seen_pct) !== active.percentage) {
          await db.query('UPDATE cart_items SET discount_seen_pct = $3 WHERE cart_id = $1 AND product_id = $2', [r.cart_id, r.product_id, active.percentage]);
        }
        if (rules.remindBefore && active.endsAt && !covered) {
          const msLeft = active.endsAt.getTime() - now.getTime();
          if (msLeft > 0 && msLeft <= rules.remindHours * 3600 * 1000) {
            const { rowCount } = await db.query('UPDATE cart_items SET reminded_for_end = $3 WHERE cart_id = $1 AND product_id = $2 AND (reminded_for_end IS NULL OR abs(extract(epoch FROM reminded_for_end - $3::timestamptz)) > 1) RETURNING cart_id', [r.cart_id, r.product_id, active.endsAt]);
            if (rowCount) {
              const price = (await basePriceUsd(r)) * (1 - active.percentage / 100);
              await hold.tellBuyer(r.buyer_id, hold.words.endsSoon(name, Math.max(1, Math.round(msLeft / 3600000)), price), { type: 'product', id: r.product_id });
              await hold.recordEvent({ cartId: r.cart_id, productId: r.product_id, kind: 'reminded', detail: `discount ends ${active.endsAt.toISOString()}` });
              done.reminded++;
            }
          }
        }
      } else if (r.discount_seen_pct !== null) {
        const { rowCount } = await db.query('UPDATE cart_items SET discount_seen_pct = NULL WHERE cart_id = $1 AND product_id = $2 AND discount_seen_pct IS NOT NULL RETURNING cart_id', [r.cart_id, r.product_id]);
        if (!rowCount) continue;
        await hold.recordEvent({ cartId: r.cart_id, productId: r.product_id, kind: 'discount_ended', detail: covered ? 'ended during a checkout hold: the held price stays' : 'back to the live price' });
        if (!covered && !holdEndComing && rules.tellDiscountEnd) {
          const base = await basePriceUsd(r);
          await hold.tellBuyer(r.buyer_id, hold.words.discountEnded(name, base, base * (1 - Number(r.discount_seen_pct) / 100)), { type: 'product', id: r.product_id });
        }
        done.ended++;
      }
    } catch (err) {
      console.error('[discount-hold] basket part not checked (non-fatal):', err.message);
    }
  }
  return done;
}

async function checkEndedHolds(rules, now = new Date()) {
  let told = 0;
  const { rows } = await db.query(
    `SELECT c.id, c.buyer_id, c.checkout_locked_at FROM carts c
     WHERE c.checkout_locked_at IS NOT NULL AND c.hold_end_told_at IS NULL AND c.merged_into IS NULL
       AND c.checkout_locked_at <= $1::timestamptz - make_interval(mins => $2) AND c.checkout_locked_at > $1::timestamptz - interval '2 days'
       AND EXISTS (SELECT 1 FROM cart_items ci WHERE ci.cart_id = c.id)`,
    [now, rules.holdMinutes]
  );
  for (const c of rows) {
    try {
      const { rowCount } = await db.query('UPDATE carts SET hold_end_told_at = now() WHERE id = $1 AND hold_end_told_at IS NULL RETURNING id', [c.id]);
      if (!rowCount) continue;
      // did a price go back up? (a held price below today's price)
      const { rows: items } = await db.query(
        `SELECT ci.product_id, ci.locked_price, ci.extra_locked_price, p.price, p.currency_code, p.category, p.part, p.weight_kg, p.length_cm, p.width_cm, p.height_cm
         FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.cart_id = $1`, [c.id]);
      let wentUp = false;
      for (const it of items) {
        if (it.locked_price === null) continue;
        const active = await findActiveDiscount(it.product_id);
        const live = (await basePriceUsd(it)) * (active ? 1 - active.percentage / 100 : 1);
        if (live > Number(it.locked_price) + 0.004 || (it.extra_locked_price !== null && live > Number(it.extra_locked_price) + 0.004)) { wentUp = true; break; }
      }
      await hold.recordEvent({ cartId: c.id, kind: 'hold_ended', detail: wentUp ? 'ended without an order; a price went back up' : 'ended without an order; no price changed' });
      if (wentUp && rules.tellHoldEnd) await hold.tellBuyer(c.buyer_id, hold.words.holdEnded());
      told++;
    } catch (err) {
      console.error('[discount-hold] ended hold not checked (non-fatal):', err.message);
    }
  }
  return told;
}

async function sendDailySummary(rules, now = new Date()) {
  if (rules.notifyMode !== 'daily') return false;
  const localHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: rules.summaryTz || 'Asia/Riyadh', hour: '2-digit', hour12: false }).format(now)) % 24;
  if (localHour !== rules.summaryHour) return false;
  const last = rules.lastSummaryAt ? new Date(rules.lastSummaryAt) : null;
  if (last && now - last < 20 * 3600 * 1000) return false;
  const { rowCount } = await db.query('UPDATE discount_hold_rules SET last_summary_at = $1 WHERE id = 1 AND (last_summary_at IS NULL OR last_summary_at < $1::timestamptz - interval \'20 hours\') RETURNING id', [now]);
  if (!rowCount) return false;
  const since = last || new Date(now - 24 * 3600 * 1000);
  const { rows } = await db.query('SELECT kind, count(*)::int AS n FROM discount_hold_events WHERE created_at > $1 GROUP BY kind', [since]);
  const n = (k) => rows.find((x) => x.kind === k)?.n || 0;
  const c = { hold_started: n('hold_started'), order_saved: n('order_saved'), new_line: n('new_line'), lowered: n('lowered'), discount_ended: n('discount_ended') };
  if (Object.values(c).every((v) => v === 0)) return false;
  await hold.notifyAdmins(hold.words.adminSummary(c));
  return true;
}

async function checkDiscountHolds(now = new Date()) {
  const rules = await hold.getRules();
  const basket = await checkBasketDiscounts(rules, now);
  const holdsEnded = await checkEndedHolds(rules, now);
  const summary = await sendDailySummary(rules, now);
  return { ...basket, holdsEnded, summary };
}

function startScheduledDiscountHoldCheck() {
  const tick = async () => {
    try { await checkDiscountHolds(); } catch (err) { console.error('[discount-hold] scheduled tick failed (non-fatal, will retry next interval):', err.message); }
  };
  tick();
  setInterval(tick, CHECK_INTERVAL_MS);
}

module.exports = { checkDiscountHolds, checkBasketDiscounts, checkEndedHolds, sendDailySummary, startScheduledDiscountHoldCheck };
