/**
 * The evidence photos a hub adds for the step it is doing (migration 130), kept on the server until the step is confirmed, so the hub portal and
 * the hub app show the same photos. The photo itself is uploaded as before (POST /uploads/product-image); this only remembers which shipment and
 * which form it was added to. Cleared when a step is confirmed.
 */
const PURPOSES = ['step', 'flag', 'fault_return'];
const MAX = 12;

class DraftPhotoError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

/** { step: [url], flag: [url], fault_return: [url] }, oldest first. */
async function listFor(db, shipmentId) {
  const { rows } = await db.query('SELECT purpose, url FROM hub_draft_photos WHERE shipment_id = $1 ORDER BY created_at, id', [shipmentId]);
  const out = Object.fromEntries(PURPOSES.map((p) => [p, []]));
  for (const r of rows) out[r.purpose].push(r.url);
  return out;
}

async function ownShipment(db, shipmentId, hubId) {
  const { rows } = await db.query('SELECT id FROM hub_shipments WHERE id = $1 AND hub_id = $2', [shipmentId, hubId]);
  if (rows.length === 0) throw new DraftPhotoError('Shipment not found', 404);
}

function check({ purpose, url }) {
  if (!PURPOSES.includes(purpose)) throw new DraftPhotoError(`purpose must be one of: ${PURPOSES.join(', ')}`);
  // a photo uploaded with POST /uploads/product-image: on this server (/uploads/...) or in the cloud storage (https://...)
  const ok = typeof url === 'string' && url.length <= 500 && !url.includes('..') && (/^\/uploads\/[\w./-]+$/.test(url) || /^https:\/\/[^\s"'<>]+$/.test(url));
  if (!ok) throw new DraftPhotoError('url must be a photo uploaded with POST /uploads/product-image');
}

async function add(db, { shipmentId, hubId, userId, purpose, url }) {
  check({ purpose, url });
  await ownShipment(db, shipmentId, hubId);
  const { rows } = await db.query('SELECT COUNT(*) AS n FROM hub_draft_photos WHERE shipment_id = $1 AND purpose = $2', [shipmentId, purpose]);
  if (Number(rows[0].n) >= MAX) throw new DraftPhotoError(`At most ${MAX} photos for one step.`);
  await db.query('INSERT INTO hub_draft_photos (shipment_id, purpose, url, added_by) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [shipmentId, purpose, url, userId || null]);
  return listFor(db, shipmentId);
}

async function remove(db, { shipmentId, hubId, purpose, url }) {
  check({ purpose, url });
  await ownShipment(db, shipmentId, hubId);
  await db.query('DELETE FROM hub_draft_photos WHERE shipment_id = $1 AND purpose = $2 AND url = $3', [shipmentId, purpose, url]);
  return listFor(db, shipmentId);
}

/** A step was confirmed: its photos now belong to the step's event. */
async function clearFor(db, shipmentId) {
  await db.query('DELETE FROM hub_draft_photos WHERE shipment_id = $1', [shipmentId]);
}

module.exports = { PURPOSES, DraftPhotoError, listFor, add, remove, clearFor };
