const db = require('../../../db/pool');
const { calculateBuyerPriceUsd } = require('../pricing/engine');
const { createNotification } = require('../notifications/helpers');
const { sendTransactionalEmail } = require('../email/client');
const { wrapEmailBody } = require('../email/templates');

/**
 * Real price-drop alerts on wishlist items (migration 038). CONFIRMED
 * DESIGN: a real, periodic scheduled check (prices here are computed
 * live, never stored, so there's no single "save point" to hook a
 * real drop-detection check into the way stock decrementing has one).
 *
 * Only real, currently-wishlisted products are checked -- there's no
 * real reason to compute prices for products nobody has expressed any
 * real interest in.
 */

// Real, best-effort check for one real product: compares its current
// real buyer price against its last known real snapshot, notifies
// every real buyer who has it wishlisted if it's a genuine drop, and
// always updates the real snapshot to the current price afterward
// (a real, sliding comparison window, not a fixed original price
// compared against forever).
async function checkProductForPriceDrop(product) {
  let currentPriceUsd;
  if (product.currency_code !== 'CNY') {
    currentPriceUsd = Number(product.price);
  } else {
    const result = await calculateBuyerPriceUsd({
      supplierCostCny: Number(product.price),
      weightKg: product.weight_kg === null ? null : Number(product.weight_kg),
      lengthCm: product.length_cm === null ? null : Number(product.length_cm),
      widthCm: product.width_cm === null ? null : Number(product.width_cm),
      heightCm: product.height_cm === null ? null : Number(product.height_cm),
    });
    currentPriceUsd = result.buyerPriceUsd;
  }

  const lastKnown = product.last_known_buyer_price_usd === null ? null : Number(product.last_known_buyer_price_usd);
  // Real, deliberate epsilon -- floating-point USD computation can
  // differ by fractions of a cent between two real runs with the
  // exact same underlying inputs; only a real, meaningful drop (at
  // least half a cent) counts, not rounding noise.
  const isRealDrop = lastKnown !== null && currentPriceUsd < lastKnown - 0.005;

  if (isRealDrop) {
    const { rows: wishlisters } = await db.query(
      'SELECT buyer_id FROM wishlist_items WHERE product_id = $1',
      [product.id]
    );
    for (const { buyer_id: buyerId } of wishlisters) {
      try {
        await createNotification({
          userId: buyerId,
          type: 'price_drop',
          title: 'Price drop on a wishlist item',
          body: `${product.name} dropped to $${currentPriceUsd.toFixed(2)} (was $${lastKnown.toFixed(2)}).`,
          linkType: 'product',
          linkId: product.id,
        });
        const { rows: buyerRows } = await db.query('SELECT email, name FROM users WHERE id = $1', [buyerId]);
        if (buyerRows.length > 0 && buyerRows[0].email) {
          await sendTransactionalEmail({
            to: buyerRows[0].email,
            subject: `Price drop: ${product.name}`,
            html: wrapEmailBody({
              heading: 'Price drop on a wishlist item',
              bodyHtml: `Hi${buyerRows[0].name ? ` ${buyerRows[0].name}` : ''},<br><br><strong>${product.name}</strong> just dropped to <strong>$${currentPriceUsd.toFixed(2)}</strong> (was $${lastKnown.toFixed(2)}).<br><br>It's still on your wishlist — worth another look.`,
            }),
            fallbackLogLabel: 'price-drop',
          });
        }
      } catch (err) {
        console.error('[price-drop] Real notification failed for one buyer (non-fatal):', err.message);
      }
    }
  }

  await db.query('UPDATE products SET last_known_buyer_price_usd = $1 WHERE id = $2', [currentPriceUsd, product.id]);
  return { productId: product.id, currentPriceUsd, wasDrop: isRealDrop };
}

// Real, best-effort sweep across every real currently-wishlisted
// product. Never throws -- a genuine failure on one real product
// should never stop the rest of the real sweep from completing.
async function checkAllWishlistedProductsForPriceDrops() {
  const { rows: products } = await db.query(
    `SELECT DISTINCT p.* FROM products p
     JOIN wishlist_items wi ON wi.product_id = p.id`
  );
  let dropsFound = 0;
  for (const product of products) {
    try {
      const result = await checkProductForPriceDrop(product);
      if (result.wasDrop) dropsFound += 1;
    } catch (err) {
      console.error(`[price-drop] Real check failed for product ${product.id} (non-fatal):`, err.message);
    }
  }
  console.log(`[price-drop] Real sweep complete: ${products.length} wishlisted product(s) checked, ${dropsFound} real drop(s) found.`);
  return { checked: products.length, dropsFound };
}

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // real, confirmed: every 6 hours

// Real, best-effort scheduling -- same setInterval pattern as the FX
// rate refresh (services/api/src/modules/pricing/fxRateRefresh.js),
// deliberately no new cron dependency. Runs once at real startup, then
// every real 6 hours after that.
function startScheduledPriceDropCheck() {
  const tick = async () => {
    try {
      await checkAllWishlistedProductsForPriceDrops();
    } catch (err) {
      console.error('[price-drop] Scheduled tick failed (non-fatal, will retry next interval):', err.message);
    }
  };
  tick();
  setInterval(tick, CHECK_INTERVAL_MS);
}

module.exports = { checkProductForPriceDrop, checkAllWishlistedProductsForPriceDrops, startScheduledPriceDropCheck };
