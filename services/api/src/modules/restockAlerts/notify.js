const db = require('../../../db/pool');
const { createNotification } = require('../notifications/helpers');
const { sendTransactionalEmail } = require('../email/client');
const { wrapEmailBody } = require('../email/templates');

/**
 * Real back-in-stock alerts on wishlist items (new) -- closes a real,
 * confirmed gap: nothing notified a buyer when a wishlisted,
 * out-of-stock product came back. Mirrors the established price-drop
 * alert pattern (services/api/src/modules/priceDropAlerts) -- same
 * real wishlist_items table, same createNotification + email
 * mechanism -- but DELIBERATELY NOT a periodic sweep like price-drop
 * needs: stock, unlike a live-computed buyer price, only ever changes
 * at one real, controllable point (a supplier's own
 * PATCH /supplier/me/products/:id), so this hooks in directly there
 * instead of polling on a timer.
 *
 * CONFIRMED SCOPE: only a genuine 0 -> positive transition counts as
 * "back in stock" -- a supplier raising stock from 3 to 10 is not a
 * restock from a buyer's perspective (it was never actually
 * unavailable), so this must never fire for that case.
 */
async function notifyRestock(product) {
  const { rows: wishlisters } = await db.query(
    'SELECT buyer_id FROM wishlist_items WHERE product_id = $1',
    [product.id]
  );
  for (const { buyer_id: buyerId } of wishlisters) {
    try {
      await createNotification({
        userId: buyerId,
        type: 'back_in_stock',
        title: 'Back in stock',
        body: `${product.name} is back in stock.`,
        linkType: 'product',
        linkId: product.id,
      });
      const { rows: buyerRows } = await db.query('SELECT email, name FROM users WHERE id = $1', [buyerId]);
      if (buyerRows.length > 0 && buyerRows[0].email) {
        await sendTransactionalEmail({
          to: buyerRows[0].email,
          subject: `Back in stock: ${product.name}`,
          html: wrapEmailBody({
            heading: 'Back in stock',
            bodyHtml: `Hi${buyerRows[0].name ? ` ${buyerRows[0].name}` : ''},<br><br><strong>${product.name}</strong> is back in stock — it's still on your wishlist, so grab it before it sells out again.`,
          }),
          fallbackLogLabel: 'back-in-stock',
        });
      }
    } catch (err) {
      console.error('[back-in-stock] Real notification failed for one buyer (non-fatal):', err.message);
    }
  }
  return { productId: product.id, notifiedCount: wishlisters.length };
}

module.exports = { notifyRestock };
