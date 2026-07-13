const express = require('express');
const db = require('../../../db/pool');

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
    `SELECT ci.product_id, ci.quantity, p.name, p.price, p.currency_code, s.name AS supplier_name
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     LEFT JOIN suppliers s ON s.id = p.supplier_id
     WHERE ci.cart_id = $1`,
    [cartId]
  );
  return {
    cartId,
    items: rows.map((r) => ({
      productId: r.product_id,
      quantity: r.quantity,
      name: r.name,
      price: Number(r.price),
      currencyCode: r.currency_code,
      supplierName: r.supplier_name,
    })),
  };
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
