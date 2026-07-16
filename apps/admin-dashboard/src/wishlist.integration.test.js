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

async function registerFreshBuyer() {
  const suffix = Date.now() + Math.random();
  const res = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `wish-test-${suffix}@example.com`, password: 'test_password_123', name: 'Wishlist Test' }),
  });
  return res.json(); // { token, user }
}

describe.runIf(backendUp)('real wishlist against a REAL running backend', () => {
  it('a fresh buyer starts with a real empty wishlist', async () => {
    const { token } = await registerFreshBuyer();
    const res = await fetch(`${BACKEND_URL}/wishlist/me`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('CRITICAL: adding a real product to the wishlist returns it in the list with real photos/price attached, same as the catalog', async () => {
    const { token } = await registerFreshBuyer();
    const addRes = await fetch(`${BACKEND_URL}/wishlist/me/p1`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    expect(addRes.status).toBe(201);

    const listRes = await fetch(`${BACKEND_URL}/wishlist/me`, { headers: { Authorization: `Bearer ${token}` } });
    const list = await listRes.json();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe('p1');
    expect(list[0].price).toBeGreaterThan(0);
    expect(list[0]).toHaveProperty('images');
  });

  it('the real is-wishlisted check reflects genuine current state, both before and after adding', async () => {
    const { token } = await registerFreshBuyer();
    const beforeRes = await fetch(`${BACKEND_URL}/wishlist/me/p1`, { headers: { Authorization: `Bearer ${token}` } });
    expect((await beforeRes.json()).wishlisted).toBe(false);

    await fetch(`${BACKEND_URL}/wishlist/me/p1`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });

    const afterRes = await fetch(`${BACKEND_URL}/wishlist/me/p1`, { headers: { Authorization: `Bearer ${token}` } });
    expect((await afterRes.json()).wishlisted).toBe(true);
  });

  it('CRITICAL: adding the same real product twice is idempotent -- no error, no duplicate in the list', async () => {
    const { token } = await registerFreshBuyer();
    const first = await fetch(`${BACKEND_URL}/wishlist/me/p1`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    expect(first.status).toBe(201);
    const second = await fetch(`${BACKEND_URL}/wishlist/me/p1`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    expect(second.status).toBe(201);

    const listRes = await fetch(`${BACKEND_URL}/wishlist/me`, { headers: { Authorization: `Bearer ${token}` } });
    const list = await listRes.json();
    expect(list.length).toBe(1);
  });

  it('a nonexistent product is rejected with a real 404, not silently added', async () => {
    const { token } = await registerFreshBuyer();
    const res = await fetch(`${BACKEND_URL}/wishlist/me/definitely_not_a_real_product`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(404);
  });

  it('CRITICAL: removing a real product works, and removing it again (already gone) is idempotent, not an error', async () => {
    const { token } = await registerFreshBuyer();
    await fetch(`${BACKEND_URL}/wishlist/me/p1`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });

    const firstDelete = await fetch(`${BACKEND_URL}/wishlist/me/p1`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    expect(firstDelete.status).toBe(204);

    const secondDelete = await fetch(`${BACKEND_URL}/wishlist/me/p1`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    expect(secondDelete.status).toBe(204);

    const listRes = await fetch(`${BACKEND_URL}/wishlist/me`, { headers: { Authorization: `Bearer ${token}` } });
    expect(await listRes.json()).toEqual([]);
  });

  it('CRITICAL: a buyer only ever sees their OWN real wishlist -- another buyer\'s addition never appears', async () => {
    const { token: token1 } = await registerFreshBuyer();
    await fetch(`${BACKEND_URL}/wishlist/me/p1`, { method: 'POST', headers: { Authorization: `Bearer ${token1}` } });

    const { token: token2 } = await registerFreshBuyer();
    const res = await fetch(`${BACKEND_URL}/wishlist/me`, { headers: { Authorization: `Bearer ${token2}` } });
    expect(await res.json()).toEqual([]);
  });

  it('unauthenticated requests are rejected on every endpoint', async () => {
    const listRes = await fetch(`${BACKEND_URL}/wishlist/me`);
    expect(listRes.status).toBe(401);
    const addRes = await fetch(`${BACKEND_URL}/wishlist/me/p1`, { method: 'POST' });
    expect(addRes.status).toBe(401);
    const removeRes = await fetch(`${BACKEND_URL}/wishlist/me/p1`, { method: 'DELETE' });
    expect(removeRes.status).toBe(401);
  });
});
