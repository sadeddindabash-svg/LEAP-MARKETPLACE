const express = require('express');
const db = require('../../../db/pool');
const { requireAuth } = require('../auth/middleware');
const { toBuyerProductDto, attachBuyerPrice, attachBuyerImages } = require('../catalog/routes');

/**
 * Real recently viewed products (migration 032) — synced to the real
 * buyer's account (confirmed scope), not device-local, so it follows
 * them across devices. Same simple pattern as the real wishlist
 * module — reuses the catalog module's buyer-facing product DTO
 * helpers rather than re-implementing them here.
 *
 * Real logged-in buyers only — a real guest has no account for this
 * to sync to.
 */
const router = express.Router();

const MAX_RECENTLY_VIEWED = 20;

// POST /recently-viewed/:productId — real, best-effort record of a
// real product view. A repeat real view of the same product updates
// viewed_at (moves it back to the front of the list) rather than
// creating a duplicate row.
router.post('/:productId', requireAuth, async (req, res, next) => {
  try {
    const { rows: productRows } = await db.query('SELECT id FROM products WHERE id = $1', [req.params.productId]);
    if (productRows.length === 0) return res.status(404).json({ error: 'Product not found' });

    await db.query(
      `INSERT INTO recently_viewed_products (buyer_id, product_id, viewed_at) VALUES ($1, $2, now())
       ON CONFLICT (buyer_id, product_id) DO UPDATE SET viewed_at = now()`,
      [req.user.sub, req.params.productId]
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /recently-viewed/me — the real, most recent products this buyer
// has viewed, newest first, capped at a real, reasonable limit rather
// than an ever-growing real history.
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { lang } = req.query;
    const { rows } = await db.query(
      `SELECT p.* FROM recently_viewed_products rv
       JOIN products p ON p.id = rv.product_id
       WHERE rv.buyer_id = $1
       ORDER BY rv.viewed_at DESC
       LIMIT $2`,
      [req.user.sub, MAX_RECENTLY_VIEWED]
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

module.exports = router;
