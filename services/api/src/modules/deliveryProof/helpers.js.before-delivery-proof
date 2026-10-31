const crypto = require('crypto');
const { emailLanguageForAddress, emailSubject } = require('../email/language');
const fs = require('fs');
const path = require('path');
const { imageSize } = require('image-size');
const db = require('../../../db/pool');
const { publicBaseUrl } = require('../../config/publicUrl');
const { isCloudStorageConfigured, uploadToCloud } = require('../storage/client');
const { createNotification } = require('../notifications/helpers');
const messages = require('../notifications/messages');
const { sendTransactionalEmail } = require('../email/client');
const { deliveryNotificationEmail } = require('../email/templates');
const faultCases = require('../faultCases/helpers');

/**
 * Delivery proof from the COURIER (migration 096). See db/migrations/096_delivery_proof.sql for the idea and why the link is guarded.
 *
 *   state of a link:  unknown        no such link
 *                     expired        past its 60 days
 *                     not_shipped_yet  the hub has not shipped the parcel (so the link does nothing yet)
 *                     ready          shipped, awaiting delivery: the first upload marks it DELIVERED
 *                     delivered      already delivered (by the hub, the carrier or an earlier upload): uploads only ADD photos
 */
const MAX_PHOTOS = 8;
const MIN_DIMENSION_PX = 400; // a real phone photo is far larger; this only refuses thumbnails and screenshots of icons
const LINK_VALID_DAYS = 60;
const UPLOAD_DIR = path.join(__dirname, '../../../uploads');

class ProofError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const proofUrl = (token) => `${publicBaseUrl()}/p/${token}`;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;

// One link per shipment. Safe to call again: the existing one is kept (a printed label must keep working).
async function ensureProofLink(shipmentId, client = db) {
  const token = crypto.randomBytes(32).toString('base64url');
  await client.query(
    `INSERT INTO delivery_proof_links (shipment_id, token, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval) ON CONFLICT (shipment_id) DO NOTHING`,
    [shipmentId, token, String(LINK_VALID_DAYS)]
  );
  const { rows } = await client.query('SELECT token, expires_at FROM delivery_proof_links WHERE shipment_id = $1', [shipmentId]);
  return { token: rows[0].token, expiresAt: rows[0].expires_at, url: proofUrl(rows[0].token) };
}

async function loadLink(token, client = db) {
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) return null;
  const { rows } = await client.query(
    `SELECT l.shipment_id, l.expires_at, hs.status, hs.sub_order_id, so.order_id
     FROM delivery_proof_links l JOIN hub_shipments hs ON hs.id = l.shipment_id JOIN supplier_sub_orders so ON so.id = hs.sub_order_id
     WHERE l.token = $1`, [token]
  );
  return rows[0] || null;
}

function stateOf(link) {
  if (!link) return 'unknown';
  if (new Date(link.expires_at) < new Date()) return 'expired';
  if (link.status === 'delivered') return 'delivered';
  if (link.status === 'shipped_to_buyer') return 'ready';
  return 'not_shipped_yet';
}

async function describeLink(token) {
  const link = await loadLink(token);
  const state = stateOf(link);
  if (!link) return { state };
  const { rows } = await db.query('SELECT count(*) AS n FROM delivery_proofs WHERE shipment_id = $1', [link.shipment_id]);
  return { state, orderId: link.order_id, photoCount: Number(rows[0].n), maxPhotos: MAX_PHOTOS };
}

