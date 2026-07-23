const express = require('express');
const db = require('../../../db/pool');
const { calculateBuyerPriceUsd } = require('../pricing/engine');

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

async function getFullCart(cartId) {
  const { rows } = await db.query(
    `SELECT ci.product_id, ci.quantity, p.name, p.price, p.currency_code, p.weight_kg, p.length_cm, p.width_cm, p.height_cm, p.stock_quantity, s.name AS supplier_name
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     LEFT JOIN suppliers s ON s.id = p.supplier_id
     WHERE ci.cart_id = $1`,
    [cartId]
  );
  // Same real, live pricing calculation as the catalog module (see
  // services/api/src/modules/pricing/engine.js) — the cart shows the
  // real current buyer price, not the supplier's RMB cost, and reflects
  // a fee/rate change immediately, same as browsing. This is
  // deliberately NOT locked in yet; that happens at order placement
  // (see the order module) — see migration 014's header comment for why.
  const items = await Promise.all(rows.map(async (r) => {
    let price, currencyCode;
    if (r.currency_code !== 'CNY') {
      // Legacy pre-pricing-engine product — pass through unchanged (see
      // the same handling in the catalog module for why).
      price = Number(r.price);
      currencyCode = r.currency_code;
    } else {
      const result = await calculateBuyerPriceUsd({
        supplierCostCny: Number(r.price),
        weightKg: r.weight_kg === null ? null : Number(r.weight_kg),
        lengthCm: r.length_cm === null ? null : Number(r.length_cm),
        widthCm: r.width_cm === null ? null : Number(r.width_cm),
        heightCm: r.height_cm === null ? null : Number(r.height_cm),
      });
      price = result.buyerPriceUsd;
      currencyCode = 'USD';
    }
    return {
      productId: r.product_id,
      quantity: r.quantity,
      name: r.name,
      price,
      currencyCode,
      // Real stock quantity (new) -- lets the client warn/clamp a
      // buyer BEFORE they hit checkout, rather than the only real
      // guard being order placement's atomic stock_quantity >= $1
      // decrement (services/api/src/modules/order/routes.js) -- that
      // guard was already correct and race-safe; this is a real,
      // separate UX improvement, not a data-integrity fix.
      stockQuantity: r.stock_quantity,
      supplierName: r.supplier_name,
    };
  }));
  return { cartId, items };
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
