const express = require('express');
const db = require('../../../db/pool');
const { requireAuth } = require('../auth/middleware');
const { attachBuyerPrice } = require('../catalog/routes');

/**
 * Quote-requests module -- real "request a part we don't carry"
 * system, confirmed with the person through several rounds of design
 * discussion before building: a buyer picks a vehicle (the same real
 * fitment cascade used elsewhere) and lists up to 20 real parts they
 * need. Confirmed, corrected design: real Leap staff fulfil these
 * through the supplier portal's own existing full product submission
 * form, logged in as the real "Leap Supplier" account (migration
 * 067) -- the exact same real requirements (weight, dimensions, OEM
 * number, real CNY pricing, at least 3 real photos) apply here as to
 * any other real supplier, with zero shortcuts. That real product
 * then enters the exact same real moderation queue every other
 * supplier's submission already goes through. This module itself
 * only manages the request/item lifecycle -- the actual product
 * creation happens in the supplier module's own POST /me/products
 * (see its own real fulfillsRequestItemId parameter).
 */
const router = express.Router();

const MAX_ITEMS_PER_REQUEST = 20;
const QUOTE_VALIDITY_DAYS = 7;
const LEAP_SUPPLIER_ID = 'supplier_leap';

function isForeignKeyViolation(err) {
  return err && err.code === '23503';
}

async function toItemDto(row) {
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
    const { rows } = await db.query(
      'SELECT price, currency_code, status, weight_kg, length_cm, width_cm, height_cm, last_known_buyer_price_usd FROM products WHERE id = $1',
      [row.product_id]
    );
    if (rows.length > 0) {
      // Real, confirmed bug fix -- this used to expose the real
      // supplier's own raw RMB cost directly as if it were already a
      // real USD price (reported directly: "780 rmb ... shows the
      // buyer 780$"). Reuses the exact same real, already-built
      // pricing engine (markup fees + a real FX rate) every other
      // real product already goes through, rather than a duplicated
      // or approximated version of that real conversion.
      const priced = await attachBuyerPrice({}, rows[0]);
      dto.price = priced.price;
      dto.currencyCode = 'USD';
      dto.readyToOrder = rows[0].status === 'active';
    }
  }
  return dto;
}

async function toRequestDto(requestRow) {
  const { rows: items } = await db.query(
    'SELECT * FROM quote_request_items WHERE request_id = $1 ORDER BY sort_order ASC',
    [requestRow.id]
  );
  const itemDtos = await Promise.all(items.map((item) => toItemDto(item)));

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
  const client = await db.getPool().connect();
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

    await client.query('BEGIN');
    await client.query('INSERT INTO carts (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [cartId]);
    for (const item of items) {
      await client.query(
        `INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)
         ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
        [cartId, item.product_id, item.quantity]
      );
    }
    await client.query('COMMIT');
    const { rows } = await db.query('SELECT * FROM quote_requests WHERE id = $1', [req.params.id]);
    res.json(await toRequestDto(rows[0]));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

// Real, deliberate gate -- confirmed with the person: only the one
// real, shared "Leap Supplier" account (not any other real supplier)
// can see or act on part requests. A regular real supplier has no
// business here at all.
function requireLeapSupplier(req, res, next) {
  if (req.user.role !== 'supplier' || req.user.supplierId !== LEAP_SUPPLIER_ID) {
    return res.status(403).json({ error: 'Only the Leap Supplier account can access part requests' });
  }
  next();
}

// ============================================================
// Supplier-facing (Leap Supplier only)
// ============================================================

// GET /quote-requests/supplier/queue
router.get('/supplier/queue', requireAuth, requireLeapSupplier, async (req, res, next) => {
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

// GET /quote-requests/supplier/:id
router.get('/supplier/:id', requireAuth, requireLeapSupplier, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM quote_requests WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Request not found' });
    res.json(await toRequestDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

// POST /quote-requests/supplier/:id/send-quote
// Real, confirmed finalization step: unlike the earlier design, this
// no longer creates any real product itself -- staff already did
// that (or chose not to) via the supplier module's own full real
// product submission form, which links back to a real item's
// product_id/status itself on success (see
// supplier/routes.js's own fulfillsRequestItemId handling). This
// endpoint's only real job is marking whatever's still real
// unaddressed as unavailable and moving the real request itself into
// 'quoted'.
router.post('/supplier/:id/send-quote', requireAuth, requireLeapSupplier, async (req, res, next) => {
  try {
    const { rows: requestRows } = await db.query('SELECT * FROM quote_requests WHERE id = $1', [req.params.id]);
    if (requestRows.length === 0) return res.status(404).json({ error: 'Request not found' });
    if (requestRows[0].status !== 'submitted') return res.status(409).json({ error: 'Only a submitted request can be quoted' });

    await db.query(`UPDATE quote_request_items SET status = 'unavailable' WHERE request_id = $1 AND status = 'pending'`, [req.params.id]);
    await db.query(
      `UPDATE quote_requests SET status = 'quoted', quoted_at = now(), expires_at = now() + interval '${QUOTE_VALIDITY_DAYS} days' WHERE id = $1`,
      [req.params.id]
    );

    const { rows: updated } = await db.query('SELECT * FROM quote_requests WHERE id = $1', [req.params.id]);
    res.json(await toRequestDto(updated[0]));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
