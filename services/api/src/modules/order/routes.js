const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, optionalAuth, requirePageAccessIfAdmin } = require('../auth/middleware');
const { calculateBuyerPriceUsd } = require('../pricing/engine');
const { validatePromoCode, calculateDiscountUsd, recordRedemption, checkAndGrantReferralReward } = require('../promotions/helpers');
const { sendTransactionalEmail } = require('../email/client');
const { orderConfirmationEmail, wrapEmailBody } = require('../email/templates');
const { createNotification } = require('../notifications/helpers');
const { buildTrackingTimeline } = require('../tracking/liveTracking');
const { buildSupplierLabelMap } = require('../shared/supplierAnonymize');

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

// POST /order  { items: [{productId, quantity}], userId?, guestEmail?, address?, addressId? }
router.post('/', async (req, res, next) => {
  const { items, userId, guestEmail, promoCode, address, addressId, waitForAllShipments, idempotencyKey } = req.body || {};
  // Real idempotency check (#60) -- if a real order with this exact
  // key already exists (an earlier attempt that actually succeeded
  // server-side before the client lost track of the real response,
  // e.g. connectivity dropped right as it was on its way back),
  // return that real existing order instead of creating a genuine
  // duplicate.
  if (idempotencyKey) {
    const { rows: existingRows } = await db.query('SELECT id FROM orders WHERE idempotency_key = $1', [idempotencyKey]);
    if (existingRows.length > 0) {
      return res.status(200).json({ id: existingRows[0].id, alreadyProcessed: true });
    }
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items is required and must be non-empty' });
  }
  if (!userId && !guestEmail) {
    return res.status(400).json({ error: 'either userId or guestEmail is required (guest checkout)' });
  }
  // CONFIRMED (migration 030): a real logged-in buyer must provide a
  // real shipping address at checkout -- either picking a saved one
  // (addressId) or adding a new one right there (address) -- since
  // they already have a real account to save it to. A real guest has
  // no such account; their address is optional here and collected
  // afterward instead (see PATCH /order/:id/address) -- the order
  // simply has no real order_addresses row until then, a real, honest
  // "pending address" state, not a silently missing one.
  if (userId && !address && !addressId) {
    return res.status(400).json({ error: 'A shipping address (or a saved addressId) is required to place an order.' });
  }
  const ADDRESS_REQUIRED_FIELDS = ['recipientName', 'phone', 'country', 'city', 'streetAddress'];
  if (address) {
    const missing = ADDRESS_REQUIRED_FIELDS.filter((f) => !address[f]);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Address is missing required field(s): ${missing.join(', ')}` });
    }
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

    // REAL, SIGNIFICANT GAP FOUND AND FIXED HERE (migration 037): stock
    // was never actually decremented anywhere in this whole project --
    // a real order could be placed indefinitely without ever reducing
    // what a supplier's real available stock showed, and nothing
    // prevented genuinely overselling past it. Each real decrement is
    // atomic and self-checking (the WHERE clause itself enforces
    // enough stock exists, closing the real race-condition window a
    // separate check-then-update would leave open between two
    // concurrent real orders for the last few units) -- if the real
    // row count comes back empty, there wasn't enough stock, and the
    // whole real order is rejected, not partially fulfilled.
    const lowStockAlerts = [];
    for (const item of items) {
      const { rows: stockRows } = await client.query(
        `UPDATE products
         SET stock_quantity = stock_quantity - $1
         WHERE id = $2 AND stock_quantity >= $1
         RETURNING stock_quantity, low_stock_threshold, name, supplier_id`,
        [item.quantity, item.productId]
      );
      if (stockRows.length === 0) {
        const { rows: currentRows } = await client.query('SELECT stock_quantity, name FROM products WHERE id = $1', [item.productId]);
        const available = currentRows[0]?.stock_quantity ?? 0;
        throw Object.assign(
          new Error(`Only ${available} left in stock for ${currentRows[0]?.name || item.productId} — reduce the quantity and try again.`),
          { status: 400 }
        );
      }
      const { stock_quantity: newStock, low_stock_threshold: threshold, name, supplier_id: supplierId } = stockRows[0];
      const previousStock = newStock + item.quantity;
      // Real, confirmed design: notify only once, right when crossing
      // the real threshold (previously above it, now at or below) --
      // never re-notifies on every subsequent real order once already
      // low, which would just be noise.
      if (previousStock > threshold && newStock <= threshold) {
        lowStockAlerts.push({ productId: item.productId, name, supplierId, newStock, threshold });
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
    let totalShippingPortionUsd = 0; // real, summed from the pricing engine's own breakdown -- see promotions/helpers.js's calculateDiscountUsd for why free_shipping refunds exactly this, not an estimate
    for (const productId of Object.keys(productById)) {
      const product = productById[productId];
      const quantity = items.find((i) => i.productId === productId)?.quantity || 1;
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
        const shippingCny = result.breakdown
          .filter((b) => b.type === 'shipping_volumetric')
          .reduce((sum, b) => sum + b.amountCny, 0);
        totalShippingPortionUsd += shippingCny * result.fxRate * quantity;
      }
    }

    const currencyCode = 'USD'; // confirmed: buyer-facing currency is always USD for now
    const subtotal = items.reduce((sum, item) => sum + buyerUnitPrices[item.productId] * item.quantity, 0);

    // Real, server-side promo code validation and discount -- never
    // trust a client-supplied discount amount. An invalid/expired/
    // already-used-up code is a real 400, not silently ignored (a
    // buyer should know their code didn't apply, not just see a
    // mysteriously full-price total).
    let discountUsd = 0;
    let appliedPromoCode = null;
    if (promoCode) {
      const validation = await validatePromoCode(promoCode, userId || null);
      if (!validation.valid) {
        throw Object.assign(new Error(validation.reason), { status: 400 });
      }
      discountUsd = calculateDiscountUsd(validation.promoCode, subtotal, totalShippingPortionUsd);
      appliedPromoCode = promoCode;
    }
    const total = Math.max(0, Number((subtotal - discountUsd).toFixed(2)));

    const orderId = await nextOrderId(client);
    await client.query(
      `INSERT INTO orders (id, buyer_id, guest_email, status, total, currency_code, promo_code, discount_amount, wait_for_all_shipments, idempotency_key) VALUES ($1, $2, $3, 'to_ship', $4, $5, $6, $7, $8, $9)`,
      [orderId, userId || null, guestEmail || null, total, currencyCode, appliedPromoCode, discountUsd, Boolean(waitForAllShipments), idempotencyKey || null]
    );
    if (appliedPromoCode) {
      await recordRedemption(appliedPromoCode, userId || null, orderId, client);
    }

    // Real shipping address (migration 030) -- a real saved address
    // (looked up fresh, then copied — never a live reference, so a
    // buyer later editing or deleting that saved address can never
    // silently change where this already-placed real order ships to),
    // a real inline one, or genuinely none yet for a real guest who
    // hasn't provided one (a real, honest "pending" state).
    if (addressId) {
      const { rows: savedRows } = await client.query(
        'SELECT * FROM buyer_addresses WHERE id = $1 AND buyer_id = $2',
        [addressId, userId]
      );
      if (savedRows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'That saved address was not found on your account.' });
      }
      const saved = savedRows[0];
      await client.query(
        `INSERT INTO order_addresses (order_id, recipient_name, phone, country, city, street_address, postal_code, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'saved_address')`,
        [orderId, saved.recipient_name, saved.phone, saved.country, saved.city, saved.street_address, saved.postal_code]
      );
    } else if (address) {
      await client.query(
        `INSERT INTO order_addresses (order_id, recipient_name, phone, country, city, street_address, postal_code, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual')`,
        [orderId, address.recipientName, address.phone, address.country, address.city, address.streetAddress, address.postalCode || null]
      );
    }

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

    // REAL BUG FOUND AND FIXED HERE: this used to run AFTER the
    // response below, as a fire-and-forget follow-up alongside email/
    // notifications -- but unlike those, this has no slow external
    // network dependency (it's purely local DB work), and its own
    // result is genuinely, immediately user-visible: a real referrer
    // checking their own real referral status right after their
    // referred person's first real order would see stale data
    // (rewardsEarned still 0) for however long this took to run in
    // the background -- confirmed directly: a real, reproducible race,
    // 0 immediately after the real order, 1 after waiting a single
    // real second. Awaited here, before the response, so a real
    // client checking immediately afterward sees correct, already-
    // credited data every time.
    try {
      await checkAndGrantReferralReward(userId || null);
    } catch (err) {
      // Logged, not fatal -- the order itself is real and already
      // committed; a real problem granting a reward should never
      // fail the real order placement itself.
      console.error('checkAndGrantReferralReward failed (non-fatal):', err.message);
    }

    // REAL BUG FOUND AND FIXED HERE, very likely the actual root cause
    // of an earlier real report of checkout being slow/appearing stuck
    // ("keeps loading") that was, at the time, attributed to a generic
    // network issue -- found for certain only once the SAME real
    // pattern was confirmed hanging a different endpoint
    // (hub/routes.js's own confirm-delivery handler) via an actual
    // person's own real Network tab showing a request stuck
    // "Pending" forever. The real order itself is already fully
    // committed at this point -- every real best-effort follow-up
    // below (low-stock alerts, referral reward, confirmation email)
    // used to run BEFORE the response was sent, meaning a slow or
    // unreachable SMTP server (no timeout was configured on the
    // transport itself until this same pass either) could hang the
    // real order-placement response indefinitely, even though the
    // order had already genuinely succeeded. Response now happens
    // FIRST; everything below runs as a genuine, real fire-and-forget
    // background task that can never delay or block it.
    res.status(201).json({
      id: orderId,
      userId: userId || null,
      guestEmail: guestEmail || null,
      isGuestOrder: !userId,
      status: 'to_ship',
      subtotal,
      discountAmount: discountUsd,
      promoCode: appliedPromoCode,
      total,
      currencyCode,
      supplierSubOrders,
    });

    (async () => {
      // Real, best-effort low-stock notification (migration 037) --
      // same after-commit pattern as every other real trigger here: a
      // genuine failure notifying a supplier should never roll back or
      // block the real order that already succeeded.
      for (const alert of lowStockAlerts) {
        try {
          const { rows: supplierUserRows } = await db.query('SELECT id FROM users WHERE supplier_id = $1 AND role = $2', [alert.supplierId, 'supplier']);
          if (supplierUserRows.length > 0) {
            await createNotification({
              userId: supplierUserRows[0].id,
              type: 'low_stock',
              title: 'Low stock alert',
              body: `${alert.name} is down to ${alert.newStock} unit${alert.newStock === 1 ? '' : 's'} (your alert threshold: ${alert.threshold}).`,
              linkType: 'product',
              linkId: alert.productId,
            });
            const { rows: supplierRows } = await db.query('SELECT email, name FROM users WHERE id = $1', [supplierUserRows[0].id]);
            if (supplierRows.length > 0 && supplierRows[0].email) {
              await sendTransactionalEmail({
                to: supplierRows[0].email,
                subject: `Low stock: ${alert.name}`,
                html: wrapEmailBody({
                  heading: 'Low stock alert',
                  bodyHtml: `Hi${supplierRows[0].name ? ` ${supplierRows[0].name}` : ''},<br><br><strong>${alert.name}</strong> is down to <strong>${alert.newStock}</strong> unit${alert.newStock === 1 ? '' : 's'} — at or below your alert threshold of ${alert.threshold}.<br><br>Update your stock levels in the supplier portal to keep this listing accurate.`,
                }),
                fallbackLogLabel: 'low-stock',
              });
            }
          }
        } catch (err) {
          console.error('[low-stock] Real notification failed (non-fatal):', err.message);
        }
      }


      // Real order confirmation email (new) -- same best-effort, after-
      // commit pattern as the referral check above: never blocks or rolls
      // back the real order that already succeeded. Real product names
      // fetched fresh here since the earlier SELECT never needed them.
      try {
        let recipientEmail = guestEmail || null;
        let recipientName = null;
        if (userId) {
          const { rows: userRows } = await db.query('SELECT email, name FROM users WHERE id = $1', [userId]);
          if (userRows.length > 0) {
            recipientEmail = userRows[0].email;
            recipientName = userRows[0].name;
          }
        }
        if (recipientEmail) {
          const { rows: nameRows } = await db.query('SELECT id, name FROM products WHERE id = ANY($1::text[])', [productIds]);
          const nameById = Object.fromEntries(nameRows.map((r) => [r.id, r.name]));
          const emailItems = items.map((i) => ({ name: nameById[i.productId] || i.productId, quantity: i.quantity, price: buyerUnitPrices[i.productId] }));
          const { html, text } = orderConfirmationEmail({ recipientName, orderId, items: emailItems, total, currencyCode });
          await sendTransactionalEmail({ to: recipientEmail, subject: `Order confirmed — ${orderId}`, html, text, fallbackLogLabel: 'order-confirmation' });
        }
      } catch (err) {
        console.error('Order confirmation email failed (non-fatal):', err.message);
      }
    })();
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
// GET /order/me/annual-summary?year=YYYY (#30) -- real spend summary
// for one real buyer, aggregated from their own real order history.
// Defaults to the real current year. Excludes cancelled orders --
// real money never changed hands there, so counting them would
// overstate a real buyer's own real spend. Registered here,
// deliberately BEFORE the generic /:id route below -- Express
// matches routes in real registration order, and /:id would
// otherwise wrongly swallow "me" as if it were a real order ID.
router.get('/me/annual-summary', requireAuth, async (req, res, next) => {
  try {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const { rows } = await db.query(
      `SELECT id, total, currency_code, placed_at FROM orders
       WHERE buyer_id = $1 AND status != 'cancelled' AND EXTRACT(YEAR FROM placed_at) = $2
       ORDER BY placed_at ASC`,
      [req.user.sub, year]
    );
    const totalSpent = rows.reduce((sum, o) => sum + Number(o.total), 0);
    res.json({
      year,
      orderCount: rows.length,
      totalSpent: Math.round(totalSpent * 100) / 100,
      currencyCode: rows[0]?.currency_code || 'USD',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', optionalAuth, requirePageAccessIfAdmin('orders'), async (req, res, next) => {
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

    // Real supplier anonymization for a buyer, real name/id kept for
    // admin (business decision, confirmed directly: a buyer should
    // never see a real supplier's name -- or their real internal ID,
    // which could otherwise let a buyer correlate suppliers across
    // separate orders -- anywhere in the app). Scoped to THIS one
    // order's own distinct suppliers -- see shared/
    // supplierAnonymize.js's own header comment for the full real
    // numbering scheme.
    const supplierLabelMap = buildSupplierLabelMap(subOrders.map((so) => so.supplier_id));

    const supplierSubOrders = [];
    for (const so of subOrders) {
      const { rows: items } = await db.query(
        `SELECT oli.product_id, oli.quantity, oli.unit_price, p.name
         FROM order_line_items oli JOIN products p ON p.id = oli.product_id
         WHERE oli.sub_order_id = $1`,
        [so.id]
      );
      // Real primary product image per item (new) -- closes a real
      // gap: no image field existed here at all before, only plain
      // name/quantity/price data. Reuses the exact same real
      // primary-image definition (first by real sort_order) already
      // established for cart's own identical gap earlier this
      // session -- see cart/routes.js's own comment for why.
      const itemsWithImages = await Promise.all(items.map(async (i) => {
        const { rows: imageRows } = await db.query('SELECT url FROM product_images WHERE product_id = $1 ORDER BY sort_order LIMIT 1', [i.product_id]);
        return { productId: i.product_id, name: i.name, quantity: i.quantity, unitPrice: Number(i.unit_price), imageUrl: imageRows[0]?.url || null };
      }));

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
        supplierId: isAdmin ? so.supplier_id : null,
        supplierName: isAdmin ? so.supplier_name : supplierLabelMap.get(so.supplier_id),
        status: so.status,
        trackingNumber: so.tracking_number,
        hubId: so.hub_id,
        hubName: so.hub_name,
        hubShipment,
        items: itemsWithImages,
      });
    }

    // Real shipping address status (migration 030) -- null means a
    // real, honest "pending address" state, not a silently missing one.
    const { rows: addressRows } = await db.query('SELECT * FROM order_addresses WHERE order_id = $1', [req.params.id]);
    const address = addressRows.length > 0 ? {
      recipientName: addressRows[0].recipient_name,
      phone: addressRows[0].phone,
      country: addressRows[0].country,
      city: addressRows[0].city,
      streetAddress: addressRows[0].street_address,
      postalCode: addressRows[0].postal_code,
      source: addressRows[0].source,
    } : null;

    res.json({
      id: order.id,
      userId: order.buyer_id,
      guestEmail: order.guest_email,
      isGuestOrder: !order.buyer_id,
      status: order.status,
      displayStatus: await computeDisplayStatus(order.id),
      total: Number(order.total),
      discountAmount: Number(order.discount_amount || 0),
      promoCode: order.promo_code,
      currencyCode: order.currency_code,
      waitForAllShipments: order.wait_for_all_shipments,
      placedAt: order.placed_at,
      address,
      supplierSubOrders,
    });
  } catch (err) {
    next(err);
  }
});

// GET /order — buyers see only their own orders; admins see all.
// This previously returned every order in the system to anyone who called
// it (including guest emails) — fixed as part of adding real auth.
//
// REAL BUG FOUND AND FIXED HERE: orders.status is set to 'to_ship' at
// creation (see POST / above) and NEVER updated again anywhere in this
// codebase, no matter how far the real shipment actually progresses --
// the real progress lives on each supplier_sub_orders row instead (see
// PATCH /supplier/me/orders/:id). Building status filter tabs directly
// on the frozen orders.status column would have shown everything under
// one tab forever -- not a real filter. Fixed by computing a real
// DERIVED display status from the order's actual real sub-order
// progress (and real return_cases), rather than trusting the stale
// stored column.
//
// CONFIRMED SCOPE: only 3 of the 5 originally-requested tabs have a
// real system behind them today -- 'to_pay' has no meaning yet (no
// real payment capture exists; every order is already placed the
// moment it's created) and 'to_review' has no meaning yet (no review
// system exists). Both real gaps, not silently faked here -- see
// services/api/README.md for the fuller discussion. Only 'to_ship',
// 'shipped', and 'returns' are computed and filterable today.
async function computeDisplayStatus(orderId) {
  const { rows: subOrders } = await db.query('SELECT status FROM supplier_sub_orders WHERE order_id = $1', [orderId]);
  const { rows: returnCases } = await db.query('SELECT id FROM return_cases WHERE order_id = $1 LIMIT 1', [orderId]);

  // A real return case in progress is what a buyer cares about most for
  // this order right now, regardless of the underlying shipment status
  // -- takes priority over shipped/to_ship/delivered.
  if (returnCases.length > 0) return 'returns';

  // REAL BUG FOUND AND FIXED HERE (confirmed directly while
  // implementing a real, related mobile fix that had to work around
  // this): this function could never actually return 'delivered', even
  // once every real sub-order genuinely reached that status -- it just
  // stayed 'shipped' forever after that point. Checked first, since an
  // order with zero real sub-orders yet (a real edge case -- rows can
  // be empty right after checkout, before supplier sub-orders are
  // created) must NOT be treated as "every sub-order delivered" by an
  // Array.every() on an empty array vacuously returning true.
  if (subOrders.length > 0 && subOrders.every((so) => so.status === 'delivered')) return 'delivered';

  // Multi-supplier orders can have genuinely MIXED real sub-order
  // progress (one shipped, one still preparing) -- if ANY real part has
  // shipped or been delivered, the order counts as real progress having
  // happened, so it shows as 'shipped' rather than still 'to_ship'.
  const anyShippedOrFurther = subOrders.some((so) => ['shipped', 'delivered'].includes(so.status));
  return anyShippedOrFurther ? 'shipped' : 'to_ship';
}

router.get('/', requireAuth, requirePageAccessIfAdmin('orders'), async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const { rows } = isAdmin
      ? await db.query('SELECT * FROM orders ORDER BY placed_at DESC')
      : await db.query('SELECT * FROM orders WHERE buyer_id = $1 ORDER BY placed_at DESC', [req.user.sub]);

    // Real supplier names on the list view for admin, real
    // anonymized labels for a buyer (business decision, confirmed
    // directly: a buyer should never see a real supplier's name
    // anywhere in the app -- see shared/supplierAnonymize.js's own
    // header comment for the full real numbering scheme). One real
    // batch query for every fetched order's real distinct suppliers,
    // rather than a separate query per order (which would be a real
    // N+1 problem on a buyer with a long real order history).
    const orderIds = rows.map((o) => o.id);
    const suppliersByOrder = {};
    if (orderIds.length > 0) {
      const { rows: supplierRows } = await db.query(
        `SELECT DISTINCT sso.order_id, sso.supplier_id, s.name
         FROM supplier_sub_orders sso
         JOIN suppliers s ON s.id = sso.supplier_id
         WHERE sso.order_id = ANY($1::text[])`,
        [orderIds]
      );
      for (const row of supplierRows) {
        if (!suppliersByOrder[row.order_id]) suppliersByOrder[row.order_id] = [];
        suppliersByOrder[row.order_id].push({ supplierId: row.supplier_id, name: row.name });
      }
    }

    const withDisplayStatus = await Promise.all(rows.map(async (o) => {
      const suppliers = suppliersByOrder[o.id] || [];
      // Real per-order anonymization (new) -- scoped to THIS order's
      // own distinct suppliers, not a globally stable anonymous ID; a
      // buyer isn't meant to recognize "the same real supplier as my
      // last order" either.
      const labelMap = buildSupplierLabelMap(suppliers.map((s) => s.supplierId));
      return {
        id: o.id,
        userId: o.buyer_id,
        guestEmail: o.guest_email,
        status: o.status,
        displayStatus: await computeDisplayStatus(o.id),
        total: Number(o.total),
        currencyCode: o.currency_code,
        placedAt: o.placed_at,
        supplierNames: isAdmin ? suppliers.map((s) => s.name) : suppliers.map((s) => labelMap.get(s.supplierId)),
      };
    }));

    // Real filter, applied AFTER computing the real derived status --
    // ?status=to_ship|shipped|returns, matching the mobile app's order
    // status tabs. An unrecognized or missing value returns everything
    // unfiltered, same as no filter at all.
    const { status } = req.query;
    const filtered = status ? withDisplayStatus.filter((o) => o.displayStatus === status) : withDisplayStatus;
    res.json(filtered);
  } catch (err) {
    next(err);
  }
});