// Validates it is a real, big-enough image, then stores it (cloud if configured, otherwise the local uploads folder), the same as other uploads.
async function savePhoto(file) {
  let size;
  try { size = imageSize(file.buffer); } catch { throw new ProofError('One of the files is not a real photo.'); }
  if (Math.min(size.width, size.height) < MIN_DIMENSION_PX) throw new ProofError(`A photo is too small (${size.width}x${size.height}). Please take a normal photo.`);
  const ext = file.mimetype === 'image/png' ? '.png' : file.mimetype === 'image/webp' ? '.webp' : '.jpg';
  const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`;
  if (isCloudStorageConfigured()) {
    try { return await uploadToCloud(file.buffer, filename, file.mimetype); } catch (err) { console.error('Cloud storage upload failed, falling back to local disk:', err.message); }
  }
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.buffer);
  return `/uploads/${filename}`;
}

const clean = (value, max) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null);

// The courier sends photos. Stores them; and if the parcel was awaiting delivery, marks it DELIVERED exactly as the hub's own confirmation does
// (status, buyer notification, replacement-case hook, email).
async function submitProof({ token, files, courierName, note, ip, userAgent }) {
  const link = await loadLink(token);
  const state = stateOf(link);
  if (state === 'unknown') throw new ProofError('This link was not found.', 404);
  if (state === 'expired') throw new ProofError('This link has expired.', 410);
  if (state === 'not_shipped_yet') throw new ProofError('This parcel has not been shipped yet.', 409);
  if (!files || files.length === 0) throw new ProofError('Please add at least one photo.');
  const { rows: countRows } = await db.query('SELECT count(*) AS n FROM delivery_proofs WHERE shipment_id = $1', [link.shipment_id]);
  const existing = Number(countRows[0].n);
  if (existing + files.length > MAX_PHOTOS) throw new ProofError(`At most ${MAX_PHOTOS} photos can be added to one parcel (${existing} already added).`);

  const urls = [];
  for (const file of files) urls.push(await savePhoto(file));

  const name = clean(courierName, 80);
  const noteText = clean(note, 300);
  const client = await db.getPool().connect();
  let newlyDelivered = false;
  let orderId = link.order_id;
  try {
    await client.query('BEGIN');
    const { rows: shipmentRows } = await client.query('SELECT * FROM hub_shipments WHERE id = $1 FOR UPDATE', [link.shipment_id]);
    const shipment = shipmentRows[0];
    if (!['shipped_to_buyer', 'delivered'].includes(shipment.status)) throw new ProofError('This parcel has not been shipped yet.', 409);
    newlyDelivered = shipment.status === 'shipped_to_buyer';

    for (let i = 0; i < urls.length; i += 1) {
      await client.query(
        `INSERT INTO delivery_proofs (shipment_id, photo_url, courier_name, note, submitted_ip, user_agent, marked_delivered) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [shipment.id, urls[i], name, noteText, ip ? String(ip).slice(0, 64) : null, userAgent ? String(userAgent).slice(0, 300) : null, newlyDelivered && i === 0]
      );
    }
    if (newlyDelivered) {
      await client.query(
        `UPDATE hub_shipments SET status = 'delivered', delivered_at = now(), delivery_confirmed_by = 'courier_link', delivery_note = $1, updated_at = now() WHERE id = $2`,
        [`Delivery confirmed by the courier through the label link${name ? ` (${name})` : ''}, with ${urls.length} photo${urls.length === 1 ? '' : 's'}.`, shipment.id]
      );
      const { rows: orderRows } = await client.query('SELECT buyer_id FROM orders WHERE id = $1', [orderId]);
      await createNotification({ userId: orderRows[0]?.buyer_id, type: 'order_status', ...messages.orderDelivered(orderId), linkType: 'order', linkId: orderId }, client);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  if (newlyDelivered) {
    await faultCases.onShipmentDelivered(link.sub_order_id); // a delivered REPLACEMENT is noted on its fault case
    sendDeliveredEmail(orderId); // best-effort, never awaited by the response
  }
  return { delivered: newlyDelivered, orderId, photoCount: existing + urls.length };
}

function sendDeliveredEmail(orderId) {
  (async () => {
    try {
      const { rows: orderRows } = await db.query('SELECT buyer_id, guest_email FROM orders WHERE id = $1', [orderId]);
      let recipientEmail = orderRows[0]?.guest_email || null;
      let recipientName = null;
      if (orderRows[0]?.buyer_id) {
        const { rows: userRows } = await db.query('SELECT email, name FROM users WHERE id = $1', [orderRows[0].buyer_id]);
        if (userRows.length > 0) { recipientEmail = userRows[0].email; recipientName = userRows[0].name; }
      }
      if (recipientEmail) {
        const lang = await emailLanguageForAddress(recipientEmail);
        const { html, text } = deliveryNotificationEmail({ recipientName, orderId, lang });
        await sendTransactionalEmail({ to: recipientEmail, subject: emailSubject('orderDelivered', lang, { orderId }), html, text, fallbackLogLabel: 'order-delivered-courier-link' });
      }
    } catch (err) {
      console.error('Courier-link delivery email failed (non-fatal):', err.message);
    }
  })();
}

// The proof photos of one shipment, for the order data. The ADMIN also sees who sent them and the note; the BUYER sees the photos and when. The
// courier's IP address and device are recorded but shown to nobody here.
async function loadProofForShipment(shipmentId, { forAdmin }, client = db) {
  const { rows } = await client.query(
    'SELECT photo_url, courier_name, note, submitted_at FROM delivery_proofs WHERE shipment_id = $1 ORDER BY submitted_at ASC, id ASC', [shipmentId]
  );
  if (rows.length === 0) return null;
  return {
    source: 'courier_link',
    verified: false, // anyone holding the label's link could have sent these: they are evidence, not a guarantee
    photos: rows.map((r) => (forAdmin
      ? { url: r.photo_url, submittedAt: r.submitted_at, courierName: r.courier_name, note: r.note }
      : { url: r.photo_url, submittedAt: r.submitted_at })),
  };
}

module.exports = {
  ProofError, MAX_PHOTOS, LINK_VALID_DAYS, TOKEN_PATTERN,
  ensureProofLink, proofUrl, describeLink, submitProof, loadProofForShipment, stateOf, loadLink,
};
