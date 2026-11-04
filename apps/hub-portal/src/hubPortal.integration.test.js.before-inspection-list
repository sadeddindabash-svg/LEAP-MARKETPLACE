// @vitest-environment node
//
// Needs the real Node fetch/FormData/Blob implementations for genuine
// multipart evidence-photo uploads — same reason as
// supplier-portal/src/productSubmission.integration.test.js.
import { describe, it, expect } from 'vitest';
import { login, fetchMyShipments, fetchMyShipmentById, recordShipmentEvent, uploadEvidencePhoto } from './auth';

const BACKEND_URL = 'http://localhost:4000';

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function makeTestPng(widthPx, heightPx) {
  const zlib = await import('zlib');
  const width = widthPx, height = heightPx;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      raw.writeUInt8(120, rowStart + 1 + x * 3);
      raw.writeUInt8(80, rowStart + 1 + x * 3 + 1);
      raw.writeUInt8(200, rowStart + 1 + x * 3 + 2);
    }
  }
  const idat = zlib.deflateSync(raw);
  function crc32(buf) {
    let c;
    const table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c;
    }
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

async function uploadRealPhoto(token) {
  const buf = await makeTestPng(900, 850);
  const formData = new FormData();
  formData.append('image', new Blob([buf], { type: 'image/png' }), 'evidence.png');
  const res = await fetch(`${BACKEND_URL}/uploads/product-image`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
  });
  return res.json();
}

async function placeOrderShipToHub() {
  const orderRes = await fetch(`${BACKEND_URL}/order`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], guestEmail: `hubportal-e2e-${Date.now()}@example.com` }),
  });
  const order = await orderRes.json();
  const subOrderId = order.supplierSubOrders[0].subOrderId;

  const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ hubId: 'hub_guangzhou' }),
  });
  const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
  await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
    body: JSON.stringify({ status: 'shipped', trackingNumber: `T-${Date.now()}` }),
  });
  return { orderId: order.id, subOrderId };
}

const backendUp = await isBackendUp();

describe.runIf(backendUp)('Hub Portal against a REAL running backend — genuine multipart photo uploads', () => {
  it('CRITICAL: uploads a real evidence photo (via this app\'s own uploadEvidencePhoto helper) and it is genuinely served back', async () => {
    const { token } = await login('hub@leap.dev', 'hub_dev_password_123');
    const buf = await makeTestPng(900, 850);
    const file = new File([buf], 'evidence.png', { type: 'image/png' });
    const result = await uploadEvidencePhoto(token, file);
    expect(result.url).toMatch(/^\/uploads\//);

    const fileRes = await fetch(`${BACKEND_URL}${result.url}`);
    expect(fileRes.status).toBe(200);
  });

  it('rejects a too-small evidence photo, using this app\'s own upload helper', async () => {
    const { token } = await login('hub@leap.dev', 'hub_dev_password_123');
    const buf = await makeTestPng(300, 300);
    const file = new File([buf], 'too-small.png', { type: 'image/png' });
    await expect(uploadEvidencePhoto(token, file)).rejects.toThrow();
  });

  it('CRITICAL: the full real workflow using this app\'s own API helpers end-to-end -- fetchMyShipments finds it, fetchMyShipmentById shows it, recordShipmentEvent advances it through every real step with real uploaded photos', async () => {
    const { subOrderId, orderId } = await placeOrderShipToHub();
    const { token: hubToken } = await login('hub@leap.dev', 'hub_dev_password_123');

    const queue = await fetchMyShipments(hubToken);
    const shipment = queue.find((s) => s.subOrderId === subOrderId);
    expect(shipment).toBeDefined();
    expect(shipment.status).toBe('awaiting_receipt');

    const steps = ['received', 'opened', 'inspected', 'packed'];
    for (const step of steps) {
      const photo = await uploadRealPhoto(hubToken);
      const result = await recordShipmentEvent(hubToken, shipment.id, { step, notes: `${step} — real note`, photos: [photo.url] });
      expect(result.status).toBe(step);
    }

    const finalPhoto = await uploadRealPhoto(hubToken);
    const finalResult = await recordShipmentEvent(hubToken, shipment.id, {
      step: 'shipped_to_buyer', notes: 'final leg', photos: [finalPhoto.url], trackingNumber: 'HUBPORTAL-E2E-999',
    });
    expect(finalResult.status).toBe('shipped_to_buyer');

    const detail = await fetchMyShipmentById(hubToken, shipment.id);
    expect(detail.events.length).toBe(5);
    expect(detail.events.every((e) => e.photos.length > 0)).toBe(true);
    expect(detail.events[4].trackingNumber).toBe('HUBPORTAL-E2E-999');

    // Confirm the same real journey is visible from the admin side too —
    // proves this isn't a self-consistent mock, it's genuinely shared data.
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const orderDetailRes = await fetch(`${BACKEND_URL}/order/${orderId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const orderDetail = await orderDetailRes.json();
    const subOrder = orderDetail.supplierSubOrders.find((so) => so.subOrderId === subOrderId);
    expect(subOrder.hubShipment.status).toBe('shipped_to_buyer');
  });
});
