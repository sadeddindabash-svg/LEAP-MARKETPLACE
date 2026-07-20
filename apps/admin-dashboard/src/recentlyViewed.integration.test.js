import { describe, it, expect } from 'vitest';

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

async function createSignedUpBuyer() {
  const suffix = Date.now() + Math.random();
  const res = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `recently-viewed-test-${suffix}@example.com`, password: 'test_password_123' }),
  });
  return res.json();
}

describe.runIf(backendUp)('real recently viewed products (synced to account) against a REAL running backend', () => {
  it('CRITICAL: recording a view and fetching the list shows it, most recent first', async () => {
    const buyer = await createSignedUpBuyer();
    await fetch(`${BACKEND_URL}/recently-viewed/p1`, { method: 'POST', headers: { Authorization: `Bearer ${buyer.token}` } });
    await fetch(`${BACKEND_URL}/recently-viewed/p4`, { method: 'POST', headers: { Authorization: `Bearer ${buyer.token}` } });

    const list = await fetch(`${BACKEND_URL}/recently-viewed/me`, { headers: { Authorization: `Bearer ${buyer.token}` } }).then((r) => r.json());
    expect(list.map((p) => p.id)).toEqual(['p4', 'p1']);
  });

  it('CRITICAL: re-viewing a product moves it back to the front, rather than duplicating it', async () => {
    const buyer = await createSignedUpBuyer();
    await fetch(`${BACKEND_URL}/recently-viewed/p1`, { method: 'POST', headers: { Authorization: `Bearer ${buyer.token}` } });
    await fetch(`${BACKEND_URL}/recently-viewed/p4`, { method: 'POST', headers: { Authorization: `Bearer ${buyer.token}` } });
    await fetch(`${BACKEND_URL}/recently-viewed/p1`, { method: 'POST', headers: { Authorization: `Bearer ${buyer.token}` } });

    const list = await fetch(`${BACKEND_URL}/recently-viewed/me`, { headers: { Authorization: `Bearer ${buyer.token}` } }).then((r) => r.json());
    expect(list.map((p) => p.id)).toEqual(['p1', 'p4']);
  });

  it('an unauthenticated request is rejected, and a nonexistent product is rejected too', async () => {
    const buyer = await createSignedUpBuyer();
    const noAuth = await fetch(`${BACKEND_URL}/recently-viewed/p1`, { method: 'POST' });
    expect(noAuth.status).toBe(401);

    const badProduct = await fetch(`${BACKEND_URL}/recently-viewed/definitely-not-a-real-product`, {
      method: 'POST', headers: { Authorization: `Bearer ${buyer.token}` },
    });
    expect(badProduct.status).toBe(404);
  });

  it('a real buyer who has viewed nothing yet gets a genuinely empty list, not an error', async () => {
    const buyer = await createSignedUpBuyer();
    const res = await fetch(`${BACKEND_URL}/recently-viewed/me`, { headers: { Authorization: `Bearer ${buyer.token}` } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});
