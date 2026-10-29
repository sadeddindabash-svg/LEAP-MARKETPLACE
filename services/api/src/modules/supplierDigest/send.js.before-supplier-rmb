const db = require('../../../db/pool');
const { sendTransactionalEmail } = require('../email/client');
const { wrapEmailBody } = require('../email/templates');

/**
 * Real weekly email digest for suppliers (migration 040). CONFIRMED
 * SCOPE: weekly frequency, summarizing new orders, new reviews, and
 * new messages since the last real digest (or since the supplier
 * account was created, if none has been sent yet).
 */

const DIGEST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // real, confirmed: weekly

async function gatherDigestData(supplierId, sinceDate) {
  const { rows: orderRows } = await db.query(
    `SELECT COUNT(DISTINCT so.id) AS order_count, COALESCE(SUM(oli.quantity * oli.unit_price), 0) AS total_value
     FROM supplier_sub_orders so
     JOIN orders o ON o.id = so.order_id
     JOIN order_line_items oli ON oli.sub_order_id = so.id
     WHERE so.supplier_id = $1 AND o.placed_at >= $2`,
    [supplierId, sinceDate]
  );
  const { rows: reviewRows } = await db.query(
    `SELECT COUNT(*) AS review_count, COALESCE(AVG(pr.rating), 0) AS avg_rating
     FROM product_reviews pr
     JOIN products p ON p.id = pr.product_id
     WHERE p.supplier_id = $1 AND pr.status = 'approved' AND pr.created_at >= $2`,
    [supplierId, sinceDate]
  );
  const { rows: messageRows } = await db.query(
    `SELECT COUNT(*) AS message_count
     FROM supplier_messages
     WHERE supplier_id = $1 AND sender_role != 'supplier' AND created_at >= $2`,
    [supplierId, sinceDate]
  );

  return {
    orderCount: Number(orderRows[0].order_count),
    totalValue: Number(orderRows[0].total_value),
    reviewCount: Number(reviewRows[0].review_count),
    avgRating: Number(reviewRows[0].avg_rating),
    messageCount: Number(messageRows[0].message_count),
  };
}

// Real, deliberate: a digest with genuinely nothing new to report
// still sends (a supplier with a quiet week should still hear from
// the platform on a real, predictable cadence, not go silent and
// wonder if something's broken) -- unlike price-drop/saved-search
// alerts, which only notify when there's real, new news.
function digestEmailBody({ orderCount, totalValue, reviewCount, avgRating, messageCount }, supplierName) {
  const lines = [];
  lines.push(`<strong>${orderCount}</strong> new order${orderCount === 1 ? '' : 's'} this week${orderCount > 0 ? ` (worth $${totalValue.toFixed(2)})` : ''}.`);
  lines.push(`<strong>${reviewCount}</strong> new review${reviewCount === 1 ? '' : 's'}${reviewCount > 0 ? ` (average ${avgRating.toFixed(1)}★)` : ''}.`);
  lines.push(`<strong>${messageCount}</strong> new message${messageCount === 1 ? '' : 's'} from buyers or the platform.`);
  return `Hi${supplierName ? ` ${supplierName}` : ''},<br><br>Here's your weekly summary:<br><br>${lines.join('<br>')}<br><br>Log in to the supplier portal for the full details.`;
}

async function sendDigestForSupplier(supplier) {
  const sinceDate = supplier.last_digest_sent_at || supplier.created_at;
  const data = await gatherDigestData(supplier.id, sinceDate);

  const { rows: supplierUserRows } = await db.query(
    'SELECT email, name FROM users WHERE supplier_id = $1 AND role = $2',
    [supplier.id, 'supplier']
  );
  if (supplierUserRows.length > 0 && supplierUserRows[0].email) {
    await sendTransactionalEmail({
      to: supplierUserRows[0].email,
      subject: 'Your weekly Leap summary',
      html: wrapEmailBody({
        heading: 'Your weekly summary',
        bodyHtml: digestEmailBody(data, supplierUserRows[0].name),
      }),
      fallbackLogLabel: 'supplier-digest',
    });
  }

  await db.query('UPDATE suppliers SET last_digest_sent_at = now() WHERE id = $1', [supplier.id]);
  return { supplierId: supplier.id, ...data };
}

// Real, best-effort sweep -- only suppliers genuinely due (never sent,
// or sent 7+ real days ago) get a real digest this tick, not every
// supplier every time the scheduler runs.
async function sendDueSupplierDigests() {
  const cutoff = new Date(Date.now() - DIGEST_INTERVAL_MS);
  const { rows: dueSuppliers } = await db.query(
    `SELECT * FROM suppliers WHERE last_digest_sent_at IS NULL OR last_digest_sent_at <= $1`,
    [cutoff]
  );
  let sent = 0;
  for (const supplier of dueSuppliers) {
    try {
      await sendDigestForSupplier(supplier);
      sent += 1;
    } catch (err) {
      console.error(`[supplier-digest] Real digest failed for supplier ${supplier.id} (non-fatal):`, err.message);
    }
  }
  console.log(`[supplier-digest] Real sweep complete: ${sent} of ${dueSuppliers.length} due digest(s) sent.`);
  return { due: dueSuppliers.length, sent };
}

// Real, confirmed: checked once a day (not every 6 hours like the
// shorter-interval alerts) -- a weekly digest doesn't need frequent
// polling, and this still catches every supplier within a real day of
// becoming due.
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

function startScheduledSupplierDigest() {
  const tick = async () => {
    try {
      await sendDueSupplierDigests();
    } catch (err) {
      console.error('[supplier-digest] Scheduled tick failed (non-fatal, will retry next interval):', err.message);
    }
  };
  tick();
  setInterval(tick, CHECK_INTERVAL_MS);
}

module.exports = { gatherDigestData, sendDigestForSupplier, sendDueSupplierDigests, startScheduledSupplierDigest };
