const express = require('express');
const crypto = require('node:crypto');
const db = require('../../../db/pool');
const { optionalAuth } = require('../auth/middleware');

/**
 * ONE CART PER ACCOUNT. The cart routes (routes.js) work on the cart id a device sends. This layer sits in front of them and, for a signed-in buyer, turns that id into the buyer's ACCOUNT cart:
 *   - the buyer's carts (one per device, until now) are combined into the oldest one (the account cart); a device that sends a combined cart's old id is sent to the account cart (carts.merged_into)
 *   - a guest cart that a signed-in buyer sends joins the account cart (a buyer with no cart yet simply claims it)
 *   - items are ADDED together, and the combined quantity is lowered only to the stock available (never below what the account cart already had); a line that would end with nothing is dropped
 *   - the promo code and the checkout price lock of the account cart are kept; the cart being combined contributes its promo only when the account cart has none, and its price lock only when the account cart was empty
 *   - a cart that belongs to ANOTHER account is never shown or touched: the signed-in buyer gets their own cart; and a request with NO sign-in for an account cart gets a fresh empty guest cart (so a signed-out device never sees an account's cart)
 *   - the answer says what was combined ({ merge }) in the one call that combined carts; every later call has no notice
 * The routes answer with the cart's real id (cartId): the device adopts it. Guests are unchanged: a cart for that device only.
 */
const MAX_HOPS = 6;
const asNumber = (n) => Number(n) || 0;

async function followRedirects(client, cartId) {
  let id = cartId;
  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    const { rows } = await client.query('SELECT id, buyer_id, merged_into, applied_promo_code, checkout_locked_at FROM carts WHERE id = $1', [id]);
    if (rows.length === 0) return null;
    if (!rows[0].merged_into) return rows[0];
    id = rows[0].merged_into;
  }
  const { rows } = await client.query('SELECT id, buyer_id, merged_into, applied_promo_code, checkout_locked_at FROM carts WHERE id = $1', [id]);
  return rows[0] || null;
}

// Moves every line of `source` into `target` by the rules above and marks `source` as combined. Returns what happened, or null when the source had nothing in it.
async function mergeInto(client, source, target, lang) {
  const { rows: sourceItems } = await client.query(
    `SELECT ci.product_id, ci.quantity, ci.locked_price, p.name, p.name_ar, p.stock_quantity FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.cart_id = $1 ORDER BY ci.product_id`, [source.id]);
  const { rows: targetItems } = await client.query('SELECT product_id, quantity FROM cart_items WHERE cart_id = $1', [target.id]);
  const targetQty = new Map(targetItems.map((r) => [r.product_id, r.quantity]));
  const targetWasEmpty = targetItems.length === 0;
  const summary = { itemsAdded: 0, itemsCombined: 0, reduced: [], dropped: [] };
  const adoptLock = targetWasEmpty && source.checkout_locked_at && !target.checkout_locked_at;
  for (const item of sourceItems) {
    const name = lang === 'ar' && item.name_ar ? item.name_ar : item.name;
    const had = targetQty.get(item.product_id) || 0;
    const combined = had + item.quantity;
    const quantity = Math.max(had, Math.min(combined, asNumber(item.stock_quantity)));
    if (quantity <= 0) { summary.dropped.push({ productId: item.product_id, name }); continue; }
    if (quantity < combined) summary.reduced.push({ productId: item.product_id, name, from: combined, to: quantity });
    await client.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity, locked_price) VALUES ($1, $2, $3, $4)
       ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
      [target.id, item.product_id, quantity, adoptLock ? item.locked_price : null]);
    if (had > 0) summary.itemsCombined += 1; else summary.itemsAdded += 1;
  }
  if (source.applied_promo_code && !target.applied_promo_code) await client.query('UPDATE carts SET applied_promo_code = $1 WHERE id = $2', [source.applied_promo_code, target.id]);
  if (adoptLock) await client.query('UPDATE carts SET checkout_locked_at = $1 WHERE id = $2', [source.checkout_locked_at, target.id]);
  await client.query('DELETE FROM cart_items WHERE cart_id = $1', [source.id]);
  await client.query('UPDATE carts SET merged_into = $1, applied_promo_code = NULL, checkout_locked_at = NULL, updated_at = now() WHERE id = $2', [target.id, source.id]);
  return sourceItems.length === 0 ? null : summary;
}

