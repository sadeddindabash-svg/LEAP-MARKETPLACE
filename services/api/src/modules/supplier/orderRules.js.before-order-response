/**
 * What a SUPPLIER may do to one of its sub-orders, and when.
 *
 * The supplier's own leg is: pending -> preparing -> shipped (to the inspection hub). Rules:
 *   - FORWARD ONLY: an order that is preparing cannot go back to pending; one that is shipped cannot go back to preparing or pending.
 *   - LOCKED once the hub has RECEIVED the parcel (its hub shipment is past "awaiting receipt"): the supplier can change nothing, neither the status nor
 *     the tracking number. The hub's own steps take over from there. If the hub flags a problem, the supplier does NOT reopen the order: it answers the
 *     FAULT CASE (replace or not, ETA, return address) and a replacement is a NEW order that starts again at pending.
 *   - LOCKED when the buyer cancelled the part.
 *   - Until the hub receives the parcel the supplier can still correct the tracking number.
 * Pure functions on purpose: the order list (what the portal shows) and the update route (what the server allows) use the same ones.
 */
const STAGES = ['pending', 'preparing', 'shipped'];

function describeControls({ status, hubShipmentStatus }) {
  if (status === 'cancelled') return { locked: true, lockReason: 'cancelled', allowedStatuses: [], canEditTracking: false };
  if (hubShipmentStatus && hubShipmentStatus !== 'awaiting_receipt') return { locked: true, lockReason: 'at_hub', allowedStatuses: [], canEditTracking: false };
  const position = STAGES.indexOf(status);                // an old "dispute" row reads as -1: it may still move forward from the start
  return { locked: false, lockReason: null, allowedStatuses: STAGES.filter((_, i) => i > position), canEditTracking: true };
}

// Returns null when the change is allowed, or { code, message } when it must be refused (always HTTP 409).
function refuseChange({ status, hubShipmentStatus }, { status: wanted, trackingNumber }) {
  const controls = describeControls({ status, hubShipmentStatus });
  if (controls.lockReason === 'cancelled') {
    return { code: 'order_cancelled', message: 'The buyer cancelled this part, so it can no longer be changed.' };
  }
  if (controls.lockReason === 'at_hub') {
    return { code: 'order_locked_at_hub', message: 'This parcel has reached the inspection hub, so it can no longer be changed here. If the hub finds a problem, the platform will contact you.' };
  }
  if (wanted !== undefined && wanted !== status && !controls.allowedStatuses.includes(wanted)) {
    return { code: 'status_cannot_go_back', message: `This order is already "${status}": its status can only move forward (pending, preparing, shipped), never back to "${wanted}".` };
  }
  return null;
}

module.exports = { STAGES, describeControls, refuseChange };
