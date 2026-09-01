const express = require('express');
const db = require('../../../db/pool');
const { calculateBuyerPriceUsd } = require('../pricing/engine');
const { findMatchingDiscountRule } = require('../pricing/discountRules');
const { buildSupplierLabelMap } = require('../shared/supplierAnonymize');
const { validatePromoCode, calculateDiscountUsd } = require('../promotions/helpers');

/**
 * Cart module — BUY-030–032. Cart holds items from multiple suppliers; the
 * split into supplier sub-orders happens at checkout (see order module).
 *
 * Backed by PostgreSQL. The cart row is created lazily on first item add if
 * it doesn't already exist (cartId is client-generated — a UUID from the
 * mobile app, for example — so there's no separate "create cart" call).
 *
 * All three endpoints below return the same full item shape (name, price,
 * currencyCode, supplierName) rather than POST/DELETE returning a
 * stripped-down productId/quantity pair — this way the client (e.g. the
 * mobile app's cart screen, which groups items by supplier) never needs an
 * extra round-trip after a mutation just to redisplay the cart.
 */
const router = express.Router();

async function ensureCartExists(cartId) {
  await db.query('INSERT INTO carts (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [cartId]);
}

// Confirmed with the person through several rounds of clarification:
// extracted from getFullCart's own original inline logic so the new
// /lock-prices endpoint below can compute this exact same real,
// live price too, when snapshotting it at the moment checkout
// genuinely begins.
async function computeLivePrice(r) {
  const discountPercentage = await findMatchingDiscountRule(r.product_id);
  if (r.currency_code !== 'CNY') {
    // Legacy pre-pricing-engine product — pass through unchanged (see
    // the same handling in the catalog module for why).
    const basePrice = Number(r.price);
    const price = discountPercentage !== null ? basePrice * (1 - discountPercentage / 100) : basePrice;
    const originalPrice = discountPercentage !== null ? basePrice : null;
    return { price, originalPrice, currencyCode: r.currency_code };
  }
  const result = await calculateBuyerPriceUsd({
    supplierCostCny: Number(r.price),
    weightKg: r.weight_kg === null ? null : Number(r.weight_kg),
    lengthCm: r.length_cm === null ? null : Number(r.length_cm),
    widthCm: r.width_cm === null ? null : Number(r.width_cm),
    heightCm: r.height_cm === null ? null : Number(r.height_cm),
  });
  const basePriceUsd = result.buyerPriceUsd;
  const price = discountPercentage !== null ? basePriceUsd * (1 - discountPercentage / 100) : basePriceUsd;
  const originalPrice = discountPercentage !== null ? basePriceUsd : null;
  return { price, originalPrice, currencyCode: 'USD' };
}

const CHECKOUT_LOCK_DURATION_MS = 60 * 60 * 1000; // confirmed with the person: 60 real minutes

async function getFullCart(cartId) {
  const { rows: cartRows } = await db.query('SELECT buyer_id, applied_promo_code, checkout_locked_at FROM carts WHERE id = $1', [cartId]);
  const buyerId = cartRows[0]?.buyer_id || null;
  let appliedPromoCode = cartRows[0]?.applied_promo_code || null;
  const checkoutLockedAt = cartRows[0]?.checkout_locked_at || null;
  // Confirmed with the person: explicitly re-derived on every real
  // read (not trusted from a stale client-side timer) -- a lock is
  // only genuinely still active if checkout_locked_at is set AND
  // within the real last 60 minutes.
  const lockActive = checkoutLockedAt !== null && (Date.now() - new Date(checkoutLockedAt).getTime()) < CHECKOUT_LOCK_DURATION_MS;
  const lockExpiresAt = lockActive ? new Date(new Date(checkoutLockedAt).getTime() + CHECKOUT_LOCK_DURATION_MS).toISOString() : null;

  const { rows } = await db.query(
    `SELECT ci.product_id, ci.quantity, ci.locked_price, p.name, p.price, p.currency_code, p.weight_kg, p.length_cm, p.width_cm, p.height_cm, p.stock_quantity, p.supplier_id
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     WHERE ci.cart_id = $1`,
    [cartId]
  );
  // Real supplier anonymization (new, business decision confirmed
  // directly): a buyer should never see a real supplier's name
  // anywhere in the app. Built once here, across every real item in
  // this cart, so the SAME real supplier gets the SAME anonymized
  // label consistently across every item in this one real response
  // (see shared/supplierAnonymize.js's own header comment for the
  // full real numbering scheme).
  const supplierLabelMap = buildSupplierLabelMap(rows.map((r) => r.supplier_id), cartId);
  // Same real, live pricing calculation as the catalog module (see
  // services/api/src/modules/pricing/engine.js) — the cart shows the
  // real current buyer price, not the supplier's RMB cost, and reflects
  // a fee/rate change immediately, same as browsing. This is
  // deliberately NOT locked in yet; that happens at order placement
  // (see the order module) — see migration 014's header comment for why.
  //
  // Confirmed with the person through several rounds of clarification
  // (migration 076): EXCEPT during an active real checkout price lock
  // -- while lockActive, the real, live-computed price is still
  // computed here (needed to detect and flag a genuine change), but
  // the real, DISPLAYED/CHARGED price is the real locked_price
  // snapshot instead, frozen at whatever it was the moment checkout
  // genuinely began.
  const items = await Promise.all(rows.map(async (r) => {
    const live = await computeLivePrice(r);
    let price = live.price;
    let originalPrice = live.originalPrice;
    let priceChanged = false;
    if (lockActive && r.locked_price !== null) {
      const lockedPrice = Number(r.locked_price);
      priceChanged = Math.abs(lockedPrice - live.price) > 0.001;
      price = lockedPrice;
      // Confirmed simplest, most consistent interpretation: the real
      // locked amount is the single, final number that matters --
      // originalPrice (the struck-through discount display) stays
      // live even during a real lock, since it's purely informational
      // and never what's actually charged.
    }
    // Real primary product image (new) -- closes a real gap: no image
    // at all was returned for a cart item before, so neither the cart
    // screen nor checkout's own itemized summary could show one, only
    // the product's name as plain text. Images live in their own
    // real, one-to-many product_images table (see catalog/routes.js's
    // own identical pattern) -- the first one by real sort_order is
    // the real primary image, same definition used everywhere else in
    // this codebase.
    const { rows: imageRows } = await db.query('SELECT url FROM product_images WHERE product_id = $1 ORDER BY sort_order LIMIT 1', [r.product_id]);
    return {
      productId: r.product_id,
      quantity: r.quantity,
      name: r.name,
      price,
      originalPrice,
      priceChanged,
      currencyCode: live.currencyCode,
      imageUrl: imageRows[0]?.url || null,
      // Real stock quantity (new) -- lets the client warn/clamp a
      // buyer BEFORE they hit checkout, rather than the only real
      // guard being order placement's atomic stock_quantity >= $1
      // decrement (services/api/src/modules/order/routes.js) -- that
      // guard was already correct and race-safe; this is a real,
      // separate UX improvement, not a data-integrity fix.
      stockQuantity: r.stock_quantity,
      supplierName: supplierLabelMap.get(r.supplier_id),
      // Real weight (#23) -- already queried internally above, never
      // previously exposed to the client. Null when a real product
      // has no real weight on file rather than a fabricated default.
      weightKg: r.weight_kg === null ? null : Number(r.weight_kg),
    };
  }));
  // Confirmed with the person: an applied promo code persists on the
  // cart itself (not just in-memory app state), but is re-validated
  // fresh on every real read here -- if it's expired or hit its
  // real usage limit since being applied, it's automatically cleared
  // from the cart record rather than shown as if still valid.
  let promoDiscountUsd = 0;
  let appliedPromoDetails = null;
  if (appliedPromoCode) {
    const validation = await validatePromoCode(appliedPromoCode, buyerId);
    if (validation.valid) {
      appliedPromoDetails = { code: appliedPromoCode, type: validation.promoCode.type, value: validation.promoCode.value === null ? null : Number(validation.promoCode.value) };
      const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      // Matches the existing client-side _previewDiscount's own real,
      // established behavior: free_shipping's real amount depends on
      // a real server-side shipping breakdown this cart response
      // doesn't compute -- not guessed at here either, left for real
      // order-placement time where the real figure is already
      // correctly computed.
      if (validation.promoCode.type !== 'free_shipping') {
        promoDiscountUsd = calculateDiscountUsd(validation.promoCode, subtotal, 0);
      }
    } else {
      await db.query('UPDATE carts SET applied_promo_code = NULL WHERE id = $1', [cartId]);
      appliedPromoCode = null;
    }
  }

  return { cartId, items, appliedPromoCode, appliedPromoDetails, promoDiscountUsd, lockActive, lockExpiresAt };
}

// Real, honest note on the check below: stock isn't reserved per-cart
// (there's no "N held for this cart" concept anywhere in this schema)
// -- it's a live, shared number, same one order placement itself
// checks against. Two buyers could each pass this check for the last
// unit; only one of THEM will actually get it at real order placement,
// where the atomic guard lives. This check is a real, honest
// early-warning for the common case, not a promise of a reservation.
async function checkStockAvailable(productId, requestedQuantity) {
  const { rows } = await db.query('SELECT stock_quantity, name FROM products WHERE id = $1', [productId]);
  if (rows.length === 0) return { ok: false, error: 'Product not found' };
  if (requestedQuantity > rows[0].stock_quantity) {
    return { ok: false, error: `Only ${rows[0].stock_quantity} of "${rows[0].name}" left in stock` };
  }
  return { ok: true };
}

router.get('/:cartId', async (req, res, next) => {
  try {
    res.json(await getFullCart(req.params.cartId));
  } catch (err) {
    next(err);
  }
});

// POST /:cartId/lock-prices -- confirmed with the person through
// several rounds of clarification: called when the buyer genuinely
// enters checkout, not when an item is added to the cart. If a real,
// still-active lock already exists (checkout_locked_at within the
// real last 60 minutes), this does nothing and just returns the
// current cart -- explicitly confirmed: going back to the basket
// mid-countdown and returning to checkout before it expires keeps
// the SAME real countdown running, not a reset one. Otherwise starts
// a brand new real 60-minute lock, snapshotting every item's own
// real live price at this exact moment.
router.post('/:cartId/lock-prices', async (req, res, next) => {
  try {
    await ensureCartExists(req.params.cartId);
    const { rows: cartRows } = await db.query('SELECT checkout_locked_at FROM carts WHERE id = $1', [req.params.cartId]);
    const existingLockedAt = cartRows[0]?.checkout_locked_at || null;
    const alreadyActive = existingLockedAt !== null && (Date.now() - new Date(existingLockedAt).getTime()) < CHECKOUT_LOCK_DURATION_MS;

    if (!alreadyActive) {
      const { rows } = await db.query(
        `SELECT ci.product_id, p.price, p.currency_code, p.weight_kg, p.length_cm, p.width_cm, p.height_cm
         FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.cart_id = $1`,
        [req.params.cartId]
      );
      await Promise.all(rows.map(async (r) => {
        const live = await computeLivePrice(r);
        await db.query('UPDATE cart_items SET locked_price = $1 WHERE cart_id = $2 AND product_id = $3', [live.price, req.params.cartId, r.product_id]);
      }));
      await db.query('UPDATE carts SET checkout_locked_at = now() WHERE id = $1', [req.params.cartId]);
    }
    res.json(await getFullCart(req.params.cartId));
  } catch (err) {
    next(err);
  }
});

// PATCH /:cartId/promo-code  { code: string | null } -- applies or
// clears the real, persisted promo code on this cart (migration 075).
// Confirmed with the person: this survives the buyer leaving the
// checkout screen entirely, even closing and reopening the app,
// since it's stored on the real cart record itself, not just
// in-memory app state.
router.patch('/:cartId/promo-code', async (req, res, next) => {
  try {
    const { code } = req.body || {};
    await ensureCartExists(req.params.cartId);
    if (!code) {
      await db.query('UPDATE carts SET applied_promo_code = NULL WHERE id = $1', [req.params.cartId]);
      return res.json(await getFullCart(req.params.cartId));
    }
    const { rows: cartRows } = await db.query('SELECT buyer_id FROM carts WHERE id = $1', [req.params.cartId]);
    const validation = await validatePromoCode(code, cartRows[0]?.buyer_id || null);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.reason });
    }
    await db.query('UPDATE carts SET applied_promo_code = $1 WHERE id = $2', [code, req.params.cartId]);
    res.json(await getFullCart(req.params.cartId));
  } catch (err) {
    next(err);
  }
});