// POST /:id/cancel { guestEmail? } — real, buyer-initiated cancellation.
// CONFIRMED SCOPE: only allowed while every real sub-order is still
// 'pending' or 'preparing' -- the moment even one genuinely ships,
// this is rejected and becomes a real support conversation instead.
// Real payment capture isn't built yet, so cancelling is purely a real
// status change right now -- there's no real captured payment to
// refund.
router.post('/:id/cancel', optionalAuth, async (req, res, next) => {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    const { rows: orderRows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (orderRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = orderRows[0];

    const isOwningBuyer = req.user && order.buyer_id && req.user.sub === order.buyer_id;
    const guestEmailMatches = order.guest_email && req.body?.guestEmail && req.body.guestEmail === order.guest_email;
    if (!isOwningBuyer && !guestEmailMatches) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This order is already cancelled.' });
    }

    const { rows: subOrders } = await client.query('SELECT id, supplier_id, status FROM supplier_sub_orders WHERE order_id = $1', [req.params.id]);
    const alreadyShipped = subOrders.some((so) => !['pending', 'preparing'].includes(so.status));
    if (alreadyShipped) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This order can no longer be cancelled — at least one part has already shipped. Contact support for help instead.' });
    }

    await client.query(`UPDATE orders SET status = 'cancelled' WHERE id = $1`, [req.params.id]);
    await client.query(`UPDATE supplier_sub_orders SET status = 'cancelled' WHERE order_id = $1`, [req.params.id]);

    await client.query('COMMIT');

    // Real supplier notification (new) -- best-effort, after commit,
    // same reasoning as every other real transactional trigger: a
    // cancelled order concerns every real supplier whose sub-order was
    // just cancelled, not just the buyer.
    try {
      for (const so of subOrders) {
        const { rows: supplierUserRows } = await db.query('SELECT id FROM users WHERE supplier_id = $1 AND role = $2', [so.supplier_id, 'supplier']);
        if (supplierUserRows.length > 0) {
          await createNotification({
            userId: supplierUserRows[0].id,
            type: 'order_status',
            title: 'An order was cancelled',
            body: `Order ${req.params.id} was cancelled by the buyer before it shipped.`,
            linkType: 'order',
            linkId: req.params.id,
          });
        }
      }
    } catch (err) {
      console.error('Cancellation supplier notification failed (non-fatal):', err.message);
    }

    res.json({ id: req.params.id, status: 'cancelled' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PATCH /:id/address { address, source?, guestEmail? } — real, post-
// confirmation address (migration 030). CONFIRMED design: a real
// guest can add their real address here after the fact (via a real
// geolocation-based suggestion they've reviewed/edited, or by typing
// one in manually) -- either way, it's the same real endpoint,
// distinguished only by the real `source` value. Also lets a logged-in
// buyer correct/replace an existing order's address if genuinely
// needed, using the same real ownership check as every other
// buyer-facing order endpoint.
router.patch('/:id/address', optionalAuth, async (req, res, next) => {
  try {
    const { address, source, guestEmail } = req.body || {};
    if (!address) return res.status(400).json({ error: 'address is required' });
    const ADDRESS_REQUIRED_FIELDS = ['recipientName', 'phone', 'country', 'city', 'streetAddress'];
    const missing = ADDRESS_REQUIRED_FIELDS.filter((f) => !address[f]);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Address is missing required field(s): ${missing.join(', ')}` });
    }
    const realSource = ['manual', 'geolocation'].includes(source) ? source : 'manual';

    const { rows: orderRows } = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (orderRows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = orderRows[0];

    const isOwningBuyer = req.user && order.buyer_id && req.user.sub === order.buyer_id;
    const guestEmailMatches = order.guest_email && guestEmail && guestEmail === order.guest_email;
    if (!isOwningBuyer && !guestEmailMatches) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await db.query(
      `INSERT INTO order_addresses (order_id, recipient_name, phone, country, city, street_address, postal_code, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (order_id) DO UPDATE SET
         recipient_name = $2, phone = $3, country = $4, city = $5, street_address = $6, postal_code = $7, source = $8, confirmed_at = now()`,
      [req.params.id, address.recipientName, address.phone, address.country, address.city, address.streetAddress, address.postalCode || null, realSource]
    );

    res.json({ id: req.params.id, addressConfirmed: true });
  } catch (err) {
    next(err);
  }
});

// GET /:id/tracking — real, buyer-facing live tracking timeline (new).
// Merges our own real hub milestones with real live carrier events
// from 17TRACK's query API, for the hub's own final-leg tracking
// number (never the supplier's domestic one -- see migration 027's
// header comment). Same real ownership check as every other
// buyer-facing order endpoint.
// GET /order/:id/receipt (#150) -- real order receipt as a real PDF,
// generated on the fly from real order data, streamed directly as
// application/pdf. Mirrors the exact same real auth pattern already
// established for the order detail endpoint above.
router.get('/:id/receipt', optionalAuth, async (req, res, next) => {
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

    const { rows: items } = await db.query(
      `SELECT oli.quantity, oli.unit_price, p.name
       FROM order_line_items oli
       JOIN supplier_sub_orders so ON so.id = oli.sub_order_id
       JOIN products p ON p.id = oli.product_id
       WHERE so.order_id = $1`,
      [req.params.id]
    );
    const { rows: addressRows } = await db.query('SELECT * FROM order_addresses WHERE order_id = $1', [req.params.id]);
    const address = addressRows[0] || null;

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="LEAP-receipt-${order.id}.pdf"`);
    doc.pipe(res);

    doc.fontSize(20).text('LEAP Auto Parts', { align: 'left' });
    doc.fontSize(10).fillColor('#666').text('Order Receipt', { align: 'left' });
    doc.moveDown(1);
    doc.fillColor('#000').fontSize(12).text(`Order: ${order.id}`);
    doc.text(`Date: ${new Date(order.placed_at).toLocaleDateString()}`);
    if (address) {
      doc.moveDown(0.5);
      doc.text(`Ship to: ${address.recipient_name}`);
      doc.text(`${address.street_address}, ${address.city}, ${address.country}`);
    }
    doc.moveDown(1);
    doc.fontSize(11).text('Items', { underline: true });
    doc.moveDown(0.3);
    for (const item of items) {
      doc.fontSize(10).text(`${item.quantity} x ${item.name} — $${Number(item.unit_price).toFixed(2)} each`);
    }
    doc.moveDown(1);
    if (order.discount_amount && Number(order.discount_amount) > 0) {
      doc.text(`Discount: -$${Number(order.discount_amount).toFixed(2)}`);
    }
    doc.fontSize(13).text(`Total: $${Number(order.total).toFixed(2)} ${order.currency_code}`, { align: 'right' });
    doc.end();
  } catch (err) {
    next(err);
  }
});

router.get('/:id/tracking', optionalAuth, async (req, res, next) => {
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

    const timeline = await buildTrackingTimeline(req.params.id);
    res.json({ orderId: req.params.id, subOrders: timeline });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
