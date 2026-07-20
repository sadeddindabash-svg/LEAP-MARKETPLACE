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

// Real, valid test address (migration 030 now requires one for a real
// logged-in buyer placing an order).
const TEST_ADDRESS = { recipientName: 'Test Buyer', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' };

async function placeGuestOrder(guestEmail) {
  const res = await fetch(`${BACKEND_URL}/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], guestEmail }),
  });
  return res.json();
}

async function signupAndPlaceOrder() {
  const email = `order-security-${Date.now()}-${Math.random()}@example.com`;
  const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' }),
  });
  const { token, user } = await signupRes.json();
  const orderRes = await fetch(`${BACKEND_URL}/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: user.id, address: TEST_ADDRESS }),
  });
  const order = await orderRes.json();
  return { token, user, order };
}

const backendUp = await isBackendUp();

describe.runIf(backendUp)('GET /order/:id security fix — was previously fully open to anyone who guessed an ID', () => {
  it('a guest order is invisible to a completely anonymous request (no guestEmail param)', async () => {
    const guestEmail = `order-security-guest-${Date.now()}@example.com`;
    const order = await placeGuestOrder(guestEmail);
    const res = await fetch(`${BACKEND_URL}/order/${order.id}`);
    expect(res.status).toBe(404);
  });

  it('a guest order is invisible with the WRONG guestEmail', async () => {
    const guestEmail = `order-security-guest2-${Date.now()}@example.com`;
    const order = await placeGuestOrder(guestEmail);
    const res = await fetch(`${BACKEND_URL}/order/${order.id}?guestEmail=someone-else@example.com`);
    expect(res.status).toBe(404);
  });

  it('a guest order IS visible with the correct guestEmail — preserves the original requirement', async () => {
    const guestEmail = `order-security-guest3-${Date.now()}@example.com`;
    const order = await placeGuestOrder(guestEmail);
    const res = await fetch(`${BACKEND_URL}/order/${order.id}?guestEmail=${encodeURIComponent(guestEmail)}`);
    expect(res.status).toBe(200);
    const detail = await res.json();
    expect(detail.id).toBe(order.id);
  });

  it('CRITICAL: a logged-in order is invisible to a completely different buyer', async () => {
    const { order } = await signupAndPlaceOrder();
    const { token: otherBuyerToken } = await signupAndPlaceOrder(); // separate account
    const res = await fetch(`${BACKEND_URL}/order/${order.id}`, { headers: { Authorization: `Bearer ${otherBuyerToken}` } });
    expect(res.status).toBe(404);
  });

  it('the owning buyer CAN view their own order when logged in', async () => {
    const { token, order } = await signupAndPlaceOrder();
    const res = await fetch(`${BACKEND_URL}/order/${order.id}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    const detail = await res.json();
    expect(detail.id).toBe(order.id);
  });

  it('an admin can view ANY order regardless of who placed it (needed for the real admin dashboard)', async () => {
    const { order } = await signupAndPlaceOrder();
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const res = await fetch(`${BACKEND_URL}/order/${order.id}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(res.status).toBe(200);
  });

  it('an unknown order ID returns 404 the same way a real-but-inaccessible one does (no existence leak)', async () => {
    const res = await fetch(`${BACKEND_URL}/order/LP-999999999`);
    expect(res.status).toBe(404);
  });
});
