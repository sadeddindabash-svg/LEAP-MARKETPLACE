const express = require('express');
const db = require('../../../db/pool');

/**
 * Cart module — BUY-030–032. Cart holds items from multiple suppliers; the
 * split into supplier sub-orders happens at checkout (see order module).
 *
 * Backed by PostgreSQL. The cart row is created lazily on first item add if
 * it doesn't already exist (cartId is client-generated — a UUID from the
 * mobile app, for example — so there's no separate "create cart" call).
 */
const router = express.Router();

async function ensureCartExists(cartId) {
  await db.query('INSERT INTO carts (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [cartId]);
}

router.get('/:cartId', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT ci.product_id, ci.quantity, p.name, p.price, p.currency_code
       FROM cart_items ci JOIN products p ON p.id = ci.product_id
       WHERE ci.cart_id = $1`,
      [req.params.cartId]
    );
    res.json({
      cartId: req.params.cartId,
      items: rows.map((r) => ({
        productId: r.product_id,
        quantity: r.quantity,
        name: r.name,
        price: Number(r.price),
        currencyCode: r.currency_code,
      })),
    });
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
    const { rows } = await db.query('SELECT product_id, quantity FROM cart_items WHERE cart_id = $1', [req.params.cartId]);
    res.status(201).json({ cartId: req.params.cartId, items: rows.map((r) => ({ productId: r.product_id, quantity: r.quantity })) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:cartId/items/:productId', async (req, res, next) => {
  try {
    await db.query('DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2', [req.params.cartId, req.params.productId]);
    const { rows } = await db.query('SELECT product_id, quantity FROM cart_items WHERE cart_id = $1', [req.params.cartId]);
    res.json({ cartId: req.params.cartId, items: rows.map((r) => ({ productId: r.product_id, quantity: r.quantity })) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
