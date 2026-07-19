const express = require('express');
const crypto = require('crypto');
const db = require('../../../db/pool');
const { sendTransactionalEmail } = require('../email/client');
const { deliveryNotificationEmail } = require('../email/templates');

/**
 * Real 17TRACK webhook integration (migrations 026, corrected by 027).
 * CONFIRMED SCOPE: carrier confirmation is the preferred, trusted path
 * to 'delivered' -- the hub's own manual confirmation stays as a real
 * fallback (see hub/routes.js), since cross-border tracking is often
 * incomplete or delayed and a carrier-only requirement would leave a
 * genuinely delivered order stuck with no way to release payment.
 *
 * REAL BUG FOUND AND FIXED (migration 027), found by the person
 * directly: this originally matched against the SUPPLIER's own
 * tracking number -- but a supplier in this real business only ships
 * locally within China, hub to hub. That tracking number only ever
 * covers the domestic Supplier -> Hub leg. The real final leg that
 * actually reaches the buyer is the HUB's own shipment, using the
 * hub's OWN tracking number (collected in
 * hub_shipment_events.tracking_number for the 'shipped_to_buyer' step)
 * -- matched and updated here now, not the supplier's own record.
 *
 * HONEST LIMITATION: this was built from documented knowledge of
 * 17TRACK's push/webhook API structure, not verified against a real,
 * live 17TRACK account (no such account exists to test against here).
 * Webhook field names and the signing scheme can change between API
 * versions -- verify the actual real payload shape and signature
 * header using 17TRACK's own webhook test tool in your dashboard
 * before relying on this in production, and adjust
 * parseTrackingEvent()/verifySignature() below if what you see
 * differs from what's assumed here.
 */
const router = express.Router();

// Real, standard HMAC-SHA256 signature check -- confirms this request
// genuinely came from 17TRACK (using the real shared secret configured
// below), not a spoofed request hitting a real, public webhook URL.
// Refuses to process anything if the real secret isn't configured --
// fails closed, never silently accepts unverified webhooks.
function verifySignature(req) {
  const secret = process.env.TRACK17_WEBHOOK_SECRET;
  if (!secret) return false;
  const signature = req.headers['sign'] || req.headers['x-signature'];
  if (!signature || typeof signature !== 'string') return false;
  if (!req.rawBody) return false; // real raw bytes weren't captured -- fail closed, never guess
  const computed = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
  const sigBuf = Buffer.from(signature);
  const computedBuf = Buffer.from(computed);
  if (sigBuf.length !== computedBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, computedBuf);
}

// Real, best-effort per-tracking-number processing (same pattern as
// the admin dashboard's bulk moderation) -- 17TRACK can batch several
// tracking updates into one real webhook call, and one bad/unmatched
// entry shouldn't block the rest of a real batch.
router.post('/17track', async (req, res, next) => {
  try {
    if (!verifySignature(req)) {
      return res.status(401).json({ error: 'Invalid or missing webhook signature' });
    }
    const data = req.body?.data;
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: 'Expected a real data array in the webhook payload' });
    }

    const results = [];
    for (const item of data) {
      const trackingNumber = item?.number;
      const status = item?.track_info?.latest_status?.status;
      const eventTimeIso = item?.track_info?.latest_event?.time_iso;
      const carrierCode = item?.carrier;

      if (!trackingNumber || !status) {
        results.push({ trackingNumber: trackingNumber || null, success: false, error: 'Missing tracking number or status in this entry' });
        continue;
      }
      if (String(status).toLowerCase() !== 'delivered') {
        results.push({ trackingNumber, success: true, skipped: true, reason: `status is '${status}', not a real delivery confirmation yet` });
        continue;
      }

      const deliveredAt = eventTimeIso ? new Date(eventTimeIso) : new Date();
      try {
        // Matches the real HUB's own tracking number (the actual final
        // leg to the buyer), not the supplier's domestic one -- see the
        // real bug this migration 027 fixed, in this file's own header
        // comment above.
        const { rows } = await db.query(
          `WITH latest_shipped_event AS (
             SELECT DISTINCT ON (shipment_id) shipment_id
             FROM hub_shipment_events
             WHERE step = 'shipped_to_buyer' AND tracking_number = $3
             ORDER BY shipment_id, created_at DESC
           )
           UPDATE hub_shipments SET
             status = 'delivered', delivered_at = $1, delivery_confirmed_by = 'carrier',
             carrier_code = COALESCE(carrier_code, $2)
           WHERE id IN (SELECT shipment_id FROM latest_shipped_event) AND status != 'delivered'
           RETURNING id, sub_order_id`,
          [deliveredAt, carrierCode ? String(carrierCode) : null, trackingNumber]
        );
        if (rows.length === 0) {
          results.push({ trackingNumber, success: false, error: 'No matching real hub shipment found for this tracking number, or it was already delivered' });
        } else {
          const { rows: subOrderRows } = await db.query('SELECT order_id FROM supplier_sub_orders WHERE id = $1', [rows[0].sub_order_id]);
          const orderId = subOrderRows[0]?.order_id;
          results.push({ trackingNumber, success: true, hubShipmentId: rows[0].id, orderId });
          // Real delivery notification email (new) -- best-effort, same
          // as the hub's own manual delivery path -- a real carrier
          // confirmation deserves the exact same real notification a
          // manual confirmation would trigger.
          try {
            const { rows: orderRows } = await db.query('SELECT buyer_id, guest_email FROM orders WHERE id = $1', [orderId]);
            let recipientEmail = orderRows[0]?.guest_email || null;
            let recipientName = null;
            if (orderRows[0]?.buyer_id) {
              const { rows: userRows } = await db.query('SELECT email, name FROM users WHERE id = $1', [orderRows[0].buyer_id]);
              if (userRows.length > 0) { recipientEmail = userRows[0].email; recipientName = userRows[0].name; }
            }
            if (recipientEmail) {
              const { html, text } = deliveryNotificationEmail({ recipientName, orderId });
              await sendTransactionalEmail({ to: recipientEmail, subject: `Your order has been delivered — ${orderId}`, html, text, fallbackLogLabel: 'order-delivered-carrier' });
            }
          } catch (emailErr) {
            console.error('Carrier-confirmed delivery email failed (non-fatal):', emailErr.message);
          }
        }
      } catch (err) {
        results.push({ trackingNumber, success: false, error: 'Internal error updating this hub shipment' });
      }
    }

    res.json({ results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
