import { describe, it, expect } from 'vitest';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';
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

async function createSignedUpBuyer() {
  const suffix = Date.now() + Math.random();
  const res = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `live-tracking-test-${suffix}@example.com`, password: 'test_password_123' }),
  });
  return res.json();
}

describe.runIf(backendUp)('real live tracking timeline (hub milestones + carrier events) against a REAL running backend', () => {
  it('CRITICAL: an order with nothing shipped yet returns a genuinely empty timeline, not an error', async () => {
    const buyer = await createSignedUpBuyer();
    const order = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.user.id, address: TEST_ADDRESS }),
    }).then((r) => r.json());

    const res = await fetch(`${BACKEND_URL}/order/${order.id}/tracking`, { headers: { Authorization: `Bearer ${buyer.token}` } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subOrders[0].timeline).toEqual([]);
    expect(body.subOrders[0].hubTrackingNumber).toBeNull();
  });

  it('CRITICAL: real hub milestones show correctly, and the hub tracking number is used, never the supplier\'s domestic one', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const buyer = await createSignedUpBuyer();
    const order = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.user.id, address: TEST_ADDRESS }),
    }).then((r) => r.json());
    const subOrderId = order.supplierSubOrders[0].subOrderId;

    await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ hubId: 'hub_guangzhou' }),
    });
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ status: 'shipped', trackingNumber: `DOMESTIC-${Date.now()}` }),
    });

    const { token: hubToken } = await login('hub@leap.dev', 'hub_dev_password_123');
    const shipments = await fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: { Authorization: `Bearer ${hubToken}` } }).then((r) => r.json());
    const shipment = shipments.find((s) => s.orderId === order.id);
    for (const step of ['received', 'opened', 'inspected', 'packed']) {
      await fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/events`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hubToken}` },
        body: JSON.stringify({ step, photos: ['/uploads/test.jpg'] }),
      });
    }
    const finalLegTracking = `INTL-FINAL-${Date.now()}`;
    await fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/events`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hubToken}` },
      body: JSON.stringify({ step: 'shipped_to_buyer', photos: ['/uploads/test.jpg'], trackingNumber: finalLegTracking }),
    });

    const res = await fetch(`${BACKEND_URL}/order/${order.id}/tracking`, { headers: { Authorization: `Bearer ${buyer.token}` } });
    const body = await res.json();
    const subOrderResult = body.subOrders[0];
    expect(subOrderResult.hubTrackingNumber).toBe(finalLegTracking);
    expect(subOrderResult.timeline.map((e) => e.description)).toContain('Shipped to you');
    expect(subOrderResult.timeline.map((e) => e.description)).toContain('Received at hub');
  }, 20000);

  it('CRITICAL: a different buyer cannot see this order\'s real tracking', async () => {
    const buyer1 = await createSignedUpBuyer();
    const buyer2 = await createSignedUpBuyer();
    const order = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer1.user.id, address: TEST_ADDRESS }),
    }).then((r) => r.json());

    const res = await fetch(`${BACKEND_URL}/order/${order.id}/tracking`, { headers: { Authorization: `Bearer ${buyer2.token}` } });
    expect(res.status).toBe(404);
  });

  it('CRITICAL: an admin can see tracking for any real order, and a real guest order works with the correct email, rejected with the wrong one', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const buyer = await createSignedUpBuyer();
    const order = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.user.id, address: TEST_ADDRESS }),
    }).then((r) => r.json());
    const adminRes = await fetch(`${BACKEND_URL}/order/${order.id}/tracking`, { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(adminRes.status).toBe(200);

    const guestEmail = `live-tracking-guest-test-${Date.now()}@example.com`;
    const guestOrder = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], guestEmail }),
    }).then((r) => r.json());

    const correctEmail = await fetch(`${BACKEND_URL}/order/${guestOrder.id}/tracking?guestEmail=${guestEmail}`);
    expect(correctEmail.status).toBe(200);
    const wrongEmail = await fetch(`${BACKEND_URL}/order/${guestOrder.id}/tracking?guestEmail=wrong@example.com`);
    expect(wrongEmail.status).toBe(404);
  });
});
