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
const { getHubAddressRow } = require('../addressEnglish/helpers');

/**
 * Delivery proof from the COURIER (migration 096). See db/migrations/096_delivery_proof.sql for the idea and why the link is guarded.
 *
 *   state of a link:  unknown        no such link
 *                     expired        past its 60 days
 *                     not_shipped_yet  the hub has not shipped the parcel (so the link does nothing yet)
 *                     ready          shipped, awaiting delivery: the first upload marks it DELIVERED
 *                     delivered      already delivered (by the hub, the carrier or an earlier upload): uploads only ADD photos
 *
 * Migration 120 adds, for a parcel that is awaiting delivery: it is confirmed with the BUYER'S 4-digit code (5 wrong codes lock it for 15
 * minutes), who received it and, when the phone allows, where. A courier who cannot deliver records why.
 * Migration 121: NO sign-in. Whoever carries the parcel scans the label and asks the buyer for the code, face to face; the code is the proof.
 * The courier may type their name and phone (optional) so Leap knows who delivered.
 */
const MAX_PHOTOS = 8;
const MIN_DIMENSION_PX = 400; // a real phone photo is far larger; this only refuses thumbnails and screenshots of icons
const LINK_VALID_DAYS = 60;
const UPLOAD_DIR = path.join(__dirname, '../../../uploads');

class ProofError extends Error {
  constructor(message, status = 400, code) { super(message); this.status = status; if (code) this.code = code; }
}

const RECEIVED_BY = ['buyer', 'family', 'reception']; // 'door' only on older proofs: the code is given face to face now
const ATTEMPT_COOLDOWN_HOURS = 3; // one "couldn't deliver" per parcel in this time, so nobody can flood the buyer with false reports
const ATTEMPT_REASONS = ['not_home', 'wrong_address', 'refused', 'other'];
const MAX_CODE_FAILURES = 5;
const CODE_LOCK_MINUTES = 15;
const newBuyerCode = () => String(crypto.randomInt(0, 10000)).padStart(4, '0');

const proofUrl = (token) => `${publicBaseUrl()}/p/${token}`;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;

// One link per shipment. Safe to call again: the existing one is kept (a printed label must keep working). It also holds the BUYER'S CODE
// (migration 120); a link made before that gets its code the first time it is needed.
async function ensureProofLink(shipmentId, client = db) {
  const token = crypto.randomBytes(32).toString('base64url');
  await client.query(
    `INSERT INTO delivery_proof_links (shipment_id, token, expires_at, buyer_code) VALUES ($1, $2, now() + ($3 || ' days')::interval, $4) ON CONFLICT (shipment_id) DO NOTHING`,
    [shipmentId, token, String(LINK_VALID_DAYS), newBuyerCode()]
  );
  await client.query('UPDATE delivery_proof_links SET buyer_code = $2 WHERE shipment_id = $1 AND buyer_code IS NULL', [shipmentId, newBuyerCode()]);
  const { rows } = await client.query('SELECT token, expires_at, buyer_code FROM delivery_proof_links WHERE shipment_id = $1', [shipmentId]);
  return { token: rows[0].token, expiresAt: rows[0].expires_at, url: proofUrl(rows[0].token), buyerCode: rows[0].buyer_code };
}

// The code the BUYER gives the driver. Only for the buyer's own order page, and only while the parcel is on its way to them.
async function buyerCodeForShipment(shipmentId) {
  return (await ensureProofLink(shipmentId)).buyerCode;
}

const maskPhone = (phone) => {
  const s = String(phone || '').trim();
  return s.length <= 5 ? s : `${s.slice(0, 2)}${'•'.repeat(Math.max(3, s.length - 5))}${s.slice(-3)}`;
};

