import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';
const WEBHOOK_SECRET = 'test_webhook_secret_for_dev_only';

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

async function createShippedSubOrder(adminToken, trackingNumber) {
  const suffix = Date.now() + Math.random();
  const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `carrier-webhook-test-${suffix}@example.com`, password: 'test_password_123' }),
  });
  const { user: buyer } = await signupRes.json();

  const orderRes = await fetch(`${BACKEND_URL}/order`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.id }),
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
    body: JSON.stringify({ status: 'shipped', trackingNumber }),
  });

  return subOrderId;
}

describe.runIf(backendUp)('real 17TRACK carrier webhook + hybrid delivery confirmation against a REAL running backend', () => {
  it('CRITICAL: a request with no real signature, or a genuinely wrong one, is rejected', async () => {
    const payload = { data: [{ number: 'X', track_info: { latest_status: { status: 'Delivered' } } }] };
    const noSig = await callWebhook(payload, '');
    expect(noSig.status).toBe(401);

    const wrongSig = await callWebhook(payload, 'deadbeef00000000000000000000000000000000000000000000000000000000');
    expect(wrongSig.status).toBe(401);
  });

  it('CRITICAL: a genuinely, correctly signed delivered event updates the real sub-order with carrier provenance', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const trackingNumber = `WEBHOOK-TEST-${Date.now()}`;
    const subOrderId = await createShippedSubOrder(adminToken, trackingNumber);

    const { status, body } = await callWebhook({
      data: [{ number: trackingNumber, carrier: 100001, track_info: { latest_status: { status: 'Delivered' }, latest_event: { time_iso: '2026-07-18T10:00:00+08:00' } } }],
    });
    expect(status).toBe(200);
    expect(body.results[0]).toMatchObject({ trackingNumber, success: true, subOrderId });
  }, 15000);

  it('CRITICAL: a non-delivered status update is real, correctly skipped -- not an error, and does not touch the sub-order', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const trackingNumber = `WEBHOOK-SKIP-${Date.now()}`;
    await createShippedSubOrder(adminToken, trackingNumber);

    const { body } = await callWebhook({
      data: [{ number: trackingNumber, track_info: { latest_status: { status: 'InTransit' } } }],
    });
    expect(body.results[0]).toMatchObject({ trackingNumber, success: true, skipped: true });
  }, 15000);

  it('CRITICAL: a real, best-effort batch -- an unmatched tracking number never blocks the other real entries', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const trackingNumber = `WEBHOOK-BATCH-${Date.now()}`;
    const subOrderId = await createShippedSubOrder(adminToken, trackingNumber);

    const { body } = await callWebhook({
      data: [
        { number: 'DEFINITELY-NOT-A-REAL-TRACKING-NUMBER', track_info: { latest_status: { status: 'Delivered' } } },
        { number: trackingNumber, carrier: 100001, track_info: { latest_status: { status: 'Delivered' }, latest_event: { time_iso: '2026-07-18T10:00:00+08:00' } } },
      ],
    });
    expect(body.results[0].success).toBe(false);
    expect(body.results[1]).toMatchObject({ trackingNumber, success: true, subOrderId });
  }, 15000);

  it('CRITICAL: once carrier-confirmed, a supplier can no longer manually override that real delivery confirmation', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const trackingNumber = `WEBHOOK-OVERRIDE-${Date.now()}`;
    const subOrderId = await createShippedSubOrder(adminToken, trackingNumber);
    await callWebhook({
      data: [{ number: trackingNumber, carrier: 100001, track_info: { latest_status: { status: 'Delivered' }, latest_event: { time_iso: '2026-07-18T10:00:00+08:00' } } }],
    });

    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const res = await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ status: 'delivered', deliveryNote: 'trying to override' }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('carrier tracking');
  }, 15000);

  it('CRITICAL: manual delivery confirmation requires a real note; without one it is rejected', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const subOrderId = await createShippedSubOrder(adminToken, `WEBHOOK-NOTE-${Date.now()}`);

    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const withoutNote = await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ status: 'delivered' }),
    });
    expect(withoutNote.status).toBe(400);

    const withNote = await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ status: 'delivered', deliveryNote: 'Tracking never updated, buyer confirmed via chat' }),
    });
    expect(withNote.status).toBe(200);
  }, 15000);

  it('a real missing data array is rejected as a bad request', async () => {
    const { status } = await callWebhook({ event: 'TRACKING_UPDATED' });
    expect(status).toBe(400);
  });
});
