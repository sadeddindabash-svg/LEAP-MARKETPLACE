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

async function createSignedUpBuyer(emailOverride) {
  const suffix = Date.now() + Math.random();
  const email = emailOverride || `order-lifecycle-test-${suffix}@example.com`;
  const res = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'test_password_123' }),
  });
  return { ...(await res.json()), email };
}

async function placeOrder({ userId, guestEmail }) {
  const res = await fetch(`${BACKEND_URL}/order`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId, guestEmail }),
  });
  return res.json();
}

describe.runIf(backendUp)('real order cancellation + real guest-to-account conversion against a REAL running backend', () => {
  it('CRITICAL: a buyer can cancel their own real order while it is still pending', async () => {
    const buyer = await createSignedUpBuyer();
    const order = await placeOrder({ userId: buyer.user.id });

    const res = await fetch(`${BACKEND_URL}/order/${order.id}/cancel`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}` },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('cancelled');
  });

  it('CRITICAL: cancelling an already-cancelled order is rejected', async () => {
    const buyer = await createSignedUpBuyer();
    const order = await placeOrder({ userId: buyer.user.id });
    await fetch(`${BACKEND_URL}/order/${order.id}/cancel`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}` },
      body: JSON.stringify({}),
    });

    const secondAttempt = await fetch(`${BACKEND_URL}/order/${order.id}/cancel`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}` },
      body: JSON.stringify({}),
    });
    expect(secondAttempt.status).toBe(400);
  });

  it('CRITICAL: once a real sub-order has shipped, cancellation is rejected with a clear message', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const buyer = await createSignedUpBuyer();
    const order = await placeOrder({ userId: buyer.user.id });
    const subOrderId = order.supplierSubOrders[0].subOrderId;

    await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ hubId: 'hub_guangzhou' }),
    });
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ status: 'shipped' }),
    });

    const res = await fetch(`${BACKEND_URL}/order/${order.id}/cancel`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}` },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('already shipped');
  }, 15000);

  it('CRITICAL: a real guest order can be cancelled with the correct guest email, and is rejected with the wrong one', async () => {
    const guestEmail = `order-lifecycle-guest-test-${Date.now()}@example.com`;
    const order = await placeOrder({ guestEmail });

    const wrongEmail = await fetch(`${BACKEND_URL}/order/${order.id}/cancel`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestEmail: 'wrong@example.com' }),
    });
    expect(wrongEmail.status).toBe(404);

    const rightEmail = await fetch(`${BACKEND_URL}/order/${order.id}/cancel`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestEmail }),
    });
    expect(rightEmail.status).toBe(200);
  });

  it('CRITICAL: a different buyer cannot cancel someone else\'s real order', async () => {
    const buyer1 = await createSignedUpBuyer();
    const buyer2 = await createSignedUpBuyer();
    const order = await placeOrder({ userId: buyer1.user.id });

    const res = await fetch(`${BACKEND_URL}/order/${order.id}/cancel`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer2.token}` },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(404);
  });

  it('CRITICAL: signing up with the same email a real guest order used links that order to the new real account', async () => {
    const guestEmail = `order-lifecycle-convert-test-${Date.now()}@example.com`;
    const order = await placeOrder({ guestEmail });

    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: guestEmail, password: 'test_password_123' }),
    });
    const signupBody = await signupRes.json();
    expect(signupBody.linkedOrderCount).toBe(1);

    const myOrders = await fetch(`${BACKEND_URL}/order`, { headers: { Authorization: `Bearer ${signupBody.token}` } }).then((r) => r.json());
    expect(myOrders.find((o) => o.id === order.id)).toBeDefined();
  });

  it('a real fresh signup with no prior guest orders reports zero linked orders', async () => {
    const email = `order-lifecycle-fresh-test-${Date.now()}@example.com`;
    const res = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'test_password_123' }),
    });
    expect((await res.json()).linkedOrderCount).toBe(0);
  });
});
