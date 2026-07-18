const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');

/**
 * Real product reviews (migration 025). CONFIRMED SCOPE, discussed
 * before building: whether a review requires a real verified purchase
 * is admin-decided (a real, toggleable setting), not hardcoded either
 * way. Every real review requires real admin moderation before it's
 * visible or counts toward a product's average rating — the same real
 * quality gate every product listing already goes through. One real
 * review per product per buyer — re-submitting is a real edit (sent
 * back to 'pending' for re-review), never a second row.
 */
const router = express.Router();

async function requiresVerifiedPurchase(client) {
  const { rows } = await client.query("SELECT value FROM platform_settings WHERE key = 'require_verified_purchase_for_reviews'");
  return rows[0]?.value === 'true';
}

async function hasVerifiedPurchase(client, buyerId, productId) {
  const { rows } = await client.query(
    `SELECT 1 FROM order_line_items oli
     JOIN supplier_sub_orders so ON so.id = oli.sub_order_id
     JOIN orders o ON o.id = so.order_id
     WHERE oli.product_id = $1 AND o.buyer_id = $2 AND so.status = 'delivered'
     LIMIT 1`,
    [productId, buyerId]
  );
  return rows.length > 0;
}

function toReviewDto(row) {
  return {
    id: row.id,
    productId: row.product_id,
    buyerId: row.buyer_id,
    buyerName: row.buyer_name,
    rating: row.rating,
    comment: row.comment,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// POST /reviews { productId, rating, comment? } — real submit-or-edit.
// A buyer's SECOND submission for the same real product is a real edit
// of their existing review, not a new row — and genuinely sends it back
// to 'pending', since the content actually changed and needs real
// re-review before it counts again.
router.post('/', requireAuth, async (req, res, next) => {
  const client = await db.getPool().connect();
  try {
    const { productId, rating, comment } = req.body || {};
    if (!productId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'productId and an integer rating (1-5) are required' });
    }

    const needsVerified = await requiresVerifiedPurchase(client);
    if (needsVerified) {
      const verified = await hasVerifiedPurchase(client, req.user.sub, productId);
      if (!verified) {
        return res.status(403).json({ error: 'Only buyers who have received this product can leave a review.' });
      }
    }

    const { rows } = await client.query(
      `INSERT INTO product_reviews (product_id, buyer_id, rating, comment, status, updated_at)
       VALUES ($1, $2, $3, $4, 'pending', now())
       ON CONFLICT (product_id, buyer_id)
       DO UPDATE SET rating = $3, comment = $4, status = 'pending', updated_at = now()
       RETURNING *`,
      [productId, req.user.sub, rating, comment || null]
    );
    res.status(201).json(toReviewDto(rows[0]));
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
});

// GET /reviews/me — this buyer's own real reviews, any real status
// (pending/approved/rejected), so they can see where their own review
// stands.
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM product_reviews WHERE buyer_id = $1 ORDER BY updated_at DESC', [req.user.sub]);
    res.json(rows.map(toReviewDto));
  } catch (err) {
    next(err);
  }
});

// DELETE /reviews/:id — a buyer can only delete their real own review.
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query('DELETE FROM product_reviews WHERE id = $1 AND buyer_id = $2 RETURNING id', [req.params.id, req.user.sub]);
    if (rows.length === 0) return res.status(404).json({ error: 'Review not found' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /reviews/pending — real admin moderation queue.
router.get('/pending', requireAuth, requireRole('admin'), requirePageAccess('reviews'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT r.*, u.name AS buyer_name, p.name AS product_name
       FROM product_reviews r
       JOIN users u ON u.id = r.buyer_id
       JOIN products p ON p.id = r.product_id
       WHERE r.status = 'pending'
       ORDER BY r.created_at ASC`
    );
    res.json(rows.map((row) => ({ ...toReviewDto(row), productName: row.product_name })));
  } catch (err) {
    next(err);
  }
});

// PATCH /reviews/:id/moderate { action: 'approve'|'reject' } — real
// admin moderation, the same real quality gate every product listing
// already goes through.
router.patch('/:id/moderate', requireAuth, requireRole('admin'), requirePageAccess('reviews'), async (req, res, next) => {
  try {
    const { action } = req.body || {};
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
    }
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const { rows } = await db.query(
      `UPDATE product_reviews SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [newStatus, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Review not found' });
    res.json(toReviewDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
