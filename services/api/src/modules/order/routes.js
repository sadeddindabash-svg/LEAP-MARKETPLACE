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
const { STATUS_ORDER } = require('../shared/hubStatusOrder');
const ArabicReshaper = require('arabic-reshaper');
const bidiFactory = require('bidi-js');
const bidi = bidiFactory();

/**
 * Real, shapes Arabic text for correct rendering in a real PDF via
 * PDFKit -- confirmed necessary and correct via direct real visual
 * testing (rendered to real images and inspected) before being wired
 * in here, not assumed to just work. PDFKit does not perform Arabic
 * contextual letter-shaping (cursive joining) or the real Unicode
 * bidirectional algorithm on its own at all -- without this, real
 * Arabic text renders as disconnected, unreadable isolated-form
 * letters.
 *
 * Two real steps: arabic-reshaper converts logical Arabic characters
 * into their correct real joined presentation-form glyphs; bidi-js
 * then correctly reorders the real result for right-to-left visual
 * display -- critically, unlike a naive full-string character
 * reversal (confirmed broken via direct testing: it reversed embedded
 * real numbers too, turning "42.50" into "05.24"), bidi-js correctly
 * keeps embedded real LTR runs (order IDs, prices, dates) in their
 * own real correct internal order while still reordering the
 * surrounding real Arabic runs.
 */