// What the courier sees after scanning, to check they are at the right door. The same as the label on the parcel already shows (name, city,
// street, order, parcel "1 of 2"), and the phone only partly.
async function parcelDetails(link) {
  const addr = await getHubAddressRow(link.order_id);
  const { rows: siblings } = await db.query(
    'SELECT hs.id FROM hub_shipments hs JOIN supplier_sub_orders so ON so.id = hs.sub_order_id WHERE so.order_id = $1 ORDER BY hs.id ASC', [link.order_id]
  );
  return {
    orderId: link.order_id,
    index: siblings.findIndex((s) => String(s.id) === String(link.shipment_id)) + 1,
    total: siblings.length,
    recipientName: addr ? addr.recipient_name : null,
    phone: addr ? maskPhone(addr.phone) : null,
    city: addr ? addr.city : null,
    street: addr ? addr.street_address : null,
  };
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
  const info = { state, orderId: link.order_id, photoCount: Number(rows[0].n), maxPhotos: MAX_PHOTOS };
  if (state === 'ready') info.parcel = await parcelDetails(link); // only while it is awaiting delivery
  return info;
}

const cleanNumber = (value, min, max) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const readLocation = ({ latitude, longitude, accuracy }) => {
  const lat = cleanNumber(latitude, -90, 90);
  const lng = cleanNumber(longitude, -180, 180);
  return lat === null || lng === null ? { lat: null, lng: null, accuracy: null } : { lat, lng, accuracy: cleanNumber(accuracy, 0, 100000) };
};

