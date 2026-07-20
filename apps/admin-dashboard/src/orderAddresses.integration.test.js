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
    body: JSON.stringify({ email: `order-address-test-${suffix}@example.com`, password: 'test_password_123' }),
  });
  return res.json();
}

describe.runIf(backendUp)('real order shipping addresses against a REAL running backend', () => {
  it('CRITICAL: a logged-in buyer cannot place an order without a real address or addressId', async () => {
    const buyer = await createSignedUpBuyer();
    const res = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.user.id }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('address');
  });

  it('CRITICAL: a real inline address is required to have every real field, and gets saved with source "manual"', async () => {
    const buyer = await createSignedUpBuyer();
    const incomplete = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.user.id, address: { recipientName: 'X', phone: '1' } }),
    });
    expect(incomplete.status).toBe(400);

    const complete = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.user.id, address: TEST_ADDRESS }),
    });
    expect(complete.status).toBe(201);
    const order = await complete.json();

    const detail = await fetch(`${BACKEND_URL}/order/${order.id}`, { headers: { Authorization: `Bearer ${buyer.token}` } }).then((r) => r.json());
    expect(detail.address).toMatchObject({ ...TEST_ADDRESS, source: 'manual' });
  });

  it('CRITICAL: a real saved address is correctly copied to the order via addressId, with source "saved_address"', async () => {
    const buyer = await createSignedUpBuyer();
    const savedAddress = await fetch(`${BACKEND_URL}/addresses/me`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}` },
      body: JSON.stringify({ label: 'Home', ...TEST_ADDRESS }),
    }).then((r) => r.json());

    const orderRes = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.user.id, addressId: savedAddress.id }),
    });
    expect(orderRes.status).toBe(201);
    const order = await orderRes.json();

    const detail = await fetch(`${BACKEND_URL}/order/${order.id}`, { headers: { Authorization: `Bearer ${buyer.token}` } }).then((r) => r.json());
    expect(detail.address).toMatchObject({ ...TEST_ADDRESS, source: 'saved_address' });
  });

  it('a real addressId belonging to a DIFFERENT buyer is rejected, not silently used', async () => {
    const buyer1 = await createSignedUpBuyer();
    const buyer2 = await createSignedUpBuyer();
    const buyer1Address = await fetch(`${BACKEND_URL}/addresses/me`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer1.token}` },
      body: JSON.stringify({ label: 'Home', ...TEST_ADDRESS }),
    }).then((r) => r.json());

    const res = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer2.user.id, addressId: buyer1Address.id }),
    });
    expect(res.status).toBe(400);
  });

  it('CRITICAL: a real guest order can be placed with NO address at all -- a real, honest "pending" state, not an error', async () => {
    const guestEmail = `order-address-guest-test-${Date.now()}@example.com`;
    const res = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], guestEmail }),
    });
    expect(res.status).toBe(201);
    const order = await res.json();

    const detail = await fetch(`${BACKEND_URL}/order/${order.id}?guestEmail=${guestEmail}`).then((r) => r.json());
    expect(detail.address).toBeNull();
  });

  it('CRITICAL: a real guest can confirm their address afterward via PATCH, correctly tagged with source "geolocation"', async () => {
    const guestEmail = `order-address-guest-test-${Date.now()}@example.com`;
    const order = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], guestEmail }),
    }).then((r) => r.json());

    const patchRes = await fetch(`${BACKEND_URL}/order/${order.id}/address`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestEmail, source: 'geolocation', address: TEST_ADDRESS }),
    });
    expect(patchRes.status).toBe(200);

    const detail = await fetch(`${BACKEND_URL}/order/${order.id}?guestEmail=${guestEmail}`).then((r) => r.json());
    expect(detail.address).toMatchObject({ ...TEST_ADDRESS, source: 'geolocation' });
  });

  it('the wrong guest email is rejected when confirming an address, and a real address can be updated after being set once', async () => {
    const guestEmail = `order-address-guest-test-${Date.now()}@example.com`;
    const order = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], guestEmail }),
    }).then((r) => r.json());

    const wrongEmail = await fetch(`${BACKEND_URL}/order/${order.id}/address`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestEmail: 'wrong@example.com', address: TEST_ADDRESS }),
    });
    expect(wrongEmail.status).toBe(404);

    await fetch(`${BACKEND_URL}/order/${order.id}/address`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestEmail, address: TEST_ADDRESS }),
    });
    const updatedAddress = { ...TEST_ADDRESS, city: 'Updated City' };
    await fetch(`${BACKEND_URL}/order/${order.id}/address`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestEmail, address: updatedAddress }),
    });

    const detail = await fetch(`${BACKEND_URL}/order/${order.id}?guestEmail=${guestEmail}`).then((r) => r.json());
    expect(detail.address.city).toBe('Updated City');
  });
});
