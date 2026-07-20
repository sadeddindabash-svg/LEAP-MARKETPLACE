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
     JOIN hub_shipments hs ON hs.sub_order_id = so.id
     JOIN orders o ON o.id = so.order_id
     WHERE oli.product_id = $1 AND o.buyer_id = $2 AND hs.status = 'delivered'
     LIMIT 1`,
    [productId, buyerId]
  );
  return rows.length > 0;
}

const MAX_REVIEW_PHOTOS = 3;

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
    photos: row.photos || [],
  };
}

// Real, batched photo attachment (migration 031) -- one real query for
// however many real reviews are being returned, rather than a real
// query-per-review in a loop.
async function attachPhotos(client, rows) {
  if (rows.length === 0) return rows;
  const { rows: photoRows } = await client.query(
    'SELECT review_id, url FROM review_photos WHERE review_id = ANY($1::int[]) ORDER BY review_id, sort_order ASC',
    [rows.map((r) => r.id)]
  );
  const photosByReview = {};
  for (const p of photoRows) {
    (photosByReview[p.review_id] ||= []).push(p.url);
  }
  return rows.map((r) => ({ ...r, photos: photosByReview[r.id] || [] }));
}

// POST /reviews { productId, rating, comment? } — real submit-or-edit.
// A buyer's SECOND submission for the same real product is a real edit
// of their existing review, not a new row — and genuinely sends it back
// to 'pending', since the content actually changed and needs real
// re-review before it counts again.
router.post('/', requireAuth, async (req, res, next) => {
  const client = await db.getPool().connect();
  try {
    const { productId, rating, comment, photos } = req.body || {};
    if (!productId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'productId and an integer rating (1-5) are required' });
    }
    if (photos !== undefined && (!Array.isArray(photos) || photos.length > MAX_REVIEW_PHOTOS)) {
      return res.status(400).json({ error: `photos must be an array of up to ${MAX_REVIEW_PHOTOS} URLs` });
    }

    const needsVerified = await requiresVerifiedPurchase(client);
    if (needsVerified) {
      const verified = await hasVerifiedPurchase(client, req.user.sub, productId);
      if (!verified) {
        return res.status(403).json({ error: 'Only buyers who have received this product can leave a review.' });
      }
    }

    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO product_reviews (product_id, buyer_id, rating, comment, status, updated_at)
       VALUES ($1, $2, $3, $4, 'pending', now())
       ON CONFLICT (product_id, buyer_id)
       DO UPDATE SET rating = $3, comment = $4, status = 'pending', updated_at = now()
       RETURNING *`,
      [productId, req.user.sub, rating, comment || null]
    );
    const reviewId = rows[0].id;

    // Real photos (migration 031) -- a real edit fully REPLACES the
    // previous real set (a resubmitted review already goes back to
    // 'pending' for real re-review; its photos should reflect the real
    // current submission, not accumulate stale ones from before).
    if (photos !== undefined) {
      await client.query('DELETE FROM review_photos WHERE review_id = $1', [reviewId]);
      for (let i = 0; i < photos.length; i++) {
        await client.query('INSERT INTO review_photos (review_id, url, sort_order) VALUES ($1, $2, $3)', [reviewId, photos[i], i]);
      }
    }
    await client.query('COMMIT');

    const [withPhotos] = await attachPhotos(db, [rows[0]]);
    res.status(201).json(toReviewDto(withPhotos));
  } catch (err) {
    await client.query('ROLLBACK');
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
    const withPhotos = await attachPhotos(db, rows);
    res.json(withPhotos.map(toReviewDto));
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
    const withPhotos = await attachPhotos(db, rows);
    res.json(withPhotos.map((row) => ({ ...toReviewDto(row), productName: row.product_name })));
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
    const [withPhotos] = await attachPhotos(db, rows);
    res.json(toReviewDto(withPhotos));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
