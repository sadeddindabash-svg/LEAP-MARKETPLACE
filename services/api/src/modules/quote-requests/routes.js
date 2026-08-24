const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');

/**
 * Quote-requests module -- real "request a part we don't carry"
 * system, confirmed with the person through several rounds of design
 * discussion before building: a buyer picks a vehicle (the same real
 * fitment cascade used elsewhere) and lists up to 20 real parts they
 * need. Real Leap staff source real prices from real suppliers
 * OFFLINE (there is deliberately no supplier-facing bidding UI here)
 * and enter them via the admin endpoints below. Once a price AND at
 * least one real photo exist for an item, sending the quote creates
 * a real product under the real "Leap Supplier" account (migration
 * 067) and feeds it into the existing real moderation queue -- this
 * module never bypasses that real review step.
 */
const router = express.Router();

const MAX_ITEMS_PER_REQUEST = 20;
const QUOTE_VALIDITY_DAYS = 7;
const LEAP_SUPPLIER_ID = 'supplier_leap';

function isForeignKeyViolation(err) {
  return err && err.code === '23503';
}

async function toItemDto(row, { includeAdminFields }) {
  const dto = {
    id: row.id,
    name: row.name,
    description: row.description,
    referencePhotoUrl: row.reference_photo_url,
    quantity: row.quantity,
    status: row.status,
    productId: row.product_id,
  };
  if (row.status === 'priced' && row.product_id) {
    const { rows } = await db.query('SELECT price, currency_code, status FROM products WHERE id = $1', [row.product_id]);
    if (rows.length > 0) {
      dto.price = Number(rows[0].price);
      dto.currencyCode = rows[0].currency_code;
      dto.readyToOrder = rows[0].status === 'active';
    }
  }
  if (includeAdminFields) {
    dto.draftPrice = row.draft_price != null ? Number(row.draft_price) : null;
    dto.draftCategory = row.draft_category;
    dto.draftPart = row.draft_part;
    const { rows: photos } = await db.query('SELECT id, url FROM quote_request_item_photos WHERE item_id = $1 ORDER BY sort_order', [row.id]);
    dto.stagedPhotos = photos.map((p) => ({ id: p.id, url: p.url }));
  }
  return dto;
}

async function toRequestDto(requestRow, { includeAdminFields = false } = {}) {
  const { rows: items } = await db.query(
    'SELECT * FROM quote_request_items WHERE request_id = $1 ORDER BY sort_order ASC',
    [requestRow.id]
  );
  const itemDtos = await Promise.all(items.map((item) => toItemDto(item, { includeAdminFields })));

  const { rows: fitmentRows } = await db.query(
    `SELECT vb.name AS brand, vm.name AS model, vg.name AS generation
     FROM vehicle_generations vg
     JOIN vehicle_models vm ON vm.id = vg.model_id
     JOIN vehicle_brands vb ON vb.id = vm.brand_id
     WHERE vg.id = $1`,
    [requestRow.generation_id]
  );
  const fitment = fitmentRows[0] || null;

  return {
    id: requestRow.id,
    buyerId: requestRow.buyer_id,
    generationId: requestRow.generation_id,
    year: requestRow.year,
    brand: fitment?.brand || null,
    model: fitment?.model || null,
    generation: fitment?.generation || null,
    status: requestRow.status,
    createdAt: requestRow.created_at,
    submittedAt: requestRow.submitted_at,
    quotedAt: requestRow.quoted_at,
    expiresAt: requestRow.expires_at,
    items: itemDtos,
  };
}

async function getOwnedRequest(requestId, buyerId) {
  const { rows } = await db.query('SELECT * FROM quote_requests WHERE id = $1 AND buyer_id = $2', [requestId, buyerId]);
  return rows[0] || null;
}

// ============================================================
// Buyer-facing
// ============================================================

// POST /quote-requests  { generationId, year }
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { generationId, year } = req.body || {};
    if (!generationId) return res.status(400).json({ error: 'generationId is required' });
    if (!year) return res.status(400).json({ error: 'year is required' });
    const id = `qr_${Date.now()}`;
    await db.query(
      'INSERT INTO quote_requests (id, buyer_id, generation_id, year) VALUES ($1, $2, $3, $4)',
      [id, req.user.sub, generationId, year]
    );
    const { rows } = await db.query('SELECT * FROM quote_requests WHERE id = $1', [id]);
    res.status(201).json(await toRequestDto(rows[0]));
  } catch (err) {
    if (isForeignKeyViolation(err)) return res.status(400).json({ error: 'Unknown generationId' });
    next(err);
  }
});

