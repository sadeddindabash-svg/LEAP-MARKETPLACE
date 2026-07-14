const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole } = require('../auth/middleware');

/**
 * Supplier module — SUP-001–003 (onboarding/verification) from the
 * supplier's own side; this is the ADMIN-facing view (ADM-001: review,
 * approve, reject supplier accounts).
 *
 * Admin-only: both routes require an authenticated admin. There is no
 * supplier-facing login/session yet (see the Supplier Portal prototype) —
 * this module only covers the platform-admin half of supplier management.
 */
const router = express.Router();

function toSupplierDto(row) {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    contactEmail: row.contact_email,
    verificationStatus: row.verification_status,
    listingCount: Number(row.listing_count) || 0,
    createdAt: row.created_at,
  };
}

// GET /supplier — admin only. Listing count is derived via a live join
// against products rather than stored, so it's never stale.
router.get('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT s.*, COUNT(p.id) AS listing_count
      FROM suppliers s
      LEFT JOIN products p ON p.supplier_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);
    res.json(rows.map(toSupplierDto));
  } catch (err) {
    next(err);
  }
});

// PATCH /supplier/:id/verify  { status: 'verified' | 'rejected' }
router.patch('/:id/verify', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ error: "status must be 'verified' or 'rejected'" });
    }
    const { rows } = await db.query(
      `UPDATE suppliers SET verification_status = $1 WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Supplier not found' });
    // Note: listingCount is intentionally omitted here (not re-joined) —
    // the client already has it from the list view and this response is
    // just confirming the status change, not a full record refresh.
    const { id, name, country, contact_email, verification_status, created_at } = rows[0];
    res.json({ id, name, country, contactEmail: contact_email, verificationStatus: verification_status, createdAt: created_at });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Supplier-facing endpoints (the actual Supplier Portal) — SUP-001–022.
// Everything below requires role='supplier' and scopes to req.user.supplierId
// (from the JWT — see auth/middleware.js signToken). A supplier can only
// ever see/modify their OWN products and order fulfillment, never another
// supplier's — enforced with a WHERE clause on every query below, not just
// a UI assumption.
// ============================================================

function toProductDto(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    currencyCode: row.currency_code,
    stockQuantity: row.stock_quantity,
    estimatedDeliveryDays: row.estimated_delivery_days,
    status: row.status,
    createdAt: row.created_at,
  };
}

// GET /supplier/me — own supplier profile.
router.get('/me', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM suppliers WHERE id = $1', [req.user.supplierId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Supplier not found' });
    res.json(toSupplierDto({ ...rows[0], listing_count: 0 }));
  } catch (err) {
    next(err);
  }
});

// GET /supplier/me/products — only this supplier's own products.
router.get('/me/products', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM products WHERE supplier_id = $1 ORDER BY created_at DESC', [req.user.supplierId]);
    res.json(rows.map(toProductDto));
  } catch (err) {
    next(err);
  }
});

// POST /supplier/me/products — manual add (SUP-010). New listings start
// as 'translating' (awaiting admin review, see catalog moderation-queue),
// NOT 'active' — a supplier cannot make their own product live to buyers
// without going through moderation first.
router.post('/me/products', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try {
    const { name, category, price, currencyCode, stockQuantity, estimatedDeliveryDays } = req.body || {};
    if (!name || !category || !price || !currencyCode) {
      return res.status(400).json({ error: 'name, category, price, and currencyCode are required' });
    }
    const id = `p_${Date.now()}`;
    await db.query(
      `INSERT INTO products (id, supplier_id, name, category, price, currency_code, stock_quantity, estimated_delivery_days, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'translating')`,
      [id, req.user.supplierId, name, category, price, currencyCode, stockQuantity || 0, estimatedDeliveryDays || 7]
    );
    const { rows } = await db.query('SELECT * FROM products WHERE id = $1', [id]);
    res.status(201).json(toProductDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

// PATCH /supplier/me/products/:id — edit price/stock. Ownership enforced
// via the WHERE clause (supplier_id = $N), not just a lookup-then-check —
// an UPDATE that matches zero rows because it belongs to someone else
// looks identical to "not found", which is the correct thing to leak here.
router.patch('/me/products/:id', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try {
    const { price, stockQuantity } = req.body || {};
    if (price === undefined && stockQuantity === undefined) {
      return res.status(400).json({ error: 'Provide at least one of: price, stockQuantity' });
    }
    const { rows } = await db.query(
      `UPDATE products SET
         price = COALESCE($1, price),
         stock_quantity = COALESCE($2, stock_quantity)
       WHERE id = $3 AND supplier_id = $4
       RETURNING *`,
      [price ?? null, stockQuantity ?? null, req.params.id, req.user.supplierId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(toProductDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

// GET /supplier/me/orders — this supplier's sub-orders only (SUP-020),
// with the buyer never exposed beyond what's needed to ship (no direct
// buyer contact — all communication routes through the Platform).
router.get('/me/orders', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try {
    const { rows: subOrders } = await db.query(
      `SELECT so.id, so.order_id, so.status, so.tracking_number, o.placed_at
       FROM supplier_sub_orders so JOIN orders o ON o.id = so.order_id
       WHERE so.supplier_id = $1
       ORDER BY o.placed_at DESC`,
      [req.user.supplierId]
    );

    const result = [];
    for (const so of subOrders) {
      const { rows: items } = await db.query(
        `SELECT oli.product_id, oli.quantity, oli.unit_price, p.name
         FROM order_line_items oli JOIN products p ON p.id = oli.product_id
         WHERE oli.sub_order_id = $1`,
        [so.id]
      );
      result.push({
        subOrderId: so.id,
        orderId: so.order_id,
        status: so.status,
        trackingNumber: so.tracking_number,
        placedAt: so.placed_at,
        items: items.map((i) => ({ productId: i.product_id, name: i.name, quantity: i.quantity, unitPrice: Number(i.unit_price) })),
      });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /supplier/me/orders/:subOrderId  { status?, trackingNumber? }
// (SUP-021/022: accept/prepare/ship + tracking). Ownership enforced the
// same way as the product PATCH above.
router.patch('/me/orders/:subOrderId', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try {
    const { status, trackingNumber } = req.body || {};
    if (status !== undefined && !['pending', 'preparing', 'shipped', 'delivered', 'dispute'].includes(status)) {
      return res.status(400).json({ error: "status must be one of: pending, preparing, shipped, delivered, dispute" });
    }
    if (status === undefined && trackingNumber === undefined) {
      return res.status(400).json({ error: 'Provide at least one of: status, trackingNumber' });
    }
    const { rows } = await db.query(
      `UPDATE supplier_sub_orders SET
         status = COALESCE($1, status),
         tracking_number = COALESCE($2, tracking_number)
       WHERE id = $3 AND supplier_id = $4
       RETURNING *`,
      [status ?? null, trackingNumber ?? null, req.params.subOrderId, req.user.supplierId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Sub-order not found' });
    res.json({ subOrderId: rows[0].id, orderId: rows[0].order_id, status: rows[0].status, trackingNumber: rows[0].tracking_number });
  } catch (err) {
    next(err);
  }
});

// GET /supplier/me/overview — real aggregate KPIs for this supplier's own
// dashboard landing page. Same honesty principle as the admin dashboard's
// GET /overview (see that module's header comment): NO fabricated ¥
// sales figure. The "settlement currency is RMB" business rule (see
// apps/supplier-portal/README.md) is about how a supplier gets PAID OUT
// once a payout system exists — it does not mean summing raw
// order_line_items amounts (which are in whatever currency the BUYER
// paid in, not RMB) and calling that a real RMB sales total. That would
// require both a payout/commission system and FX conversion, neither of
// which exist yet. Uses counts everywhere a currency amount would be
// fabricated. Also no fake star rating — there's no reviews/ratings
// system in this schema yet (see db/README.md's "not yet covered" list).
router.get('/me/overview', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try {
    const supplierId = req.user.supplierId;
    const [totalOrders, pendingOrders, totalListings, pendingReturns, ordersByDay, topProducts, recentOrders] = await Promise.all([
      db.query('SELECT COUNT(*) AS n FROM supplier_sub_orders WHERE supplier_id = $1', [supplierId]),
      db.query(`SELECT COUNT(*) AS n FROM supplier_sub_orders WHERE supplier_id = $1 AND status IN ('pending', 'preparing')`, [supplierId]),
      db.query('SELECT COUNT(*) AS n FROM products WHERE supplier_id = $1', [supplierId]),
      db.query(
        `SELECT COUNT(*) AS n FROM return_cases rc JOIN supplier_sub_orders so ON so.id = rc.sub_order_id
         WHERE so.supplier_id = $1 AND rc.status IN ('awaiting', 'in_progress')`,
        [supplierId]
      ),
      db.query(
        `SELECT date_trunc('day', o.placed_at) AS day, COUNT(*) AS n
         FROM supplier_sub_orders so JOIN orders o ON o.id = so.order_id
         WHERE so.supplier_id = $1 AND o.placed_at > now() - interval '7 days'
         GROUP BY day ORDER BY day ASC`,
        [supplierId]
      ),
      db.query(
        `SELECT p.id, p.name, SUM(oli.quantity) AS units
         FROM order_line_items oli
         JOIN supplier_sub_orders so ON so.id = oli.sub_order_id
         JOIN products p ON p.id = oli.product_id
         WHERE so.supplier_id = $1
         GROUP BY p.id, p.name ORDER BY units DESC LIMIT 4`,
        [supplierId]
      ),
      db.query(
        `SELECT so.id AS sub_order_id, so.order_id, so.status, o.placed_at
         FROM supplier_sub_orders so JOIN orders o ON o.id = so.order_id
         WHERE so.supplier_id = $1
         ORDER BY o.placed_at DESC LIMIT 5`,
        [supplierId]
      ),
    ]);

    res.json({
      totalOrders: Number(totalOrders.rows[0].n),
      pendingOrders: Number(pendingOrders.rows[0].n),
      totalListings: Number(totalListings.rows[0].n),
      pendingReturns: Number(pendingReturns.rows[0].n),
      ordersByDay: ordersByDay.rows.map((r) => ({ day: r.day, count: Number(r.n) })),
      topProducts: topProducts.rows.map((r) => ({ id: r.id, name: r.name, units: Number(r.units) })),
      recentOrders: recentOrders.rows.map((r) => ({ subOrderId: r.sub_order_id, orderId: r.order_id, status: r.status, placedAt: r.placed_at })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