router.post('/:cartId/items', async (req, res, next) => {
  try {
    const { productId, quantity } = req.body || {};
    if (!productId || !quantity) {
      return res.status(400).json({ error: 'productId and quantity are required' });
    }
    // Real stock check (new) -- see checkStockAvailable's own comment
    // for why this is an early warning, not a reservation. Checks the
    // REAL resulting total (existing cart quantity + this add), not
    // just the newly-requested amount, since POST adds rather than sets.
    const { rows: existingRows } = await db.query('SELECT quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2', [req.params.cartId, productId]);
    const existingQuantity = existingRows[0]?.quantity || 0;
    const stockCheck = await checkStockAvailable(productId, existingQuantity + quantity);
    if (!stockCheck.ok) return res.status(400).json({ error: stockCheck.error });

    await ensureCartExists(req.params.cartId);
    await db.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)
       ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity`,
      [req.params.cartId, productId, quantity]
    );
    res.status(201).json(await getFullCart(req.params.cartId));
  } catch (err) {
    next(err);
  }
});

// PATCH /:cartId/items/:productId  { quantity } — sets the EXACT quantity
// (unlike POST above, which adds to whatever's already there). Needed for
// a quantity stepper UI (+/- buttons) where the client knows the target
// count rather than a delta. quantity <= 0 removes the item entirely.
router.patch('/:cartId/items/:productId', async (req, res, next) => {
  try {
    const { quantity } = req.body || {};
    if (typeof quantity !== 'number') {
      return res.status(400).json({ error: 'quantity (number) is required' });
    }
    if (quantity <= 0) {
      await db.query('DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2', [req.params.cartId, req.params.productId]);
    } else {
      // Real stock check (new) -- see checkStockAvailable's own
      // comment. PATCH sets the exact quantity, so the requested
      // amount IS the real resulting total (unlike POST above).
      const stockCheck = await checkStockAvailable(req.params.productId, quantity);
      if (!stockCheck.ok) return res.status(400).json({ error: stockCheck.error });

      await ensureCartExists(req.params.cartId);
      await db.query(
        `INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)
         ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
        [req.params.cartId, req.params.productId, quantity]
      );
    }
    res.json(await getFullCart(req.params.cartId));
  } catch (err) {
    next(err);
  }
});

router.delete('/:cartId/items/:productId', async (req, res, next) => {
  try {
    await db.query('DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2', [req.params.cartId, req.params.productId]);
    res.json(await getFullCart(req.params.cartId));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