// GET /quote-requests/mine
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM quote_requests WHERE buyer_id = $1 ORDER BY created_at DESC', [req.user.sub]);
    res.json(await Promise.all(rows.map((r) => toRequestDto(r))));
  } catch (err) {
    next(err);
  }
});

// GET /quote-requests/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const request = await getOwnedRequest(req.params.id, req.user.sub);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    res.json(await toRequestDto(request));
  } catch (err) {
    next(err);
  }
});

// POST /quote-requests/:id/items  { name, description?, referencePhotoUrl?, quantity? }
router.post('/:id/items', requireAuth, async (req, res, next) => {
  try {
    const request = await getOwnedRequest(req.params.id, req.user.sub);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'draft') return res.status(409).json({ error: 'Items can only be added while the request is still a draft' });

    const { name, description, referencePhotoUrl, quantity } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

    const { rows: countRows } = await db.query('SELECT COUNT(*)::int AS count, COALESCE(MAX(sort_order), 0) AS max_order FROM quote_request_items WHERE request_id = $1', [req.params.id]);
    if (countRows[0].count >= MAX_ITEMS_PER_REQUEST) {
      return res.status(400).json({ error: `A request can have at most ${MAX_ITEMS_PER_REQUEST} items` });
    }

    const itemId = `qri_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    await db.query(
      `INSERT INTO quote_request_items (id, request_id, name, description, reference_photo_url, quantity, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [itemId, req.params.id, name.trim(), description?.trim() || null, referencePhotoUrl?.trim() || null, quantity || 1, countRows[0].max_order + 10]
    );
    const { rows } = await db.query('SELECT * FROM quote_requests WHERE id = $1', [req.params.id]);
    res.status(201).json(await toRequestDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

// PATCH /quote-requests/:id/items/:itemId  { name?, description?, referencePhotoUrl?, quantity? }
router.patch('/:id/items/:itemId', requireAuth, async (req, res, next) => {
  try {
    const request = await getOwnedRequest(req.params.id, req.user.sub);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (!['draft', 'quoted'].includes(request.status)) {
      return res.status(409).json({ error: 'Items can only be edited while the request is a draft or already quoted' });
    }

    const { rows: itemRows } = await db.query('SELECT * FROM quote_request_items WHERE id = $1 AND request_id = $2', [req.params.itemId, req.params.id]);
    if (itemRows.length === 0) return res.status(404).json({ error: 'Item not found' });
    const item = itemRows[0];

    const { name, description, referencePhotoUrl, quantity } = req.body || {};
    // Real, confirmed restriction: once a request is already quoted,
    // a buyer can still change how many they want, but can no longer
    // rewrite WHAT the item is -- that would invalidate the real
    // price staff already sourced for the original description.
    if (request.status === 'quoted' && (name !== undefined || description !== undefined || referencePhotoUrl !== undefined)) {
      return res.status(409).json({ error: 'Only quantity can be changed once a request has been quoted' });
    }

    await db.query(
      `UPDATE quote_request_items SET
         name = $1, description = $2, reference_photo_url = $3, quantity = $4
       WHERE id = $5`,
      [
        name !== undefined ? name.trim() : item.name,
        description !== undefined ? (description?.trim() || null) : item.description,
        referencePhotoUrl !== undefined ? (referencePhotoUrl?.trim() || null) : item.reference_photo_url,
        quantity !== undefined ? quantity : item.quantity,
        req.params.itemId,
      ]
    );
    const { rows } = await db.query('SELECT * FROM quote_requests WHERE id = $1', [req.params.id]);
    res.json(await toRequestDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

// DELETE /quote-requests/:id/items/:itemId
router.delete('/:id/items/:itemId', requireAuth, async (req, res, next) => {
  try {
    const request = await getOwnedRequest(req.params.id, req.user.sub);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (!['draft', 'quoted'].includes(request.status)) {
      return res.status(409).json({ error: 'Items can only be removed while the request is a draft or already quoted' });
    }
    const { rowCount } = await db.query('DELETE FROM quote_request_items WHERE id = $1 AND request_id = $2', [req.params.itemId, req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Item not found' });
    const { rows } = await db.query('SELECT * FROM quote_requests WHERE id = $1', [req.params.id]);
    res.json(await toRequestDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

// POST /quote-requests/:id/submit
router.post('/:id/submit', requireAuth, async (req, res, next) => {
  try {
    const request = await getOwnedRequest(req.params.id, req.user.sub);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'draft') return res.status(409).json({ error: 'Only a draft request can be submitted' });
    const { rows: countRows } = await db.query('SELECT COUNT(*)::int AS count FROM quote_request_items WHERE request_id = $1', [req.params.id]);
    if (countRows[0].count === 0) return res.status(400).json({ error: 'Add at least one item before submitting' });
    await db.query(`UPDATE quote_requests SET status = 'submitted', submitted_at = now() WHERE id = $1`, [req.params.id]);
    const { rows } = await db.query('SELECT * FROM quote_requests WHERE id = $1', [req.params.id]);
    res.json(await toRequestDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

// POST /quote-requests/:id/cancel
router.post('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const request = await getOwnedRequest(req.params.id, req.user.sub);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (!['draft', 'submitted'].includes(request.status)) {
      return res.status(409).json({ error: 'A request can only be cancelled before it has been quoted' });
    }
    await db.query(`UPDATE quote_requests SET status = 'cancelled' WHERE id = $1`, [req.params.id]);
    const { rows } = await db.query('SELECT * FROM quote_requests WHERE id = $1', [req.params.id]);
    res.json(await toRequestDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

// POST /quote-requests/:id/place-order  { cartId }
// Real, confirmed integration point: rather than a separate real
// order-creation path, this bulk-adds every real priced item
// (respecting whatever real quantity the buyer last edited it to) into
// the buyer's own real, already-existing cart -- the exact same real
// cart_items table and checkout flow every other real product already
// uses, so payment/shipping/supplier-split logic is never duplicated.
router.post('/:id/place-order', requireAuth, async (req, res, next) => {
  try {
    const { cartId } = req.body || {};
    if (!cartId) return res.status(400).json({ error: 'cartId is required' });
    const request = await getOwnedRequest(req.params.id, req.user.sub);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'quoted') return res.status(409).json({ error: 'Only a quoted request can be ordered' });
    if (request.expires_at && new Date(request.expires_at) < new Date()) {
      return res.status(409).json({ error: 'This quote has expired' });
    }

    const { rows: items } = await db.query(
      `SELECT qri.* FROM quote_request_items qri
       JOIN products p ON p.id = qri.product_id
       WHERE qri.request_id = $1 AND qri.status = 'priced' AND p.status = 'active'`,
      [req.params.id]
    );
    if (items.length === 0) return res.status(400).json({ error: 'No items are ready to order yet -- they may still be pending review' });

    await db.query('INSERT INTO carts (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [cartId]);
    for (const item of items) {
      await db.query(
        `INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)
         ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
        [cartId, item.product_id, item.quantity]
      );
    }
    await db.query(`UPDATE quote_requests SET status = 'ordered' WHERE id = $1`, [req.params.id]);
    const { rows } = await db.query('SELECT * FROM quote_requests WHERE id = $1', [req.params.id]);
    res.json(await toRequestDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Admin-facing
// ============================================================

// GET /quote-requests/admin/queue
router.get('/admin/queue', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT qr.*, u.name AS buyer_name, (SELECT COUNT(*) FROM quote_request_items qri WHERE qri.request_id = qr.id) AS item_count
       FROM quote_requests qr
       JOIN users u ON u.id = qr.buyer_id
       WHERE qr.status IN ('submitted', 'quoted', 'ordered')
       ORDER BY qr.submitted_at ASC NULLS LAST`
    );
    res.json(rows.map((r) => ({
      id: r.id,
      buyerName: r.buyer_name,
      status: r.status,
      itemCount: Number(r.item_count),
      submittedAt: r.submitted_at,
    })));
  } catch (err) {
    next(err);
  }
});

// GET /quote-requests/admin/:id
router.get('/admin/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM quote_requests WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Request not found' });
    res.json(await toRequestDto(rows[0], { includeAdminFields: true }));
  } catch (err) {
    next(err);
  }
});

// PATCH /quote-requests/admin/:id/items/:itemId  { draftPrice?, category?, part? }
router.patch('/admin/:id/items/:itemId', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { draftPrice, category, part } = req.body || {};
    const { rows: itemRows } = await db.query('SELECT * FROM quote_request_items WHERE id = $1 AND request_id = $2', [req.params.itemId, req.params.id]);
    if (itemRows.length === 0) return res.status(404).json({ error: 'Item not found' });
    if (itemRows[0].status === 'priced') return res.status(409).json({ error: 'This item is already part of a sent quote' });

    await db.query(
      `UPDATE quote_request_items SET
         draft_price = COALESCE($1, draft_price),
         draft_category = COALESCE($2, draft_category),
         draft_part = COALESCE($3, draft_part)
       WHERE id = $4`,
      [draftPrice ?? null, category?.trim() || null, part?.trim() || null, req.params.itemId]
    );
    const { rows: updated } = await db.query('SELECT * FROM quote_request_items WHERE id = $1', [req.params.itemId]);
    res.json(await toItemDto(updated[0], { includeAdminFields: true }));
  } catch (err) {
    next(err);
  }
});

// POST /quote-requests/admin/:id/items/:itemId/photos  { url }
router.post('/admin/:id/items/:itemId/photos', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { url } = req.body || {};
    if (!url || !url.trim()) return res.status(400).json({ error: 'url is required' });
    const { rows: itemRows } = await db.query('SELECT id FROM quote_request_items WHERE id = $1 AND request_id = $2', [req.params.itemId, req.params.id]);
    if (itemRows.length === 0) return res.status(404).json({ error: 'Item not found' });
    const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM quote_request_item_photos WHERE item_id = $1', [req.params.itemId]);
    await db.query('INSERT INTO quote_request_item_photos (item_id, url, sort_order) VALUES ($1, $2, $3)', [req.params.itemId, url.trim(), maxRows[0].max_order + 1]);
    const { rows: updated } = await db.query('SELECT * FROM quote_request_items WHERE id = $1', [req.params.itemId]);
    res.status(201).json(await toItemDto(updated[0], { includeAdminFields: true }));
  } catch (err) {
    next(err);
  }
});

// DELETE /quote-requests/admin/:id/items/:itemId/photos/:photoId
router.delete('/admin/:id/items/:itemId/photos/:photoId', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rowCount } = await db.query('DELETE FROM quote_request_item_photos WHERE id = $1 AND item_id = $2', [req.params.photoId, req.params.itemId]);
    if (rowCount === 0) return res.status(404).json({ error: 'Photo not found' });
    const { rows: updated } = await db.query('SELECT * FROM quote_request_items WHERE id = $1', [req.params.itemId]);
    res.json(await toItemDto(updated[0], { includeAdminFields: true }));
  } catch (err) {
    next(err);
  }
});

// POST /quote-requests/admin/:id/send-quote
// Real, confirmed finalization step: every real item that has both a
// real draft_price AND at least one real staged photo becomes a real
// live product entry under the real Leap Supplier account -- entering
// the exact same real moderation queue every other real supplier's
// submission goes through, never bypassing it. Every other item is
// marked genuinely unavailable for this real request.
router.post('/admin/:id/send-quote', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows: requestRows } = await db.query('SELECT * FROM quote_requests WHERE id = $1', [req.params.id]);
    if (requestRows.length === 0) return res.status(404).json({ error: 'Request not found' });
    const request = requestRows[0];
    if (request.status !== 'submitted') return res.status(409).json({ error: 'Only a submitted request can be quoted' });

    const { rows: items } = await db.query('SELECT * FROM quote_request_items WHERE request_id = $1', [req.params.id]);
    let pricedCount = 0;

    for (const item of items) {
      const { rows: photoRows } = await db.query('SELECT url FROM quote_request_item_photos WHERE item_id = $1 ORDER BY sort_order', [item.id]);
      const ready = item.draft_price != null && item.draft_category && photoRows.length > 0;
      if (!ready) {
        await db.query(`UPDATE quote_request_items SET status = 'unavailable' WHERE id = $1`, [item.id]);
        continue;
      }
      const productId = `p_qr_${item.id}`;
      await db.query(
        `INSERT INTO products (id, supplier_id, name, category, part, price, currency_code, stock_quantity, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'USD', $7, 'translating')`,
        [productId, LEAP_SUPPLIER_ID, item.name, item.draft_category, item.draft_part, item.draft_price, item.quantity]
      );
      let sortOrder = 0;
      for (const photo of photoRows) {
        await db.query('INSERT INTO product_images (product_id, url, sort_order) VALUES ($1, $2, $3)', [productId, photo.url, sortOrder++]);
      }
      await db.query(
        'INSERT INTO product_fitment_entries (product_id, generation_id, year) VALUES ($1, $2, $3)',
        [productId, request.generation_id, request.year]
      );
      await db.query(`UPDATE quote_request_items SET status = 'priced', product_id = $1 WHERE id = $2`, [productId, item.id]);
      pricedCount++;
    }

    await db.query(
      `UPDATE quote_requests SET status = 'quoted', quoted_at = now(), expires_at = now() + interval '${QUOTE_VALIDITY_DAYS} days' WHERE id = $1`,
      [req.params.id]
    );
    await logAdminAction(req, 'quote_request_sent', 'quote_request', req.params.id, { pricedCount, totalItems: items.length });

    const { rows: updated } = await db.query('SELECT * FROM quote_requests WHERE id = $1', [req.params.id]);
    res.json(await toRequestDto(updated[0], { includeAdminFields: true }));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
