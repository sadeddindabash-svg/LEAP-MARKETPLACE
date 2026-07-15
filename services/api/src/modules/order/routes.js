const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, optionalAuth } = require('../auth/middleware');
const { calculateBuyerPriceUsd } = require('../pricing/engine');

/**
 * Order module — BUY-031, BUY-050–053. A single buyer order splits into
 * per-supplier sub-orders; the buyer only ever sees one order and one total
 * (see docs/SRS.docx Section 3.1.4). Guest checkout is supported per the
 * product decision in the Charter.
 *
 * Backed by PostgreSQL. Order creation runs inside a single transaction —
 * either the whole order (all sub-orders, all line items) is created, or
 * none of it is, so a mid-request failure can't leave a half-created order.
 */
const router = express.Router();

async function nextOrderId(client) {
  // Simple sequential ID generator matching the existing 'LP-XXXXXX' style.
  // Uses a Postgres sequence so it's safe under concurrent requests, unlike
  // the in-memory counter this replaces.
  const { rows } = await client.query("SELECT nextval('order_id_seq') AS n");
  return `LP-${200000 + Number(rows[0].n)}`;
}

// POST /order  { items: [{productId, quantity}], userId?, guestEmail? }
router.post('/', async (req, res, next) => {
  const { items, userId, guestEmail } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items is required and must be non-empty' });
  }
  if (!userId && !guestEmail) {
    return res.status(400).json({ error: 'either userId or guestEmail is required (guest checkout)' });
  }

  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    // Look up real cost + supplier + shipping data per product from the
    // catalog, rather than trusting client-supplied prices (never trust
    // the client for amounts that determine what gets charged).
    const productIds = items.map((i) => i.productId);
    const { rows: products } = await client.query(
      `SELECT id, price, currency_code, supplier_id, weight_kg, length_cm, width_cm, height_cm FROM products WHERE id = ANY($1::text[])`,
      [productIds]
    );
    const productById = Object.fromEntries(products.map((p) => [p.id, p]));

    for (const item of items) {
      if (!productById[item.productId]) {
        throw Object.assign(new Error(`Unknown product: ${item.productId}`), { status: 400 });
      }
    }

    // THE lock-in moment: the real buyer-facing USD price is computed
    // HERE, right now, and that exact number is what gets written to
    // order_line_items.unit_price below — it is deliberately never
    // recalculated after this point, even if fees or the FX rate change
    // later. See migration 014's header comment and
    // services/api/src/modules/pricing/engine.js for the full design —
    // browsing/cart show a LIVE price that can change; a placed order's
    // price does not, the same way any real checkout works.
    const buyerUnitPrices = {};
    for (const productId of Object.keys(productById)) {
      const product = productById[productId];
      if (product.currency_code !== 'CNY') {
        // Legacy pre-pricing-engine product — pass through unchanged
        // (see the same handling in the catalog/cart modules for why).
        buyerUnitPrices[productId] = Number(product.price);
      } else {
        const result = await calculateBuyerPriceUsd({
          supplierCostCny: Number(product.price),
          weightKg: product.weight_kg === null ? null : Number(product.weight_kg),
          lengthCm: product.length_cm === null ? null : Number(product.length_cm),
          widthCm: product.width_cm === null ? null : Number(product.width_cm),
          heightCm: product.height_cm === null ? null : Number(product.height_cm),
        });
        buyerUnitPrices[productId] = result.buyerPriceUsd;
      }
    }

    const currencyCode = 'USD'; // confirmed: buyer-facing currency is always USD for now
    const total = items.reduce((sum, item) => sum + buyerUnitPrices[item.productId] * item.quantity, 0);

    const orderId = await nextOrderId(client);
    await client.query(
      `INSERT INTO orders (id, buyer_id, guest_email, status, total, currency_code) VALUES ($1, $2, $3, 'to_ship', $4, $5)`,
      [orderId, userId || null, guestEmail || null, total, currencyCode]
    );

    // Group items by supplier -> one supplier_sub_order per supplier.
    const bySupplier = {};
    for (const item of items) {
      const supplierId = productById[item.productId].supplier_id;
      (bySupplier[supplierId] ||= []).push(item);
    }

    const supplierSubOrders = [];
    for (const [supplierId, supplierItems] of Object.entries(bySupplier)) {
      const { rows: subOrderRows } = await client.query(
        `INSERT INTO supplier_sub_orders (order_id, supplier_id, status) VALUES ($1, $2, 'pending') RETURNING id`,
        [orderId, supplierId]
      );
      const subOrderId = subOrderRows[0].id;

      const lineItems = [];
      for (const item of supplierItems) {
        await client.query(
          `INSERT INTO order_line_items (sub_order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)`,
          [subOrderId, item.productId, item.quantity, buyerUnitPrices[item.productId]]
        );
        lineItems.push({ productId: item.productId, quantity: item.quantity });
      }
      supplierSubOrders.push({ subOrderId, supplierId, status: 'pending', items: lineItems });
    }

    await client.query('COMMIT');

    res.status(201).json({
      id: orderId,
      userId: userId || null,
      guestEmail: guestEmail || null,
      isGuestOrder: !userId,
      status: 'to_ship',
      total,
      currencyCode,
      supplierSubOrders,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  } finally {
    client.release();
  }
});

