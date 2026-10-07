// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import zlib from 'node:zlib';
import { Pool } from 'pg';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';
// Direct DB access for setup / inspection only (reading a link's token, ageing a link past its expiry), same approach as payouts.integration.test.js.
const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev';
const ENGLISH_ADDRESS = { recipientName: 'John Smith', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' };

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
const backendUp = await isBackendUp();

const json = { 'Content-Type': 'application/json' };
const auth = (token) => ({ ...json, Authorization: `Bearer ${token}` });
const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const ARABIC = /[\u0600-\u06FF]/;
const adminToken = async () => (await login('admin@leap.dev', 'admin_dev_password_123')).token;
const supplierToken = async () => (await login('supplier@leap.dev', 'supplier_dev_password_123')).token;
const hubToken = async () => (await login('hub@leap.dev', 'hub_dev_password_123')).token;
const pool = new Pool({ connectionString: TEST_DB_URL });
afterAll(async () => { await pool.end(); });

// ---- a real PNG of any size, generated here (no image files needed) ----
function crc32(buf) {
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n += 1) {
    let c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function makePng(w = 800, h = 600, seed = 1) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = (x + seed * 40) % 256; raw[o + 1] = y % 256; raw[o + 2] = (x + y) % 256; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// An order shipped by the supplier to the Guangzhou hub, received there, and (optionally) shipped on to the buyer.
async function createParcel({ shipToBuyer = true, guest = false } = {}) {
  const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `cp-buyer-${uniq()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
  const order = await fetch(`${BACKEND_URL}/order`, { method: 'POST', headers: json, body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.user.id, address: ENGLISH_ADDRESS }) }).then((r) => r.json());
  const subOrderId = order.supplierSubOrders[0].subOrderId;
  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, { method: 'PATCH', headers: auth(await adminToken()), body: JSON.stringify({ hubId: 'hub_guangzhou' }) });
  await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, { method: 'PATCH', headers: auth(await supplierToken()), body: JSON.stringify({ status: 'shipped' }) });
  const shipment = await hubShipmentOfSub(subOrderId);
  const parcel = { orderId: order.id, subOrderId, shipmentId: shipment.id, buyerToken: buyer.token, buyerId: buyer.user.id };
  for (const step of ['received', 'opened', 'inspected', 'packed']) expect((await record(shipment.id, step)).status).toBe(201);
  if (shipToBuyer) expect((await record(shipment.id, 'shipped_to_buyer', { trackingNumber: `HUB-CP-${uniq()}` })).status).toBe(201);
  return parcel;
}
const hubShipmentOfSub = async (subOrderId) => (await fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: auth(await hubToken()) }).then((r) => r.json())).find((s) => s.subOrderId === subOrderId);
const record = async (shipmentId, step, extra = {}) => fetch(`${BACKEND_URL}/hub/me/shipments/${shipmentId}/events`, { method: 'POST', headers: auth(await hubToken()), body: JSON.stringify({ step, photos: ['/uploads/test.jpg'], ...extra }) });
const printLabel = async (shipmentId) => {
  const res = await fetch(`${BACKEND_URL}/hub/me/shipments/${shipmentId}/address-label`, { headers: auth(await hubToken()) });
  const bytes = Buffer.from(await res.arrayBuffer());
  return { status: res.status, arrayBuffer: async () => bytes };
};
const tokenOf = async (shipmentId) => (await pool.query('SELECT token FROM delivery_proof_links WHERE shipment_id = $1', [shipmentId])).rows[0]?.token;
const shipmentRow = async (shipmentId) => (await pool.query('SELECT status, delivered_at, delivery_confirmed_by, delivery_note FROM hub_shipments WHERE id = $1', [shipmentId])).rows[0];
const proofCount = async (shipmentId) => Number((await pool.query('SELECT count(*) AS n FROM delivery_proofs WHERE shipment_id = $1', [shipmentId])).rows[0].n);

const stateOf = (token) => fetch(`${BACKEND_URL}/proof/${token}`).then((r) => r.json());
function formFor({ photos = [makePng()], name, note, types } = {}) {
  const form = new FormData();
  photos.forEach((buf, i) => form.append('photos', new Blob([buf], { type: types?.[i] || 'image/png' }), `photo-${i}.png`));
  if (name !== undefined) form.append('courierName', name);
  if (note !== undefined) form.append('note', note);
  return form;
}
const upload = (token, options) => fetch(`${BACKEND_URL}/proof/${token}`, { method: 'POST', body: formFor(options) });
const orderAs = (token, orderId) => fetch(`${BACKEND_URL}/order/${orderId}`, { headers: auth(token) }).then((r) => r.json());
const notificationsOf = (token, lang) => fetch(`${BACKEND_URL}/notifications/me${lang ? `?lang=${lang}` : ''}`, { headers: auth(token) }).then((r) => r.json());

describe.runIf(backendUp)('the courier\'s delivery link: photos AND delivery confirmation (real backend)', () => {
  it('the link is created when the label is printed (and the label still prints); the same label always has the same link; it is long and random', async () => {
    const p = await createParcel({ shipToBuyer: false });
    expect(await tokenOf(p.shipmentId)).toBeUndefined();
    const label = await printLabel(p.shipmentId);
    expect(label.status).toBe(200);
    expect(Buffer.from(await label.arrayBuffer()).subarray(0, 4).toString()).toBe('%PDF');
    const token = await tokenOf(p.shipmentId);
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    await printLabel(p.shipmentId); // printing again must NOT change the link: a label already on a parcel has to keep working
    expect(await tokenOf(p.shipmentId)).toBe(token);
    const other = await createParcel({ shipToBuyer: false });
    await printLabel(other.shipmentId);
    expect(await tokenOf(other.shipmentId)).not.toBe(token);
  }, 60000);

  it('CRITICAL: before the hub has SHIPPED the parcel the link does nothing: it says so, refuses photos, stores nothing and changes nothing', async () => {
    const p = await createParcel({ shipToBuyer: false });
    await printLabel(p.shipmentId);
    const token = await tokenOf(p.shipmentId);
    expect((await stateOf(token)).state).toBe('not_shipped_yet');
    const res = await upload(token);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/not been shipped/i);
    expect(await proofCount(p.shipmentId)).toBe(0);
    expect((await shipmentRow(p.shipmentId)).status).toBe('packed');
  }, 60000);

  it('CRITICAL: once shipped, a courier\'s photo marks the parcel DELIVERED; the buyer is told (both languages); admin sees the photos with who sent them; the buyer sees only the photos', async () => {
    const p = await createParcel();
    const token = await tokenOf(p.shipmentId); // created when the hub shipped it, even though no label was printed
    expect(token).toBeTruthy();
    expect(await stateOf(token)).toMatchObject({ state: 'ready', orderId: p.orderId, photoCount: 0, maxPhotos: 8 });

    const res = await upload(token, { photos: [makePng(800, 600, 1), makePng(640, 480, 2)], name: 'Omar the courier', note: 'Left with the doorman' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ delivered: true, photoCount: 2 });

    const row = await shipmentRow(p.shipmentId);
    expect(row).toMatchObject({ status: 'delivered', delivery_confirmed_by: 'courier_link' });
    expect(row.delivered_at).not.toBeNull();
    expect(row.delivery_note).toContain('Omar the courier');

    const en = (await notificationsOf(p.buyerToken)).find((n) => n.title === 'Your order has been delivered');
    expect(en.body).toBe(`Order ${p.orderId} is now delivered.`);
    expect((await notificationsOf(p.buyerToken, 'ar')).find((n) => n.id === en.id).title).toMatch(ARABIC);

    const admin = (await orderAs(await adminToken(), p.orderId)).supplierSubOrders[0].hubShipment.deliveryProof;
    expect(admin).toMatchObject({ source: 'courier_link', verified: false });
    expect(admin.photos).toHaveLength(2);
    expect(admin.photos[0]).toMatchObject({ courierName: 'Omar the courier', note: 'Left with the doorman' });

    const buyerBlob = JSON.stringify((await orderAs(p.buyerToken, p.orderId)).supplierSubOrders[0].hubShipment.deliveryProof);
    expect(JSON.parse(buyerBlob).photos).toHaveLength(2);
    for (const secret of ['Omar the courier', 'Left with the doorman', 'courierName', 'submitted_ip', 'userAgent']) expect(buyerBlob).not.toContain(secret);

    const photo = await fetch(`${BACKEND_URL}${admin.photos[0].url}`);
    expect(photo.status).toBe(200);
    expect(photo.headers.get('content-type')).toContain('image/');
  }, 60000);

  it('CRITICAL: a SECOND upload only adds photos: no second "delivered" notice, the delivery time does not move, and no more than 8 photos can ever be added', async () => {
    const p = await createParcel();
    const token = await tokenOf(p.shipmentId);
    await upload(token, { photos: [makePng()], name: 'First' });
    const firstDelivery = (await shipmentRow(p.shipmentId)).delivered_at;
    const notices = async () => (await notificationsOf(p.buyerToken)).filter((n) => n.title === 'Your order has been delivered').length;
    expect(await notices()).toBe(1);

    expect((await stateOf(token)).state).toBe('delivered');
    const more = await upload(token, { photos: [makePng(700, 500, 3), makePng(700, 500, 4)], name: 'Again' });
    expect(more.status).toBe(200);
    expect(await more.json()).toMatchObject({ delivered: false, photoCount: 3 });
    expect((await shipmentRow(p.shipmentId)).delivered_at).toEqual(firstDelivery);
    expect(await notices()).toBe(1);

    const six = await upload(token, { photos: Array.from({ length: 5 }, (_, i) => makePng(500, 500, i + 5)) });
    expect(six.status).toBe(200); // 3 + 5 = 8: exactly at the cap
    const over = await upload(token, { photos: [makePng()] });
    expect(over.status).toBe(400);
    expect((await over.json()).error).toMatch(/At most 8 photos/);
    expect(await proofCount(p.shipmentId)).toBe(8);
  }, 90000);

  it('refuses what is not a real, ordinary photo, and stores nothing when it does', async () => {
    const p = await createParcel();
    const token = await tokenOf(p.shipmentId);
    const empty = await fetch(`${BACKEND_URL}/proof/${token}`, { method: 'POST', body: new FormData() });
    expect(empty.status).toBe(400);
    expect((await empty.json()).error).toMatch(/at least one photo/i);

    const notImage = await upload(token, { photos: [Buffer.from('this is not an image at all')] }); // sent as image/png, but is text
    expect(notImage.status).toBe(400);
    expect((await notImage.json()).error).toMatch(/not a real photo/i);

    const wrongType = await upload(token, { photos: [makePng()], types: ['text/plain'] });
    expect(wrongType.status).toBe(400);
    expect((await wrongType.json()).error).toMatch(/Unsupported file type/);

    const tiny = await upload(token, { photos: [makePng(100, 100)] });
    expect(tiny.status).toBe(400);
    expect((await tiny.json()).error).toMatch(/too small/i);

    expect(await proofCount(p.shipmentId)).toBe(0);
    expect((await shipmentRow(p.shipmentId)).status).toBe('shipped_to_buyer'); // not delivered by any of the refusals
  }, 60000);

  it('unknown, malformed and EXPIRED links are refused (404 / 404 / 410), and the page for a bad link is a polite 404', async () => {
    expect((await fetch(`${BACKEND_URL}/proof/${'a'.repeat(43)}`)).status).toBe(200);          // well-formed but unknown: a normal answer...
    expect((await stateOf('a'.repeat(43))).state).toBe('unknown');                              // ...that says "unknown"
    expect((await upload('a'.repeat(43))).status).toBe(404);
    expect((await upload('short')).status).toBe(404);
    const bad = await fetch(`${BACKEND_URL}/p/..%2F..%2Fetc`);
    expect(bad.status).toBe(404);
    expect(bad.headers.get('content-type')).toContain('text/html');

    const p = await createParcel();
    const token = await tokenOf(p.shipmentId);
    await pool.query(`UPDATE delivery_proof_links SET expires_at = now() - interval '1 day' WHERE shipment_id = $1`, [p.shipmentId]);
    expect((await stateOf(token)).state).toBe('expired');
    const res = await upload(token);
    expect(res.status).toBe(410);
    expect(await proofCount(p.shipmentId)).toBe(0);
    expect((await shipmentRow(p.shipmentId)).status).toBe('shipped_to_buyer');
  }, 60000);

  it('a parcel the hub (or the carrier) already confirmed delivered can still receive photos, but nothing about its delivery changes', async () => {
    const p = await createParcel();
    const token = await tokenOf(p.shipmentId);
    expect((await fetch(`${BACKEND_URL}/hub/me/shipments/${p.shipmentId}/confirm-delivery`, { method: 'PATCH', headers: auth(await hubToken()), body: JSON.stringify({ deliveryNote: 'Carrier never updated' }) })).status).toBe(200);
    const before = await shipmentRow(p.shipmentId);
    expect((await stateOf(token)).state).toBe('delivered');

    const res = await upload(token, { photos: [makePng()], name: 'Late courier' });
    expect(res.status).toBe(200);
    expect((await res.json()).delivered).toBe(false);
    expect(await shipmentRow(p.shipmentId)).toEqual(before); // still "hub_manual", same time, same note
    expect((await notificationsOf(p.buyerToken)).filter((n) => n.title === 'Your order has been delivered')).toHaveLength(1);
  }, 60000);

  it('the page the courier sees is in English AND Arabic, has the photo form, and holds nothing about the order', async () => {
    const p = await createParcel();
    const token = await tokenOf(p.shipmentId);
    const res = await fetch(`${BACKEND_URL}/p/${token}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('cache-control')).toContain('no-store');
    const html = await res.text();
    expect(html).toContain('Delivery confirmation');
    expect(html).toMatch(ARABIC);
    expect(html).toContain('تأكيد التسليم');
    expect(html).toContain('capture="environment"');
    expect(html).toContain('noindex');
    expect(html).toContain(token);                 // it only needs the token to talk to the server
    expect(html).not.toContain(p.orderId);         // the order, the buyer and the address come from the API only when the link is valid
    expect(html).not.toContain('John Smith');
  }, 40000);

  it('CRITICAL: a delivered REPLACEMENT that the courier confirms completes its fault case (the delivery hook runs for this path too)', async () => {
    // an order, flagged by the hub, a fault case, the supplier says yes, the admin confirms a replacement
    const faulty = await createParcel({ shipToBuyer: false });
    expect((await record(faulty.shipmentId, 'flagged', { notes: 'Cracked', damageType: 'physical_damage' })).status).toBe(201);
    const admin = await adminToken();
    expect((await fetch(`${BACKEND_URL}/fault-cases`, { method: 'POST', headers: auth(admin), body: JSON.stringify({ shipmentId: faulty.shipmentId, items: ['p1'], costBearer: 'supplier' }) })).status).toBe(201);
    const caseId = (await fetch(`${BACKEND_URL}/hub/flagged`, { headers: auth(admin) }).then((r) => r.json())).find((q) => q.id === faulty.shipmentId).faultCase.id;
    const eta = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    expect((await fetch(`${BACKEND_URL}/fault-cases/supplier/me/${caseId}/answer`, { method: 'POST', headers: auth(await supplierToken()), body: JSON.stringify({ canReplace: true, eta }) })).status).toBe(200);
    expect((await fetch(`${BACKEND_URL}/fault-cases/${caseId}/confirm-replacement`, { method: 'POST', headers: auth(admin), body: JSON.stringify({}) })).status).toBe(200);
    const replacementOrderId = `${faulty.orderId}-R1`;

    // the supplier ships it, the hub takes it all the way to "shipped to the buyer"
    const subId = (await pool.query('SELECT id FROM supplier_sub_orders WHERE order_id = $1', [replacementOrderId])).rows[0].id;
    await fetch(`${BACKEND_URL}/supplier/me/orders/${subId}`, { method: 'PATCH', headers: auth(await supplierToken()), body: JSON.stringify({ status: 'shipped' }) });
    const shipment = await hubShipmentOfSub(subId);
    for (const step of ['received', 'opened', 'inspected', 'packed']) await record(shipment.id, step);
    await record(shipment.id, 'shipped_to_buyer', { trackingNumber: `HUB-RP-${uniq()}` });
    await record(faulty.shipmentId, 'returned_to_supplier', { trackingNumber: `RET-${uniq()}` }); // the faulty unit goes back

    const before = (await pool.query('SELECT status, replacement_delivered_at FROM fault_cases WHERE id = $1', [caseId])).rows[0];
    expect(before).toMatchObject({ status: 'replacement_pending', replacement_delivered_at: null });
    expect((await upload(await tokenOf(shipment.id), { name: 'Courier' })).status).toBe(200);
    const after = (await pool.query('SELECT status, replacement_delivered_at FROM fault_cases WHERE id = $1', [caseId])).rows[0];
    expect(after.status).toBe('completed');
    expect(after.replacement_delivered_at).not.toBeNull();
  }, 120000);

  it('a link allows only a limited number of attempts, so it cannot be hammered (the 21st attempt in ten minutes is a 429)', async () => {
    const p = await createParcel();
    const token = await tokenOf(p.shipmentId);
    let blockedAt = null;
    for (let attempt = 1; attempt <= 24; attempt += 1) {
      const res = await fetch(`${BACKEND_URL}/proof/${token}`, { method: 'POST', body: new FormData() }); // each is refused as "no photo", but each counts
      if (res.status === 429) { blockedAt = attempt; expect(res.headers.get('retry-after')).toBeTruthy(); break; }
      expect(res.status).toBe(400);
    }
    expect(blockedAt).toBe(21);
    expect(await proofCount(p.shipmentId)).toBe(0);
  }, 60000);
});
