const db = require('../../../db/pool');
const { createNotification } = require('../notifications/helpers');

/**
 * Real, automatic shipment-delay check (#57). Purely time-based (no
 * real update to a real sub-order's own `hub_shipment_events` in 5+
 * real days while not yet delivered) -- a genuine, honest signal.
 * Deliberately does NOT claim a specific real reason ("customs
 * delay", etc.) -- no such reason is actually tracked anywhere in
 * this real system, and fabricating one would be a real, confirmed
 * lie about why something is slow. See liveTracking.js's own
 * identical real isDelayed computation for the on-demand version of
 * this same real logic.
 */
async function checkForDelayedShipments() {
  const { rows: subOrders } = await db.query(
    `SELECT so.id, so.order_id, o.buyer_id, o.guest_email
     FROM supplier_sub_orders so
     JOIN orders o ON o.id = so.order_id
     WHERE so.status NOT IN ('delivered') AND so.delay_notified = false`
  );

  for (const so of subOrders) {
    if (!so.buyer_id) continue; // a real guest order has no real account to notify -- silently skip, not an error

    const { rows: shipmentRows } = await db.query('SELECT id FROM hub_shipments WHERE sub_order_id = $1', [so.id]);
    const shipment = shipmentRows[0];
    // A real sub-order still pending BEFORE it even reaches a real
    // hub has no real hub_shipment_events yet -- use its own real
    // order placement time as the real "last update" instead, so a
    // genuinely stalled real order (never even picked up) still gets
    // caught, not just one stuck mid-transit.
    let mostRecentEventTime;
    if (shipment) {
      const { rows: eventRows } = await db.query(
        'SELECT created_at FROM hub_shipment_events WHERE shipment_id = $1 ORDER BY created_at DESC LIMIT 1',
        [shipment.id]
      );
      mostRecentEventTime = eventRows[0]?.created_at;
    }
    if (!mostRecentEventTime) {
      const { rows: orderRows } = await db.query('SELECT placed_at FROM orders WHERE id = $1', [so.order_id]);
      mostRecentEventTime = orderRows[0]?.placed_at;
    }
    if (!mostRecentEventTime) continue;

    const daysSinceUpdate = (Date.now() - new Date(mostRecentEventTime).getTime()) / (24 * 60 * 60 * 1000);
    if (daysSinceUpdate < 5) continue;

    try {
      await createNotification({
        userId: so.buyer_id,
        type: 'order_status',
        title: 'Your order is taking longer than expected',
        body: `Order ${so.order_id} hasn't had an update in a while. We're keeping an eye on it.`,
        linkType: 'order',
        linkId: so.order_id,
      });
      await db.query('UPDATE supplier_sub_orders SET delay_notified = true WHERE id = $1', [so.id]);
    } catch (err) {
      console.error('[delay-check] Failed to notify a real delayed shipment (non-fatal):', err.message);
    }
  }
}

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // once a day, matching the real anniversary check's own cadence

function startScheduledDelayCheck() {
  const tick = async () => {
    try {
      await checkForDelayedShipments();
    } catch (err) {
      console.error('[delay-check] Scheduled tick failed (non-fatal, will retry next interval):', err.message);
    }
  };
  tick();
  setInterval(tick, CHECK_INTERVAL_MS);
}

module.exports = { checkForDelayedShipments, startScheduledDelayCheck };