// Checks the buyer's code (its own small transaction, so a wrong guess is counted even though nothing else is saved).
async function checkBuyerCode(shipmentId, code) {
  await ensureProofLink(shipmentId);
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT buyer_code, code_failures, code_locked_until, code_locked_until > now() AS locked FROM delivery_proof_links WHERE shipment_id = $1 FOR UPDATE', [shipmentId]
    );
    const link = rows[0];
    if (link.locked) {
      await client.query('COMMIT');
      const minutes = Math.max(1, Math.ceil((new Date(link.code_locked_until) - Date.now()) / 60000));
      throw new ProofError(`Too many wrong codes. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`, 429, 'code_locked');
    }
    const typed = typeof code === 'string' ? code.trim() : '';
    if (!/^\d{4}$/.test(typed) || typed !== link.buyer_code) {
      const failures = link.code_failures + 1;
      if (failures >= MAX_CODE_FAILURES) {
        await client.query(`UPDATE delivery_proof_links SET code_failures = 0, code_locked_until = now() + ($2 || ' minutes')::interval WHERE shipment_id = $1`, [shipmentId, String(CODE_LOCK_MINUTES)]);
        await client.query('COMMIT');
        throw new ProofError(`Wrong code. Too many wrong codes: try again in ${CODE_LOCK_MINUTES} minutes.`, 429, 'code_locked');
      }
      await client.query('UPDATE delivery_proof_links SET code_failures = $2 WHERE shipment_id = $1', [shipmentId, failures]);
      await client.query('COMMIT');
      const err = new ProofError(typed ? 'Wrong code. Ask the buyer for the 4-digit code shown in their order.' : "Enter the buyer's 4-digit code.", 400, 'wrong_code');
      err.triesLeft = MAX_CODE_FAILURES - failures;
      throw err;
    }
    await client.query('UPDATE delivery_proof_links SET code_failures = 0, code_locked_until = NULL WHERE shipment_id = $1', [shipmentId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
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

// The DRIVER sends photos. Stores them; and if the parcel was awaiting delivery (which needs the buyer's code and who received it), marks it
// DELIVERED exactly as the hub's own confirmation does (status, buyer notification, replacement-case hook, email).
async function submitProof({ token, files, driver = null, courierName, courierPhone, code, receivedBy, note, latitude, longitude, accuracy, ip, userAgent }) {
  const link = await loadLink(token);
  const state = stateOf(link);
  if (state === 'unknown') throw new ProofError('This link was not found.', 404);
  if (state === 'expired') throw new ProofError('This link has expired.', 410);
  if (state === 'not_shipped_yet') throw new ProofError('This parcel has not been shipped yet.', 409);
  if (!files || files.length === 0) throw new ProofError('Please add at least one photo.');
  const received = typeof receivedBy === 'string' && RECEIVED_BY.includes(receivedBy) ? receivedBy : null;
  if (state === 'ready') {
    if (!received) throw new ProofError('Choose who received the parcel.', 400, 'received_by_required');
    await checkBuyerCode(link.shipment_id, code); // throws on a wrong code (and counts it)
  }
  const where = readLocation({ latitude, longitude, accuracy });
  const { rows: countRows } = await db.query('SELECT count(*) AS n FROM delivery_proofs WHERE shipment_id = $1', [link.shipment_id]);
  const existing = Number(countRows[0].n);
  if (existing + files.length > MAX_PHOTOS) throw new ProofError(`At most ${MAX_PHOTOS} photos can be added to one parcel (${existing} already added).`);

  const urls = [];
  for (const file of files) urls.push(await savePhoto(file));

  const name = driver ? `${driver.name} (${driver.company})`.slice(0, 120) : clean(courierName, 80);
  const phone = driver ? driver.phone : clean(courierPhone, 30);
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
        `INSERT INTO delivery_proofs (shipment_id, photo_url, courier_name, courier_phone, note, submitted_ip, user_agent, marked_delivered, driver_id, received_by, code_verified, latitude, longitude, location_accuracy_m)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [shipment.id, urls[i], name, phone, noteText, ip ? String(ip).slice(0, 64) : null, userAgent ? String(userAgent).slice(0, 300) : null, newlyDelivered && i === 0,
          driver ? driver.id : null, received, newlyDelivered, where.lat, where.lng, where.accuracy]
      );
    }
    if (newlyDelivered) {
      await client.query(
        `UPDATE hub_shipments SET status = 'delivered', delivered_at = now(), delivery_confirmed_by = 'courier_link', delivery_note = $1, updated_at = now() WHERE id = $2`,
        [`Delivery confirmed with the buyer's code${name ? ` by ${name}` : ''}, with ${urls.length} photo${urls.length === 1 ? '' : 's'}.`, shipment.id]
      );
      const { rows: orderRows } = await client.query('SELECT buyer_id FROM orders WHERE id = $1', [orderId]);
      // confirmed with the buyer's code: tell them at once, so a code given away by mistake is reported within minutes
      await createNotification({ userId: orderRows[0]?.buyer_id, type: 'order_status', ...deliveredWithCodeMessage(orderId), linkType: 'order', linkId: orderId }, client);
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

function deliveredWithCodeMessage(orderId) {
  return {
    title: 'Your order has been delivered',
    body: `Order ${orderId} was delivered and confirmed with your code. If you did not receive it, open the order and tap "This isn't my parcel".`,
    titleAr: 'تم تسليم طلبك',
    bodyAr: `تم تسليم الطلب ${orderId} وتأكيده برمزك. إذا لم تستلمه، افتح الطلب واضغط "ليست طردي".`,
  };
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

// The proof photos of one shipment, for the order data. The ADMIN (and the hub) also see the driver, the note and where it was delivered; the
// BUYER sees the photos, when, who received it and whether their code was used. The IP address and device are recorded but shown to nobody here.
async function loadProofForShipment(shipmentId, { forAdmin }, client = db) {
  const { rows } = await client.query(
    `SELECT p.photo_url, p.courier_name, p.courier_phone, p.note, p.submitted_at, p.marked_delivered, p.received_by, p.code_verified, p.latitude, p.longitude, p.location_accuracy_m,
            d.name AS driver_name, d.company AS driver_company, d.phone AS driver_phone
     FROM delivery_proofs p LEFT JOIN delivery_drivers d ON d.id = p.driver_id
     WHERE p.shipment_id = $1 ORDER BY p.submitted_at ASC, p.id ASC`, [shipmentId]
  );
  if (rows.length === 0) return null;
  const main = rows.find((r) => r.marked_delivered) || rows[0];
  const proof = {
    source: 'courier_link',
    // true only when a signed-in driver confirmed it with the buyer's code (migration 120); older photos stay "not verified"
    verified: rows.some((r) => r.code_verified),
    receivedBy: main.received_by || null,
    deliveredAt: main.submitted_at,
    photos: rows.map((r) => (forAdmin
      ? { url: r.photo_url, submittedAt: r.submitted_at, courierName: r.courier_name, note: r.note }
      : { url: r.photo_url, submittedAt: r.submitted_at })),
  };
  if (forAdmin) {
    // who delivered: a driver account (migration 120) or, since 121, the name / phone the courier typed (both optional)
    proof.driver = main.driver_name ? { name: main.driver_name, company: main.driver_company, phone: main.driver_phone }
      : (main.courier_name || main.courier_phone) ? { name: main.courier_name || null, company: null, phone: main.courier_phone || null } : null;
    proof.location = main.latitude !== null && main.latitude !== undefined ? { latitude: main.latitude, longitude: main.longitude, accuracyM: main.location_accuracy_m } : null;
  }
  return proof;
}

// ---- "couldn't deliver" (migration 120)
const ATTEMPT_TEXT = {
  not_home: { en: 'Buyer not home / no answer', ar: 'المشتري غير موجود / لا يرد' },
  wrong_address: { en: 'Wrong or incomplete address', ar: 'العنوان خاطئ أو غير مكتمل' },
  refused: { en: 'Buyer refused the parcel', ar: 'رفض المشتري استلام الطرد' },
  other: { en: 'Other', ar: 'سبب آخر' },
};
const buyerAttemptMessage = (reason, orderId) => (reason === 'wrong_address'
  ? { title: "The driver couldn't find your address", body: `The driver couldn't find the address for order ${orderId}. Please check the address in your order; our team will contact you to arrange delivery.`,
    titleAr: 'لم يتمكن السائق من الوصول إلى عنوانك', bodyAr: `لم يتمكن السائق من الوصول إلى عنوان الطلب ${orderId}. يرجى التحقق من العنوان في طلبك، وسيتواصل معك فريقنا لترتيب التوصيل.` }
  : { title: "The driver couldn't deliver your order", body: `The driver came to deliver order ${orderId} but couldn't reach you. Our team will contact you to arrange a new delivery time.`,
    titleAr: 'لم يتمكن السائق من تسليم طلبك', bodyAr: `حضر السائق لتسليم الطلب ${orderId} لكنه لم يتمكن من الوصول إليك. سيتواصل معك فريقنا لترتيب موعد توصيل جديد.` });

async function recordAttempt({ token, driver = null, courierName, courierPhone, reason, note, file, latitude, longitude, accuracy }) {
  const link = await loadLink(token);
  const state = stateOf(link);
  if (state === 'unknown') throw new ProofError('This link was not found.', 404);
  if (state === 'expired') throw new ProofError('This link has expired.', 410);
  if (state === 'not_shipped_yet') throw new ProofError('This parcel has not been shipped yet.', 409);
  if (state === 'delivered') throw new ProofError('This parcel is already delivered.', 409);
  if (!ATTEMPT_REASONS.includes(reason)) throw new ProofError('Choose why the parcel could not be delivered.');
  const noteText = clean(note, 300);
  if (reason === 'other' && !noteText) throw new ProofError('Write a short note for "Other".');
  const { rows: recent } = await db.query(
    `SELECT 1 FROM delivery_attempts WHERE shipment_id = $1 AND created_at > now() - ($2 || ' hours')::interval LIMIT 1`, [link.shipment_id, String(ATTEMPT_COOLDOWN_HOURS)]
  );
  if (recent.length > 0) throw new ProofError(`A problem was already reported for this parcel in the last ${ATTEMPT_COOLDOWN_HOURS} hours. Leap will contact the buyer.`, 429, 'attempt_recently_reported');
  const who = driver ? `${driver.name} (${driver.company})` : [clean(courierName, 80), clean(courierPhone, 30)].filter(Boolean).join(', ') || null;
  const photoUrl = file ? await savePhoto(file) : null;
  const where = readLocation({ latitude, longitude, accuracy });
  const orderId = link.order_id;
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO delivery_attempts (shipment_id, driver_id, courier_name, courier_phone, reason, note, photo_url, latitude, longitude, location_accuracy_m) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [link.shipment_id, driver ? driver.id : null, driver ? driver.name : clean(courierName, 80), driver ? driver.phone : clean(courierPhone, 30), reason, noteText, photoUrl, where.lat, where.lng, where.accuracy]
    );
    // the buyer is told when it helps them (not home, wrong address); a refusal is for Leap to handle
    if (reason === 'not_home' || reason === 'wrong_address') {
      const { rows: orderRows } = await client.query('SELECT buyer_id FROM orders WHERE id = $1', [orderId]);
      await createNotification({ userId: orderRows[0]?.buyer_id, type: 'order_status', ...buyerAttemptMessage(reason, orderId), linkType: 'order', linkId: orderId }, client);
    }
    const { rows: admins } = await client.query("SELECT id FROM users WHERE role = 'admin' AND disabled_at IS NULL");
    const why = `${ATTEMPT_TEXT[reason].en}${noteText ? `: ${noteText}` : ''}`;
    for (const a of admins) {
      await createNotification({
        userId: a.id, type: 'order_status', title: `Delivery problem: order ${orderId}`, body: `${who ? `The courier (${who})` : 'The courier'} could not deliver. ${why}`,
        titleAr: `مشكلة في التوصيل: الطلب ${orderId}`, bodyAr: `لم يتمكن المندوب${who ? ` (${who})` : ''} من التسليم. ${ATTEMPT_TEXT[reason].ar}${noteText ? `: ${noteText}` : ''}`,
        linkType: 'order', linkId: orderId,
      }, client);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  return { recorded: true, orderId };
}

// Every "couldn't deliver" of one shipment, oldest first: for admin and the hub (the buyer only gets the latest one's reason).
async function loadAttemptsForShipment(shipmentId, client = db) {
  const { rows } = await client.query(
    `SELECT a.reason, a.note, a.photo_url, a.latitude, a.longitude, a.created_at, a.courier_name, a.courier_phone, d.name AS driver_name, d.company AS driver_company
     FROM delivery_attempts a LEFT JOIN delivery_drivers d ON d.id = a.driver_id WHERE a.shipment_id = $1 ORDER BY a.created_at ASC, a.id ASC`, [shipmentId]
  );
  return rows.map((r) => ({
    reason: r.reason, reasonText: ATTEMPT_TEXT[r.reason].en, note: r.note, photoUrl: r.photo_url, createdAt: r.created_at,
    driver: r.driver_name ? { name: r.driver_name, company: r.driver_company } : (r.courier_name || r.courier_phone) ? { name: r.courier_name || r.courier_phone, company: r.courier_name && r.courier_phone ? r.courier_phone : null } : null,
    location: r.latitude !== null ? { latitude: r.latitude, longitude: r.longitude } : null,
  }));
}

// For the BUYER's own order page: the code to give the driver (only while the parcel is on its way) and the latest "couldn't deliver", if any.
async function buyerDeliveryInfo(shipment) {
  const onItsWay = shipment.status === 'shipped_to_buyer';
  const { rows } = onItsWay
    ? await db.query('SELECT reason, created_at FROM delivery_attempts WHERE shipment_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1', [shipment.id])
    : { rows: [] };
  return {
    deliveryCode: onItsWay ? await buyerCodeForShipment(shipment.id) : null,
    lastDeliveryAttempt: rows[0] ? { reason: rows[0].reason, createdAt: rows[0].created_at } : null,
  };
}

module.exports = {
  buyerDeliveryInfo,
  ProofError, MAX_PHOTOS, LINK_VALID_DAYS, TOKEN_PATTERN, RECEIVED_BY, ATTEMPT_REASONS, MAX_CODE_FAILURES, CODE_LOCK_MINUTES, ATTEMPT_COOLDOWN_HOURS,
  ensureProofLink, proofUrl, describeLink, submitProof, loadProofForShipment, stateOf, loadLink,
  buyerCodeForShipment, recordAttempt, loadAttemptsForShipment, maskPhone,
};