function addSummary(total, part) {
  if (!part) return total;
  const t = total || { itemsAdded: 0, itemsCombined: 0, reduced: [], dropped: [] };
  t.itemsAdded += part.itemsAdded; t.itemsCombined += part.itemsCombined; t.reduced.push(...part.reduced); t.dropped.push(...part.dropped);
  return t;
}

/** The cart a request is really about: { cartId, merge }. `userId` null: a guest. */
async function resolveCart(cartId, userId, lang) {
  if (!userId) {
    await db.query('INSERT INTO carts (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [cartId]);
    const final = await followRedirects(db, cartId);
    if (final && !final.buyer_id) return { cartId: final.id, merge: null };
    const fresh = crypto.randomUUID();                       // an account's cart is never shown to, or changed by, a request that is not signed in
    await db.query('INSERT INTO carts (id) VALUES ($1)', [fresh]);
    return { cartId: fresh, merge: null };
  }
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('account-cart:' || $1))", [String(userId)]);
    await client.query('INSERT INTO carts (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [cartId]);
    const requested = await followRedirects(client, cartId);
    const { rows: owned } = await client.query('SELECT id, buyer_id, applied_promo_code, checkout_locked_at FROM carts WHERE buyer_id = $1 AND merged_into IS NULL ORDER BY created_at ASC, id ASC', [userId]);
    let survivor = owned[0] || null;
    let merge = null;
    if (!survivor) {
      if (requested && !requested.buyer_id) {
        await client.query('UPDATE carts SET buyer_id = $1 WHERE id = $2', [userId, requested.id]);
        survivor = { ...requested, buyer_id: userId };
      } else {
        const fresh = crypto.randomUUID();                   // the cart sent belongs to another account: this buyer gets their own
        await client.query('INSERT INTO carts (id, buyer_id) VALUES ($1, $2)', [fresh, userId]);
        survivor = { id: fresh, buyer_id: userId, applied_promo_code: null, checkout_locked_at: null };
      }
    } else if (requested && !requested.buyer_id && requested.id !== survivor.id) {
      merge = addSummary(merge, await mergeInto(client, requested, survivor, lang));
    }
    for (const other of owned.slice(1)) {
      const fresh = (await client.query('SELECT id, buyer_id, applied_promo_code, checkout_locked_at FROM carts WHERE id = $1', [other.id])).rows[0];
      merge = addSummary(merge, await mergeInto(client, fresh, survivor, lang));
    }
    await client.query('COMMIT');
    return { cartId: survivor.id, merge };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Wraps the cart router: resolves the cart id of every request first (the router below sees the account cart's id), adds { merge } to the one answer that combined carts, and adds POST /:cartId/clear. */
function accountCartRouter(inner) {
  const outer = express.Router();
  outer.use(optionalAuth);
  outer.use(async (req, res, next) => {
    const match = req.url.match(/^\/([^/?]+)(.*)$/);
    if (!match) return next();
    try {
      const resolved = await resolveCart(decodeURIComponent(match[1]), req.user?.sub || null, req.query.lang === 'ar' ? 'ar' : 'en');
      req.url = `/${encodeURIComponent(resolved.cartId)}${match[2]}`;
      if (resolved.merge) {
        const json = res.json.bind(res);
        res.json = (body) => json(body && body.cartId ? { ...body, merge: resolved.merge } : body);
      }
      next();
    } catch (err) { next(err); }
  });
  // After an order: the cart is emptied (items, promo code, price lock) and stays the same cart, so every device shows it empty.
  outer.post('/:cartId/clear', async (req, res, next) => {
    try {
      await db.query('DELETE FROM cart_items WHERE cart_id = $1', [req.params.cartId]);
      await db.query('UPDATE carts SET applied_promo_code = NULL, checkout_locked_at = NULL, updated_at = now() WHERE id = $1', [req.params.cartId]);
      res.json(await inner.getFullCart(req.params.cartId, req.user?.sub, req.query.lang));
    } catch (err) { next(err); }
  });
  outer.use(inner);
  return outer;
}

module.exports = { accountCartRouter, resolveCart, mergeInto };
