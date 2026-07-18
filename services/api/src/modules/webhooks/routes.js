const express = require('express');
const crypto = require('crypto');
const db = require('../../../db/pool');

/**
 * Real 17TRACK webhook integration (migration 026). CONFIRMED SCOPE:
 * carrier confirmation is the preferred, trusted path to 'delivered' --
 * the supplier's own manual confirmation stays as a real fallback (see
 * supplier/routes.js), since cross-border tracking is often incomplete
 * or delayed and a carrier-only requirement would leave a genuinely
 * delivered order stuck with no way to release payment.
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
        const { rows } = await db.query(
          `UPDATE supplier_sub_orders SET
             status = 'delivered', delivered_at = $1, delivery_confirmed_by = 'carrier',
             carrier_code = COALESCE(carrier_code, $2)
           WHERE tracking_number = $3 AND status != 'delivered'
           RETURNING id`,
          [deliveredAt, carrierCode ? String(carrierCode) : null, trackingNumber]
        );
        if (rows.length === 0) {
          results.push({ trackingNumber, success: false, error: 'No matching real sub-order found for this tracking number, or it was already delivered' });
        } else {
          results.push({ trackingNumber, success: true, subOrderId: rows[0].id });
        }
      } catch (err) {
        results.push({ trackingNumber, success: false, error: 'Internal error updating this sub-order' });
      }
    }

    res.json({ results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
