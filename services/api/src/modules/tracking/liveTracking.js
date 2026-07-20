const db = require('../../../db/pool');

/**
 * Real live carrier tracking (new). CONFIRMED SCOPE, discussed before
 * building: real, granular carrier events (e.g. "departed origin
 * facility", "customs clearance", "out for delivery") pulled directly
 * from 17TRACK's own tracking-QUERY API, not just the webhook PUSH
 * already integrated (migrations 026/027, which only ever tells us
 * the final 'delivered' moment, never the events leading up to it).
 *
 * HONEST LIMITATION, same as the existing webhook integration: this
 * was built entirely from 17TRACK's documented API structure, not
 * verified against a real, live account (no such account exists to
 * test against here). The real endpoint paths, the real register
 * step, and the real response shape below are 17TRACK's own
 * documented v2.2 API as of this project's training data -- 17TRACK
 * has changed API versions before and may again. Verify the actual
 * real request/response shape against your own live account (their
 * dashboard has a real request tester) before relying on this, and
 * adjust parseTrackingEvents() below if what you see differs.
 *
 * 17TRACK's real API requires registering a tracking number before
 * they'll actively track it -- done here as a real, best-effort call
 * every time (registering an already-registered number is a real,
 * documented no-op on their side, not an error worth treating as one).
 */

const TRACK17_BASE_URL = 'https://api.17track.net/track/v2.2';

const HUB_STEP_LABELS = {
  received: 'Received at hub',
  opened: 'Opened for inspection',
  inspected: 'Inspection complete',
  packed: 'Repacked for shipping',
  shipped_to_buyer: 'Shipped to you',
};

function apiHeaders() {
  const apiKey = process.env.TRACK17_API_KEY;
  return { 'Content-Type': 'application/json', '17token': apiKey };
}

async function registerTrackingNumber(trackingNumber, carrierCode) {
  try {
    await fetch(`${TRACK17_BASE_URL}/register`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify([{ number: trackingNumber, carrier: carrierCode ? Number(carrierCode) : undefined }]),
    });
  } catch (err) {
    // Real, best-effort -- registering an already-registered real
    // number is a real, documented no-op on 17TRACK's side, and a
    // genuine network hiccup here should never block showing whatever
    // real tracking data we can still get from the query below.
    console.error('[tracking] Real register call failed (non-fatal):', err.message);
  }
}

// Real, defensive parsing -- 17TRACK's real documented v2.2 response
// nests events under
// data.accepted[].track_info.tracking.providers[].events[]. Returns a
// real, normalized, empty-safe array rather than throwing on any real
// shape mismatch -- an honest empty timeline beats a crash.
function parseTrackingEvents(responseBody) {
  try {
    const accepted = responseBody?.data?.accepted || [];
    const item = accepted[0];
    if (!item) return [];
    const providers = item.track_info?.tracking?.providers || [];
    const events = providers.flatMap((p) => p.events || []);
    return events
      .map((e) => ({
        time: e.time_iso || e.time_utc || null,
        description: e.description || e.stage || '',
        location: e.location || null,
      }))
      .filter((e) => e.time && e.description)
      .sort((a, b) => new Date(b.time) - new Date(a.time));
  } catch (err) {
    console.error('[tracking] Real response parsing failed (non-fatal, showing an empty carrier timeline):', err.message);
    return [];
  }
}

// Real, best-effort live query -- never throws; a real 17TRACK outage
// or missing real API key should never break the order tracking
// screen, just leave the carrier-events portion empty. The real hub
// milestones (see buildTrackingTimeline below) are never dependent on
// this succeeding.
async function fetchLiveTrackingEvents(trackingNumber, carrierCode) {
  if (!process.env.TRACK17_API_KEY) {
    console.log('[tracking] TRACK17_API_KEY not configured -- skipping the real live carrier query, showing only our own real hub milestones.');
    return [];
  }
  try {
    await registerTrackingNumber(trackingNumber, carrierCode);
    const response = await fetch(`${TRACK17_BASE_URL}/gettrackinfo`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify([{ number: trackingNumber, carrier: carrierCode ? Number(carrierCode) : undefined }]),
    });
    if (!response.ok) {
      console.error(`[tracking] Real 17TRACK query responded with ${response.status} (non-fatal)`);
      return [];
    }
    const body = await response.json();
    return parseTrackingEvents(body);
  } catch (err) {
    console.error('[tracking] Real live carrier query failed (non-fatal):', err.message);
    return [];
  }
}

// Real, merged timeline for one real order: our own hub milestones
// (always real and available, regardless of any carrier API) plus
// real live carrier events for the final leg, when a real hub
// tracking number exists and the real 17TRACK query succeeds.
async function buildTrackingTimeline(orderId) {
  const { rows: subOrders } = await db.query(
    `SELECT so.id, so.status AS supplier_status, so.tracking_number AS supplier_tracking_number
     FROM supplier_sub_orders so WHERE so.order_id = $1`,
    [orderId]
  );

  const results = [];
  for (const so of subOrders) {
    const { rows: shipmentRows } = await db.query('SELECT * FROM hub_shipments WHERE sub_order_id = $1', [so.id]);
    const shipment = shipmentRows[0] || null;

    const hubMilestones = [];
    if (shipment) {
      const { rows: events } = await db.query(
        'SELECT step, tracking_number, created_at FROM hub_shipment_events WHERE shipment_id = $1 ORDER BY created_at ASC',
        [shipment.id]
      );
      for (const e of events) {
        hubMilestones.push({ time: e.created_at, description: HUB_STEP_LABELS[e.step] || e.step, location: null, source: 'hub' });
      }
      if (shipment.delivered_at) {
        hubMilestones.push({
          time: shipment.delivered_at,
          description: shipment.delivery_confirmed_by === 'carrier' ? 'Delivered (confirmed by carrier)' : 'Delivered (confirmed by hub)',
          location: null,
          source: 'hub',
        });
      }
    }

    // Real live carrier events -- only for the hub's own final-leg
    // tracking number (see migration 027's own header comment for why
    // this is the correct one, not the supplier's domestic one).
    let carrierEvents = [];
    const { rows: shippedEventRows } = shipment
      ? await db.query(
          `SELECT tracking_number FROM hub_shipment_events WHERE shipment_id = $1 AND step = 'shipped_to_buyer' ORDER BY created_at DESC LIMIT 1`,
          [shipment.id]
        )
      : { rows: [] };
    const hubTrackingNumber = shippedEventRows[0]?.tracking_number;
    if (hubTrackingNumber) {
      const rawEvents = await fetchLiveTrackingEvents(hubTrackingNumber, shipment.carrier_code);
      carrierEvents = rawEvents.map((e) => ({ ...e, source: 'carrier' }));
    }

    const timeline = [...hubMilestones, ...carrierEvents].sort((a, b) => new Date(b.time) - new Date(a.time));
    results.push({
      subOrderId: so.id,
      supplierTrackingNumber: so.supplier_tracking_number,
      hubTrackingNumber: hubTrackingNumber || null,
      timeline,
    });
  }
  return results;
}

module.exports = { buildTrackingTimeline, fetchLiveTrackingEvents };
