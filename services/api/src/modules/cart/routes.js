const express = require('express');

/**
 * Cart module — BUY-030–032. Cart holds items from multiple suppliers; the
 * split into supplier sub-orders happens at checkout (see order module),
 * not here. This placeholder keeps cart state in memory keyed by a
 * client-supplied cartId — replace with session/user-scoped persistence.
 */
const router = express.Router();

const carts = new Map(); // cartId -> [{ productId, quantity }]

router.get('/:cartId', (req, res) => {
  res.json({ cartId: req.params.cartId, items: carts.get(req.params.cartId) || [] });
});

router.post('/:cartId/items', (req, res) => {
  const { productId, quantity } = req.body || {};
  if (!productId || !quantity) {
    return res.status(400).json({ error: 'productId and quantity are required' });
  }
  const items = carts.get(req.params.cartId) || [];
  const existing = items.find((i) => i.productId === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ productId, quantity });
  }
  carts.set(req.params.cartId, items);
  res.status(201).json({ cartId: req.params.cartId, items });
});

router.delete('/:cartId/items/:productId', (req, res) => {
  const items = (carts.get(req.params.cartId) || []).filter((i) => i.productId !== req.params.productId);
  carts.set(req.params.cartId, items);
  res.json({ cartId: req.params.cartId, items });
});

module.exports = router;
