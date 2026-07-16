const express = require('express');
const db = require('../../../db/pool');
const { requireAuth } = require('../auth/middleware');
const { toBuyerProductDto, attachBuyerPrice, attachBuyerImages } = require('../catalog/routes');

/**
 * Real wishlist (migration 018) — a buyer saves real products for
 * later. Same simple many-to-many pattern as My Garage's saved
 * vehicles. Reuses the real catalog module's buyer-facing product DTO
 * helpers (language resolution, live price, real photos) rather than
 * re-implementing them here, which would risk drift between what a
 * product looks like in the catalog vs. in the wishlist.
 */
const router = express.Router();

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { lang } = req.query;
    const { rows } = await db.query(
      `SELECT p.* FROM wishlist_items w
       JOIN products p ON p.id = w.product_id
       WHERE w.buyer_id = $1
       ORDER BY w.created_at DESC`,
      [req.user.sub]
    );
    const dtos = await Promise.all(rows.map(async (r) => {
      let dto = toBuyerProductDto(r, lang);
      dto = await attachBuyerImages(dto, r.id);
      dto = await attachBuyerPrice(dto, r);
      return dto;
    }));
    res.json(dtos);
  } catch (err) {
    next(err);
  }
});

// A real, specific "is this one product wishlisted" check — lets the
// product detail page's heart icon know its own state without needing
// to fetch and search the buyer's entire wishlist just to answer one
// yes/no question.
router.get('/me/:productId', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT 1 FROM wishlist_items WHERE buyer_id = $1 AND product_id = $2',
      [req.user.sub, req.params.productId]
    );
    res.json({ wishlisted: rows.length > 0 });
  } catch (err) {
    next(err);
  }
});

router.post('/me/:productId', requireAuth, async (req, res, next) => {
  try {
    const productCheck = await db.query('SELECT id FROM products WHERE id = $1', [req.params.productId]);
    if (productCheck.rows.length === 0) return res.status(404).json({ error: 'Product not found' });

    // Idempotent by design — tapping an already-filled heart icon a
    // second time (a real double-tap, a slow network retry) should not
    // be a real error; it should just stay wishlisted.
    await db.query(
      'INSERT INTO wishlist_items (buyer_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.sub, req.params.productId]
    );
    res.status(201).json({ wishlisted: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/me/:productId', requireAuth, async (req, res, next) => {
  try {
    // Idempotent by design, same reasoning as POST above — removing
    // something already not on the wishlist is still a successful
    // outcome from the caller's perspective, not a real error.
    await db.query('DELETE FROM wishlist_items WHERE buyer_id = $1 AND product_id = $2', [req.user.sub, req.params.productId]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