// GET /order/:id — GAP CLOSED (was previously fully open to anyone who
// guessed a sequential order ID). Access is now one of:
//   1. An admin (any order)
//   2. The order's own buyer, if logged in (order.buyer_id matches)
//   3. A guest, IF they supply the exact guestEmail the order was placed
//      with as a query param (?guestEmail=...) — a second factor beyond
//      just knowing/guessing the ID, matching the common "look up your
//      order by ID + email" pattern. This preserves the original
//      requirement (a guest-checkout buyer must be able to view their own
//      confirmation without an account) while closing the "anyone who
//      guesses LP-200901 sees a stranger's order" hole.
// Anyone else gets 404 (not 403) — same "don't confirm existence" pattern
// used elsewhere in this codebase (e.g. product-ownership checks).
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { rows: orderRows } = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (orderRows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = orderRows[0];

    const isAdmin = req.user && req.user.role === 'admin';
    const isOwningBuyer = req.user && order.buyer_id && req.user.sub === order.buyer_id;
    const guestEmailMatches = order.guest_email && req.query.guestEmail && req.query.guestEmail === order.guest_email;

    if (!isAdmin && !isOwningBuyer && !guestEmailMatches) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const { rows: subOrders } = await db.query(
      `SELECT so.id, so.supplier_id, so.status, so.tracking_number, so.hub_id, h.name AS hub_name, s.name AS supplier_name
       FROM supplier_sub_orders so
       LEFT JOIN suppliers s ON s.id = so.supplier_id
       LEFT JOIN hubs h ON h.id = so.hub_id
       WHERE so.order_id = $1`,
      [req.params.id]
    );

    const supplierSubOrders = [];
    for (const so of subOrders) {
      const { rows: items } = await db.query(
        `SELECT oli.product_id, oli.quantity, oli.unit_price, p.name
         FROM order_line_items oli JOIN products p ON p.id = oli.product_id
         WHERE oli.sub_order_id = $1`,
        [so.id]
      );

      // The hub's leg of the journey, if this sub-order has reached the
      // "shipped to hub" point yet — see migration 011's header comment
      // for why this is a genuinely separate leg from the supplier's own
      // status above, not the same thing.
      let hubShipment = null;
      const { rows: shipmentRows } = await db.query('SELECT * FROM hub_shipments WHERE sub_order_id = $1', [so.id]);
      if (shipmentRows.length > 0) {
        const shipment = shipmentRows[0];
        const { rows: events } = await db.query(
          `SELECT hse.*, u.email AS performed_by_email
           FROM hub_shipment_events hse LEFT JOIN users u ON u.id = hse.performed_by
           WHERE hse.shipment_id = $1 ORDER BY hse.created_at ASC`,
          [shipment.id]
        );
        const eventsWithPhotos = [];
        for (const e of events) {
          const { rows: photos } = await db.query('SELECT url FROM hub_shipment_photos WHERE event_id = $1 ORDER BY sort_order', [e.id]);
          eventsWithPhotos.push({
            step: e.step, notes: e.notes, trackingNumber: e.tracking_number,
            performedBy: e.performed_by_email, createdAt: e.created_at,
            photos: photos.map((p) => p.url),
          });
        }
        hubShipment = { id: shipment.id, status: shipment.status, updatedAt: shipment.updated_at, events: eventsWithPhotos };
      }

      supplierSubOrders.push({
        subOrderId: so.id,
        supplierId: so.supplier_id,
        supplierName: so.supplier_name,
        status: so.status,
        trackingNumber: so.tracking_number,
        hubId: so.hub_id,
        hubName: so.hub_name,
        hubShipment,
        items: items.map((i) => ({ productId: i.product_id, name: i.name, quantity: i.quantity, unitPrice: Number(i.unit_price) })),
      });
    }

    res.json({
      id: order.id,
      userId: order.buyer_id,
      guestEmail: order.guest_email,
      isGuestOrder: !order.buyer_id,
      status: order.status,
      total: Number(order.total),
      currencyCode: order.currency_code,
      placedAt: order.placed_at,
      supplierSubOrders,
    });
  } catch (err) {
    next(err);
  }
});

// GET /order — buyers see only their own orders; admins see all.
// This previously returned every order in the system to anyone who called
// it (including guest emails) — fixed as part of adding real auth.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const { rows } = isAdmin
      ? await db.query('SELECT * FROM orders ORDER BY placed_at DESC')
      : await db.query('SELECT * FROM orders WHERE buyer_id = $1 ORDER BY placed_at DESC', [req.user.sub]);
    res.json(rows.map((o) => ({
      id: o.id,
      userId: o.buyer_id,
      guestEmail: o.guest_email,
      status: o.status,
      total: Number(o.total),
      currencyCode: o.currency_code,
      placedAt: o.placed_at,
    })));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
