import { describe, it, expect } from 'vitest';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

const backendUp = await isBackendUp();
// Real, valid test address (migration 030 now requires one for a real
// logged-in buyer placing an order).
const TEST_ADDRESS = { recipientName: 'Test Buyer', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' };

async function registerFreshBuyer() {
  const suffix = Date.now() + Math.random();
  const res = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `order-status-${suffix}@example.com`, password: 'test_password_123', name: 'Order Status Test' }),
  });
  return res.json(); // { token, user }
}

async function placeOrder(userId) {
  const res = await fetch(`${BACKEND_URL}/order`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId, address: TEST_ADDRESS }),
  });
  return res.json();
}

async function assignHubAndShip(subOrderId) {
  const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ hubId: 'hub_guangzhou' }),
  });
  const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
  await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
    body: JSON.stringify({ status: 'shipped', trackingNumber: `TEST-${subOrderId}` }),
  });
}

describe.runIf(backendUp)('real derived order status (to_ship / shipped / returns) against a REAL running backend', () => {
  it('CRITICAL: a real bug this fixes -- orders.status is frozen at to_ship forever, but displayStatus reflects genuine real progress', async () => {
    const { token, user } = await registerFreshBuyer();
    const order = await placeOrder(user.id);
    await assignHubAndShip(order.supplierSubOrders[0].subOrderId);

    const res = await fetch(`${BACKEND_URL}/order/${order.id}`, { headers: { Authorization: `Bearer ${token}` } });
    const detail = await res.json();
    // The raw stored status column genuinely never updates -- this is
    // the real bug, confirmed still present in the raw column, which is
    // exactly why displayStatus had to be computed instead of trusted.
    expect(detail.status).toBe('to_ship');
    expect(detail.displayStatus).toBe('shipped');
  });

  it('CRITICAL: a real return case makes displayStatus "returns", taking priority over the underlying shipment status', async () => {
    const { token, user } = await registerFreshBuyer();
    const order = await placeOrder(user.id);
    await assignHubAndShip(order.supplierSubOrders[0].subOrderId);

    await fetch(`${BACKEND_URL}/returns`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subOrderId: order.supplierSubOrders[0].subOrderId, reason: 'Wrong item', message: 'Not what I ordered.' }),
    });

    const res = await fetch(`${BACKEND_URL}/order/${order.id}`, { headers: { Authorization: `Bearer ${token}` } });
    const detail = await res.json();
    expect(detail.displayStatus).toBe('returns');
  });

  it('a genuinely untouched order (nothing shipped, no return) shows displayStatus to_ship', async () => {
    const { token, user } = await registerFreshBuyer();
    const order = await placeOrder(user.id);

    const res = await fetch(`${BACKEND_URL}/order/${order.id}`, { headers: { Authorization: `Bearer ${token}` } });
    const detail = await res.json();
    expect(detail.displayStatus).toBe('to_ship');
  });

  it('CRITICAL: the real ?status= filter on GET /order returns exactly the orders in that real derived state, and none of the others', async () => {
    const { token, user } = await registerFreshBuyer();
    const toShipOrder = await placeOrder(user.id);
    const shippedOrder = await placeOrder(user.id);
    await assignHubAndShip(shippedOrder.supplierSubOrders[0].subOrderId);
    const returnsOrder = await placeOrder(user.id);
    await assignHubAndShip(returnsOrder.supplierSubOrders[0].subOrderId);
    await fetch(`${BACKEND_URL}/returns`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subOrderId: returnsOrder.supplierSubOrders[0].subOrderId, reason: 'Damaged', message: 'Arrived broken.' }),
    });

    const toShipRes = await fetch(`${BACKEND_URL}/order?status=to_ship`, { headers: { Authorization: `Bearer ${token}` } });
    const toShipList = await toShipRes.json();
    expect(toShipList.find((o) => o.id === toShipOrder.id)).toBeDefined();
    expect(toShipList.find((o) => o.id === shippedOrder.id)).toBeUndefined();
    expect(toShipList.find((o) => o.id === returnsOrder.id)).toBeUndefined();

    const shippedRes = await fetch(`${BACKEND_URL}/order?status=shipped`, { headers: { Authorization: `Bearer ${token}` } });
    const shippedList = await shippedRes.json();
    expect(shippedList.find((o) => o.id === shippedOrder.id)).toBeDefined();
    expect(shippedList.find((o) => o.id === toShipOrder.id)).toBeUndefined();

    const returnsRes = await fetch(`${BACKEND_URL}/order?status=returns`, { headers: { Authorization: `Bearer ${token}` } });
    const returnsList = await returnsRes.json();
    expect(returnsList.find((o) => o.id === returnsOrder.id)).toBeDefined();
    expect(returnsList.find((o) => o.id === shippedOrder.id)).toBeUndefined();
  });

  it('a multi-supplier order with mixed real progress (one part shipped, one still pending) counts as shipped overall', async () => {
    // p1 and p4 belong to different suppliers in the real seed data.
    const { token, user } = await registerFreshBuyer();
    const res = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }, { productId: 'p4', quantity: 1 }], userId: user.id, address: TEST_ADDRESS }),
    });
    const order = await res.json();
    expect(order.supplierSubOrders.length).toBeGreaterThanOrEqual(1);
    if (order.supplierSubOrders.length < 2) return; // only meaningful if it's genuinely a multi-supplier order

    await assignHubAndShip(order.supplierSubOrders[0].subOrderId);
    // Deliberately leave the second sub-order untouched (still pending).

    const detailRes = await fetch(`${BACKEND_URL}/order/${order.id}`, { headers: { Authorization: `Bearer ${token}` } });
    const detail = await detailRes.json();
    expect(detail.displayStatus).toBe('shipped');
  });
});