function shapeArabic(text) {
  const reshaped = ArabicReshaper.convertArabic(text);
  const embeddingLevels = bidi.getEmbeddingLevels(reshaped);
  return bidi.getReorderedString(reshaped, embeddingLevels);
}

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
        `INSERT INTO order_addresses (order_id, recipient_name, phone, country, city, street_address, postal_code, state, national_address, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'saved_address')`,
        [orderId, saved.recipient_name, saved.phone, saved.country, saved.city, saved.street_address, saved.postal_code, saved.state, saved.national_address]
      );
    } else if (address) {
      await client.query(
        `INSERT INTO order_addresses (order_id, recipient_name, phone, country, city, street_address, postal_code, state, national_address, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'manual')`,
        [orderId, address.recipientName, address.phone, address.country, address.city, address.streetAddress, address.postalCode || null, address.state || null, address.nationalAddress || null]
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

    // Real, confirmed fix for the "request a part we don't carry"
    // system (RFQ): a quote request only genuinely becomes 'ordered'
    // once a real order actually exists for one of its own real
    // priced items -- not merely when those items were added to a
    // real cart (adding to cart happens well before this real
    // address/payment step, and the buyer could still abandon it).
    // Awaited here, before the response, for the exact same real
    // reason the referral-reward check above is: a real buyer
    // checking "My Requests" immediately after placing this real
    // order should see it as ordered right away, not stale.
    try {
      const orderedProductIds = items.map((i) => i.productId);
      await db.query(
        `UPDATE quote_requests SET status = 'ordered'
         WHERE status = 'quoted' AND id IN (
           SELECT DISTINCT request_id FROM quote_request_items WHERE product_id = ANY($1::text[])
         )`,
        [orderedProductIds]
      );
    } catch (err) {
      console.error('Failed to mark a fulfilled quote request as ordered (non-fatal):', err.message);
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
    const supplierLabelMap = buildSupplierLabelMap(subOrders.map((so) => so.supplier_id), req.params.id);

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
  // Confirmed via a real, systematic audit: the previous version here
  // checked supplier_sub_orders.status directly, but nothing in the
  // entire real codebase ever sets that field to 'delivered' -- only
  // hub_shipments.status is, when the hub genuinely confirms delivery.
  // This meant the function could never actually return 'delivered'
  // at all, and 'shipped' fired the moment a supplier shipped to the
  // hub (an internal step), not when the hub actually shipped to the
  // buyer. Now joins each real sub-order to its own real hub shipment
  // status instead.
  const { rows: subOrders } = await db.query(
    `SELECT so.status,
            (SELECT hs.status FROM hub_shipments hs WHERE hs.sub_order_id = so.id) AS hub_status
     FROM supplier_sub_orders so
     WHERE so.order_id = $1`,
    [orderId]
  );
  const { rows: returnCases } = await db.query('SELECT id FROM return_cases WHERE order_id = $1 LIMIT 1', [orderId]);

  // A real return case in progress is what a buyer cares about most for
  // this order right now, regardless of the underlying shipment status
  // -- takes priority over shipped/to_ship/delivered.
  if (returnCases.length > 0) return 'returns';

  // An order with zero real sub-orders yet (a real edge case -- rows
  // can be empty right after checkout, before supplier sub-orders are
  // created) must NOT be treated as "every sub-order delivered" by an
  // Array.every() on an empty array vacuously returning true.
  if (subOrders.length > 0 && subOrders.every((so) => so.hub_status === 'delivered')) return 'delivered';

  // Confirmed with the person: a real flagged hub shipment (a quality
  // issue caught before it ever reached the buyer) surfaces as a real
  // dispute -- matches the mobile app's own already-confirmed
  // _buyerFacingStage logic exactly.
  if (subOrders.some((so) => so.hub_status === 'flagged')) return 'dispute';

  // Multi-supplier orders can have genuinely MIXED real progress (one
  // hub-shipped, one still at the hub) -- if ANY real part has
  // genuinely shipped to the buyer or been delivered, the order counts
  // as real progress having happened, so it shows as 'shipped' rather
  // than still 'to_ship'.
  const anyShippedOrFurther = subOrders.some((so) => ['shipped_to_buyer', 'delivered'].includes(so.hub_status));
  return anyShippedOrFurther ? 'shipped' : 'to_ship';
}

// Confirmed with the person: a genuinely separate, more granular
// status from computeDisplayStatus above -- that one stays untouched
// (still used by the buyer-facing app, which correctly only needs
// the coarse to_ship/shipped/delivered/returns buckets). This one
// exposes the real, detailed hub_shipments workflow specifically for
// the admin portal. When an order has real shipments from multiple
// suppliers at different real stages, shows the least-advanced one
// -- the order genuinely isn't done with a stage until every part
// catches up. Null when no real hub shipment exists yet for this
// order at all (too early -- not a fabricated default).
async function computeHubStatus(orderId) {
  const { rows } = await db.query(
    `SELECT hs.status
     FROM hub_shipments hs
     JOIN supplier_sub_orders so ON so.id = hs.sub_order_id
     WHERE so.order_id = $1`,
    [orderId]
  );
  if (rows.length === 0) return null;
  let leastAdvanced = null;
  let leastAdvancedIdx = Infinity;
  for (const row of rows) {
    // Real terminal statuses ('delivered', 'flagged') aren't in
    // STATUS_ORDER at all -- treated as maximally advanced here, so
    // they never incorrectly win as the "least advanced" one over a
    // real, still-in-progress sibling shipment.
    const idx = STATUS_ORDER.indexOf(row.status);
    const effectiveIdx = idx === -1 ? STATUS_ORDER.length : idx;
    if (effectiveIdx < leastAdvancedIdx) {
      leastAdvancedIdx = effectiveIdx;
      leastAdvanced = row.status;
    }
  }
  return leastAdvanced;
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
      const labelMap = buildSupplierLabelMap(suppliers.map((s) => s.supplierId), o.id);
      return {
        id: o.id,
        userId: o.buyer_id,
        guestEmail: o.guest_email,
        status: o.status,
        displayStatus: await computeDisplayStatus(o.id),
        hubStatus: isAdmin ? await computeHubStatus(o.id) : null,
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

// Confirmed with the person through several rounds of clarification:
// a real sub-order is cancellable based on whether the hub has
// actually shipped it to the buyer yet, not the supplier's own
// separate status (same root cause already fixed for the buyer's
// order timeline). No real hub shipment yet at all, or any hub stage
// before 'shipped_to_buyer' (including 'flagged' -- a real quality
// issue caught at the hub still hasn't left for the buyer), counts
// as cancellable. Already-cancelled stays excluded.
function isSubOrderCancellable(subOrderStatus, hubStatus) {
  if (subOrderStatus === 'cancelled') return false;
  if (hubStatus === 'shipped_to_buyer' || hubStatus === 'delivered') return false;
  return true;
}

async function fetchSubOrdersWithHubStatus(client, orderId) {
  const { rows } = await client.query(
    `SELECT so.id, so.supplier_id, so.status,
            (SELECT hs.status FROM hub_shipments hs WHERE hs.sub_order_id = so.id) AS hub_status
     FROM supplier_sub_orders so
     WHERE so.order_id = $1`,
    [orderId]
  );
  return rows;
}

async function notifySupplierOfCancellation(orderId, supplierId) {
  try {
    const { rows: supplierUserRows } = await db.query('SELECT id FROM users WHERE supplier_id = $1 AND role = $2', [supplierId, 'supplier']);
    if (supplierUserRows.length > 0) {
      await createNotification({
        userId: supplierUserRows[0].id,
        type: 'order_status',
        title: 'An order was cancelled',
        body: `Order ${orderId} was cancelled by the buyer before it shipped.`,
        linkType: 'order',
        linkId: orderId,
      });
    }
  } catch (err) {
    console.error('Cancellation supplier notification failed (non-fatal):', err.message);
  }
}

// POST /:id/cancel { guestEmail? } — real, buyer-initiated
// cancellation of the WHOLE order. CONFIRMED SCOPE: only allowed
// while every real sub-order is still cancellable by real hub
// status -- if even one part has already shipped, this real
// whole-order action is rejected; the buyer uses the new per-
// sub-order endpoint below to cancel just what's still cancellable.
// Real payment capture isn't built yet, so cancelling is purely a
// real status change right now -- there's no real captured payment
// to refund.
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

    const subOrders = await fetchSubOrdersWithHubStatus(client, req.params.id);
    const alreadyShipped = subOrders.some((so) => !isSubOrderCancellable(so.status, so.hub_status));
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
    for (const so of subOrders) {
      await notifySupplierOfCancellation(req.params.id, so.supplier_id);
    }

    res.json({ id: req.params.id, status: 'cancelled' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST /:id/sub-orders/:subOrderId/cancel { guestEmail? } — real,
// buyer-initiated cancellation of a SINGLE supplier's part.
// Confirmed with the person: supports the real partial scenario --
// one supplier's part already shipped to the buyer, another hasn't.
// If this cancellation happens to leave every real sub-order on this
// order cancelled, the real parent order is also marked cancelled.
router.post('/:id/sub-orders/:subOrderId/cancel', optionalAuth, async (req, res, next) => {
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

    const subOrders = await fetchSubOrdersWithHubStatus(client, req.params.id);
    const target = subOrders.find((so) => String(so.id) === String(req.params.subOrderId));
    if (!target) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sub-order not found on this order' });
    }
    if (!isSubOrderCancellable(target.status, target.hub_status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This part has already shipped and can no longer be cancelled. Contact support for help instead.' });
    }

    await client.query(`UPDATE supplier_sub_orders SET status = 'cancelled' WHERE id = $1`, [req.params.subOrderId]);

    // Confirmed with the person: if every real sub-order on this
    // order is now cancelled (this one plus any already cancelled
    // before it), the real parent order is cancelled too.
    const everyoneCancelled = subOrders.every((so) => String(so.id) === String(req.params.subOrderId) || so.status === 'cancelled');
    if (everyoneCancelled) {
      await client.query(`UPDATE orders SET status = 'cancelled' WHERE id = $1`, [req.params.id]);
    }

    await client.query('COMMIT');

    await notifySupplierOfCancellation(req.params.id, target.supplier_id);

    res.json({ id: req.params.id, subOrderId: req.params.subOrderId, status: 'cancelled', orderStatus: everyoneCancelled ? 'cancelled' : order.status });
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
      `INSERT INTO order_addresses (order_id, recipient_name, phone, country, city, street_address, postal_code, state, national_address, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (order_id) DO UPDATE SET
         recipient_name = $2, phone = $3, country = $4, city = $5, street_address = $6, postal_code = $7, state = $8, national_address = $9, source = $10, confirmed_at = now()`,
      [req.params.id, address.recipientName, address.phone, address.country, address.city, address.streetAddress, address.postalCode || null, address.state || null, address.nationalAddress || null, realSource]
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
//
// Real, redesigned (confirmed against a real rendered mockup with the
// person first): logo + brand name header, real customer name and
// full real delivery address, a real bordered items table that
// correctly paginates for long real orders (10-20+ items, re-drawing
// its own real header row on every new page), and a real,
// admin-configurable footer note (see platform-settings/routes.js's
// own GET/PATCH /platform-settings/receipt-footer) -- read fresh from
// the real database on every single request, not cached, so an
// admin's edit takes effect on the very next real receipt generated.
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

    // Real, new -- ?lang=ar renders the whole real receipt in Arabic:
    // real translated labels, real Arabic product names (falling back
    // to English per-product when a specific one has no name_ar set),
    // a real embedded Arabic-capable font (PDFKit's own built-in fonts
    // have no real Arabic glyphs at all), and a real mirrored RTL
    // layout throughout.
    const isAr = req.query.lang === 'ar';
    const t = isAr
      ? {
          receiptTitle: shapeArabic('إيصال الطلب'), order: 'الطلب', placed: 'تاريخ الطلب',
          customer: shapeArabic('العميل'), deliveryAddress: shapeArabic('عنوان التوصيل'), guest: 'ضيف',
          item: shapeArabic('الصنف'), qty: shapeArabic('الكمية'), unitPrice: shapeArabic('سعر الوحدة'),
          total: shapeArabic('الإجمالي'), discount: 'الخصم', totalLine: 'الإجمالي الكلي',
        }
      : { receiptTitle: 'Order receipt', order: 'Order', placed: 'Placed', customer: 'CUSTOMER', deliveryAddress: 'DELIVERY ADDRESS', guest: 'Guest', item: 'Item', qty: 'Qty', unitPrice: 'Unit price', total: 'Total', discount: 'Discount', totalLine: 'Total' };

    const { rows: items } = await db.query(
      `SELECT oli.quantity, oli.unit_price, p.name, p.name_ar
       FROM order_line_items oli
       JOIN supplier_sub_orders so ON so.id = oli.sub_order_id
       JOIN products p ON p.id = oli.product_id
       WHERE so.order_id = $1`,
      [req.params.id]
    );
    const { rows: addressRows } = await db.query('SELECT * FROM order_addresses WHERE order_id = $1', [req.params.id]);
    const address = addressRows[0] || null;

    // Real customer name -- a registered buyer's own real account
    // name, distinct from the real delivery recipient (who may be a
    // different real person, e.g. ordering a gift). Falls back to the
    // real recipient name for a real guest order, since a guest has
    // no separate real account name to show at all.
    let customerName = null;
    if (order.buyer_id) {
      const { rows: userRows } = await db.query('SELECT name FROM users WHERE id = $1', [order.buyer_id]);
      customerName = userRows[0]?.name || null;
    }
    if (!customerName) customerName = address?.recipient_name || t.guest;
    if (isAr) customerName = shapeArabic(customerName);

    const { rows: footerRows } = await db.query("SELECT key, value FROM platform_settings WHERE key IN ('receipt_footer_note_en', 'receipt_footer_note_ar')");
    const footerByKey = Object.fromEntries(footerRows.map((r) => [r.key, r.value]));
    const footerNote = isAr ? (footerByKey.receipt_footer_note_ar || '') : (footerByKey.receipt_footer_note_en || '');

    const PDFDocument = require('pdfkit');
    const path = require('path');
    const doc = new PDFDocument({ margin: 50, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="LEAP-receipt-${order.id}.pdf"`);
    doc.pipe(res);

    // Real, registered only when actually needed -- Noto Sans Arabic,
    // converted from its real bundled WOFF2 into real TTF (PDFKit can
    // only load real TTF/OTF, not WOFF/WOFF2), confirmed to render
    // real, correctly-shaped Arabic script directly before this was
    // wired in here.
    // Real, always registered regardless of isAr -- the admin-
    // configured footer note (below) is a single, language-
    // independent setting, so it could genuinely contain Arabic text
    // even on an English receipt (or vice versa). Always rendering
    // the footer with this font specifically, confirmed safe since it
    // correctly handles both real Arabic and real Latin content,
    // avoids the real garbled-text bug this would otherwise cause.
    doc.registerFont('ArabicCapable', path.join(__dirname, '../../../assets/noto-sans-arabic-regular.ttf'));
    if (isAr) {
      doc.registerFont('Body', path.join(__dirname, '../../../assets/noto-sans-arabic-regular.ttf'));
      doc.registerFont('Body-Bold', path.join(__dirname, '../../../assets/noto-sans-arabic-bold.ttf'));
    } else {
      doc.registerFont('Body', 'Helvetica');
      doc.registerFont('Body-Bold', 'Helvetica-Bold');
    }

    const pageLeft = doc.page.margins.left;
    const pageRight = doc.page.width - doc.page.margins.right;
    const pageWidth = pageRight - pageLeft;
    const pageBottom = doc.page.height - doc.page.margins.bottom;

    // Real column layout for the items table below -- mirrored left
    // to right for Arabic, since RTL reading starts from the right.
    // Computed once, reused by both the real header row and every
    // real item row, and again identically on every new real page.
    const col = isAr
      ? {
          total: pageLeft,
          totalWidth: pageWidth * 0.21,
          price: pageLeft + pageWidth * 0.21,
          priceWidth: pageWidth * 0.19,
          qty: pageLeft + pageWidth * 0.4,
          qtyWidth: pageWidth * 0.12,
          item: pageLeft + pageWidth * 0.52,
          itemWidth: pageWidth * 0.48,
        }
      : {
          item: pageLeft,
          itemWidth: pageWidth * 0.48,
          qty: pageLeft + pageWidth * 0.48,
          qtyWidth: pageWidth * 0.12,
          price: pageLeft + pageWidth * 0.6,
          priceWidth: pageWidth * 0.19,
          total: pageLeft + pageWidth * 0.79,
          totalWidth: pageWidth * 0.21,
        };
    const itemAlign = isAr ? 'right' : 'left';
    const rowHeight = 22;
    const headerHeight = 24;

    function drawTableHeader(y) {
      doc.rect(pageLeft, y, pageWidth, headerHeight).fill('#14171C');
      doc.fillColor('#FFFFFF').fontSize(9).font('Body-Bold');
      doc.text(t.item, col.item + (isAr ? 0 : 8), y + 7, { width: col.itemWidth - 8, align: itemAlign });
      doc.text(t.qty, col.qty, y + 7, { width: col.qtyWidth, align: 'center' });
      doc.text(t.unitPrice, col.price, y + 7, { width: col.priceWidth - 8, align: isAr ? 'left' : 'right' });
      doc.text(t.total, col.total, y + 7, { width: col.totalWidth - 8, align: isAr ? 'left' : 'right' });
      doc.font('Body').fillColor('#000000');
      return y + headerHeight;
    }

    // Real logo + brand name header, confirmed at the very top of the
    // page per the person's own explicit request. Mirrored for
    // Arabic -- logo on the right, brand name to its left, right-
    // aligned, matching RTL reading direction. Captures the real
    // starting y position explicitly first -- doc.image() with
    // explicit x/y coordinates does not advance doc.y the way
    // doc.text() does, so positioning the brand name relative to a
    // captured real value here (not doc.y after the image call) is
    // what actually vertically centers it next to the logo.
    const headerTop = doc.y;
    const logoPath = path.join(__dirname, '../../../assets/leap-logo.png');
    const logoX = isAr ? pageRight - 40 : pageLeft;
    const textX = isAr ? pageLeft : pageLeft + 50;
    const textWidth = isAr ? pageWidth - 50 : pageWidth - 50;
    doc.image(logoPath, logoX, headerTop, { width: 40, height: 40 });
    const brandName = isAr ? shapeArabic('ليب لقطع السيارات') : 'Leap Auto Parts';
    doc.fontSize(20).font('Body-Bold').text(brandName, textX, headerTop + 2, { width: textWidth, align: isAr ? 'right' : 'left' });
    doc.fontSize(10).font('Body').fillColor('#666').text(t.receiptTitle, textX, headerTop + 32, { width: textWidth, align: isAr ? 'right' : 'left' });
    doc.fillColor('#000');
    doc.y = headerTop + 46 + 10;
    doc.moveTo(pageLeft, doc.y).lineTo(pageRight, doc.y).strokeColor('#E4E6EA').stroke();
    doc.moveDown(1);

    doc.fontSize(11).font('Body-Bold').text(isAr ? shapeArabic(`${t.order} ${order.id}`) : `${t.order} ${order.id}`, { align: isAr ? 'right' : 'left' });
    doc.font('Body').fontSize(10).fillColor('#666');
    const placedLine = `${t.placed} ${new Date(order.placed_at).toLocaleDateString()}`;
    doc.text(isAr ? shapeArabic(placedLine) : placedLine, { align: isAr ? 'right' : 'left' });
    doc.fillColor('#000');
    doc.moveDown(0.8);

    // Real customer name and real full delivery address, confirmed
    // added per the person's own explicit request -- shown side by
    // side in two real columns when there's room, mirrored for
    // Arabic (delivery address on the left, customer on the right,
    // matching RTL reading direction), since neither is usually long
    // enough to need the full real page width alone.
    const infoTop = doc.y;
    const customerX = isAr ? pageLeft + pageWidth * 0.52 : pageLeft;
    const addrX = isAr ? pageLeft : pageLeft + pageWidth * 0.52;
    const infoAlign = isAr ? 'right' : 'left';
    doc.fontSize(9).font('Body-Bold').fillColor('#666').text(t.customer, customerX, infoTop, { width: pageWidth * 0.45, align: infoAlign });
    doc.font('Body').fontSize(10).fillColor('#000').text(customerName, customerX, infoTop + 14, { width: pageWidth * 0.45, align: infoAlign });

    if (address) {
      doc.fontSize(9).font('Body-Bold').fillColor('#666').text(t.deliveryAddress, addrX, infoTop, { width: pageWidth * 0.45, align: infoAlign });
      doc.font('Body').fontSize(10).fillColor('#000');
      const s = (text) => (isAr ? shapeArabic(text) : text);
      doc.text(s(address.recipient_name), addrX, infoTop + 14, { width: pageWidth * 0.45, align: infoAlign });
      doc.text(s(address.phone), addrX, doc.y, { width: pageWidth * 0.45, align: infoAlign });
      doc.text(s(address.street_address), addrX, doc.y, { width: pageWidth * 0.45, align: infoAlign });
      const cityLine = [address.city, address.postal_code].filter(Boolean).join(' ');
      doc.text(s(cityLine), addrX, doc.y, { width: pageWidth * 0.45, align: infoAlign });
      doc.text(s(address.country), addrX, doc.y, { width: pageWidth * 0.45, align: infoAlign });
    }
    doc.y = Math.max(doc.y, infoTop + 14 + 14) + 20;

    // Real items table -- bordered, alternating row shading, correctly
    // re-draws its own real header on every new real page for long
    // real orders (10-20+ items). Uses the real Arabic product name
    // when set and requested, falling back to English per-product.
    doc.y = drawTableHeader(doc.y);
    items.forEach((item, i) => {
      if (doc.y + rowHeight > pageBottom) {
        doc.addPage();
        doc.y = drawTableHeader(doc.page.margins.top);
      }
      const rowY = doc.y;
      if (i % 2 === 1) doc.rect(pageLeft, rowY, pageWidth, rowHeight).fill('#F5F6F8').fillColor('#000');
      const lineTotal = Number(item.unit_price) * item.quantity;
      const rawDisplayName = (isAr && item.name_ar) ? item.name_ar : item.name;
      const displayName = isAr ? shapeArabic(rawDisplayName) : rawDisplayName;
      doc.fontSize(9.5);
      doc.text(displayName, col.item + (isAr ? 0 : 8), rowY + 6, { width: col.itemWidth - 8, align: itemAlign, ellipsis: true });
      doc.text(String(item.quantity), col.qty, rowY + 6, { width: col.qtyWidth, align: 'center' });
      doc.text(`$${Number(item.unit_price).toFixed(2)}`, col.price, rowY + 6, { width: col.priceWidth - 8, align: isAr ? 'left' : 'right' });
      doc.text(`$${lineTotal.toFixed(2)}`, col.total, rowY + 6, { width: col.totalWidth - 8, align: isAr ? 'left' : 'right' });
      doc.moveTo(pageLeft, rowY + rowHeight).lineTo(pageRight, rowY + rowHeight).strokeColor('#E4E6EA').stroke();
      doc.y = rowY + rowHeight;
    });
    doc.moveDown(1.5);

    if (doc.y + 60 > pageBottom) {
      doc.addPage();
      doc.y = doc.page.margins.top;
    }
    const totalsAlign = isAr ? 'left' : 'right';
    if (order.discount_amount && Number(order.discount_amount) > 0) {
      const discountLine = `${t.discount}: -$${Number(order.discount_amount).toFixed(2)}`;
      doc.fontSize(10).font('Body').text(isAr ? shapeArabic(discountLine) : discountLine, { align: totalsAlign });
      doc.moveDown(0.3);
    }
    const totalLineText = `${t.totalLine}: $${Number(order.total).toFixed(2)} ${order.currency_code}`;
    doc.fontSize(14).font('Body-Bold').text(isAr ? shapeArabic(totalLineText) : totalLineText, { align: totalsAlign });
    doc.font('Body');

    // Real, admin-configurable footer note -- printed once at the
    // very bottom of the LAST page only (matching the "compact grid"
    // design direction confirmed in the earlier mockup round: a real
    // long order's own extra pages stay focused on items, not a
    // repeated footer on every real page).
    if (footerNote) {
      doc.font('ArabicCapable').fontSize(9).fillColor('#666').text(shapeArabic(footerNote), pageLeft, pageBottom - 30, { width: pageWidth, align: 'center' });
      doc.fillColor('#000');
    }

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
