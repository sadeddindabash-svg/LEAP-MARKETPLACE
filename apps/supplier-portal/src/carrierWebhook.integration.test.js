import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';
const WEBHOOK_SECRET = 'test_webhook_secret_for_dev_only';
// Real, valid test address (migration 030 now requires one for a real
// logged-in buyer placing an order).
const TEST_ADDRESS = { recipientName: 'Test Buyer', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' };

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

const backendUp = await isBackendUp();

function signPayload(payloadString) {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(payloadString).digest('hex');
}

async function callWebhook(payload, signature) {
  const payloadString = JSON.stringify(payload);
  const res = await fetch(`${BACKEND_URL}/webhooks/17track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Sign: signature !== undefined ? signature : signPayload(payloadString) },
    body: payloadString,
  });
  return { status: res.status, body: await res.json() };
}

// CONFIRMED (migration 027): a supplier in this real business ships
// locally within China, hub to hub -- their own tracking number only
// ever covers that domestic Supplier -> Hub leg. The real final leg
// that actually reaches the buyer is the HUB's own shipment, using the
// hub's OWN tracking number -- that's the real one the carrier webhook
// must match against, not the supplier's.
async function createShipmentAwaitingFinalLeg(adminToken) {
  const suffix = Date.now() + Math.random();
  const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `carrier-webhook-test-${suffix}@example.com`, password: 'test_password_123' }),
  });
  const { user: buyer } = await signupRes.json();

  const orderRes = await fetch(`${BACKEND_URL}/order`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.id, address: TEST_ADDRESS }),
  });
  const order = await orderRes.json();
  const subOrderId = order.supplierSubOrders[0].subOrderId;

  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ hubId: 'hub_guangzhou' }),
  });
  const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
  await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
    body: JSON.stringify({ status: 'shipped', trackingNumber: `DOMESTIC-CN-${suffix}` }),
  });

  const { token: hubToken } = await login('hub@leap.dev', 'hub_dev_password_123');
  const shipmentRows = await fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: { Authorization: `Bearer ${hubToken}` } }).then((r) => r.json());
  const shipment = shipmentRows.find((s) => s.orderId === order.id);
  for (const step of ['received', 'opened', 'inspected', 'packed']) {
    await fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/events`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hubToken}` },
      body: JSON.stringify({ step, photos: ['/uploads/test.jpg'] }),
    });
  }
  const hubTrackingNumber = `INTL-FINAL-LEG-${suffix}`;
  await fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/events`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hubToken}` },
    body: JSON.stringify({ step: 'shipped_to_buyer', photos: ['/uploads/test.jpg'], trackingNumber: hubTrackingNumber }),
  });

  return { hubShipmentId: shipment.id, hubTrackingNumber, hubToken };
}

describe.runIf(backendUp)('real 17TRACK carrier webhook + hub-based delivery confirmation against a REAL running backend', () => {
  it('CRITICAL: a request with no real signature, or a genuinely wrong one, is rejected', async () => {
    const payload = { data: [{ number: 'X', track_info: { latest_status: { status: 'Delivered' } } }] };
    const noSig = await callWebhook(payload, '');
    expect(noSig.status).toBe(401);

    const wrongSig = await callWebhook(payload, 'deadbeef00000000000000000000000000000000000000000000000000000000');
    expect(wrongSig.status).toBe(401);
  });

  it('CRITICAL: a genuinely, correctly signed delivered event updates the real HUB shipment (not the supplier\'s own record) with carrier provenance', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const { hubShipmentId, hubTrackingNumber } = await createShipmentAwaitingFinalLeg(adminToken);

    const { status, body } = await callWebhook({
      data: [{ number: hubTrackingNumber, carrier: 100001, track_info: { latest_status: { status: 'Delivered' }, latest_event: { time_iso: '2026-07-18T10:00:00+08:00' } } }],
    });
    expect(status).toBe(200);
    expect(body.results[0]).toMatchObject({ trackingNumber: hubTrackingNumber, success: true, hubShipmentId });
  }, 20000);

  it('CRITICAL: the webhook does NOT match against the real supplier\'s own domestic tracking number -- only the real hub\'s final-leg one', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const suffix = Date.now() + Math.random();
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `carrier-webhook-test-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { user: buyer } = await signupRes.json();
    const orderRes = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.id, address: TEST_ADDRESS }),
    });
    const order = await orderRes.json();
    const subOrderId = order.supplierSubOrders[0].subOrderId;
    const domesticTrackingNumber = `DOMESTIC-ONLY-${suffix}`;

    await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ hubId: 'hub_guangzhou' }),
    });
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ status: 'shipped', trackingNumber: domesticTrackingNumber }),
    });

    const { body } = await callWebhook({
      data: [{ number: domesticTrackingNumber, carrier: 100001, track_info: { latest_status: { status: 'Delivered' } } }],
    });
    expect(body.results[0].success).toBe(false);
  }, 15000);

  it('CRITICAL: a non-delivered status update is real, correctly skipped -- not an error', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const { hubTrackingNumber } = await createShipmentAwaitingFinalLeg(adminToken);

    const { body } = await callWebhook({
      data: [{ number: hubTrackingNumber, track_info: { latest_status: { status: 'InTransit' } } }],
    });
    expect(body.results[0]).toMatchObject({ trackingNumber: hubTrackingNumber, success: true, skipped: true });
  }, 20000);

  it('CRITICAL: a real, best-effort batch -- an unmatched tracking number never blocks the other real entries', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const { hubShipmentId, hubTrackingNumber } = await createShipmentAwaitingFinalLeg(adminToken);

    const { body } = await callWebhook({
      data: [
        { number: 'DEFINITELY-NOT-A-REAL-TRACKING-NUMBER', track_info: { latest_status: { status: 'Delivered' } } },
        { number: hubTrackingNumber, carrier: 100001, track_info: { latest_status: { status: 'Delivered' }, latest_event: { time_iso: '2026-07-18T10:00:00+08:00' } } },
      ],
    });
    expect(body.results[0].success).toBe(false);
    expect(body.results[1]).toMatchObject({ trackingNumber: hubTrackingNumber, success: true, hubShipmentId });
  }, 20000);

  it('CRITICAL: once carrier-confirmed, the hub can no longer manually override that real delivery confirmation', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const { hubShipmentId, hubTrackingNumber, hubToken } = await createShipmentAwaitingFinalLeg(adminToken);
    await callWebhook({
      data: [{ number: hubTrackingNumber, carrier: 100001, track_info: { latest_status: { status: 'Delivered' }, latest_event: { time_iso: '2026-07-18T10:00:00+08:00' } } }],
    });

    const res = await fetch(`${BACKEND_URL}/hub/me/shipments/${hubShipmentId}/confirm-delivery`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hubToken}` },
      body: JSON.stringify({ deliveryNote: 'trying to override' }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('carrier tracking');
  }, 20000);

  it('CRITICAL: manual delivery confirmation (by the hub) requires a real note; without one it is rejected', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const { hubShipmentId, hubToken } = await createShipmentAwaitingFinalLeg(adminToken);

    const withoutNote = await fetch(`${BACKEND_URL}/hub/me/shipments/${hubShipmentId}/confirm-delivery`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hubToken}` },
      body: JSON.stringify({}),
    });
    expect(withoutNote.status).toBe(400);

    const withNote = await fetch(`${BACKEND_URL}/hub/me/shipments/${hubShipmentId}/confirm-delivery`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hubToken}` },
      body: JSON.stringify({ deliveryNote: 'Tracking never updated, buyer confirmed via chat' }),
    });
    expect(withNote.status).toBe(200);
  }, 20000);

  it('CRITICAL: a supplier can no longer set status to \'delivered\' at all -- that real ability moved to the hub', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const suffix = Date.now() + Math.random();
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `carrier-webhook-test-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { user: buyer } = await signupRes.json();
    const orderRes = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.id, address: TEST_ADDRESS }),
    });
    const order = await orderRes.json();
    const subOrderId = order.supplierSubOrders[0].subOrderId;
    await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ hubId: 'hub_guangzhou' }),
    });

    const res = await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ status: 'delivered' }),
    });
    expect(res.status).toBe(400);
  });

  it('a real missing data array is rejected as a bad request', async () => {
    const { status } = await callWebhook({ event: 'TRACKING_UPDATED' });
    expect(status).toBe(400);
  });
});
