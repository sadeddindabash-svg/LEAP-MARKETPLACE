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

async function signupBuyer() {
  const email = `garage-test-${Date.now()}-${Math.random()}@example.com`;
  const res = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' }),
  });
  const { token } = await res.json();
  return token;
}

const backendUp = await isBackendUp();

describe.runIf(backendUp)('garage (saved vehicles) against a REAL running backend', () => {
  it('rejects unauthenticated access', async () => {
    const res = await fetch(`${BACKEND_URL}/garage/me`);
    expect(res.status).toBe(401);
  });

  it('a new buyer starts with an empty garage', async () => {
    const token = await signupBuyer();
    const res = await fetch(`${BACKEND_URL}/garage/me`, { headers: { Authorization: `Bearer ${token}` } });
    const garage = await res.json();
    expect(garage).toEqual([]);
  });

  it('saves a real reference vehicle and it appears in the garage with full details', async () => {
    const token = await signupBuyer();
    const saveRes = await fetch(`${BACKEND_URL}/garage/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ vehicleId: 'v1' }),
    });
    expect(saveRes.status).toBe(201);
    const saved = await saveRes.json();
    expect(saved.make).toBe('BMW');

    const listRes = await fetch(`${BACKEND_URL}/garage/me`, { headers: { Authorization: `Bearer ${token}` } });
    const garage = await listRes.json();
    expect(garage.find((v) => v.id === 'v1')).toBeDefined();
  });

  it('rejects saving a vehicle ID that does not exist in the reference catalog', async () => {
    const token = await signupBuyer();
    const res = await fetch(`${BACKEND_URL}/garage/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ vehicleId: 'not-a-real-vehicle' }),
    });
    expect(res.status).toBe(404);
  });

  it('saving the same vehicle twice is idempotent, not an error and not a duplicate', async () => {
    const token = await signupBuyer();
    await fetch(`${BACKEND_URL}/garage/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ vehicleId: 'v2' }),
    });
    const secondRes = await fetch(`${BACKEND_URL}/garage/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ vehicleId: 'v2' }),
    });
    expect(secondRes.status).toBe(201);

    const listRes = await fetch(`${BACKEND_URL}/garage/me`, { headers: { Authorization: `Bearer ${token}` } });
    const garage = await listRes.json();
    expect(garage.filter((v) => v.id === 'v2').length).toBe(1);
  });

  it('removing a vehicle actually removes it, confirmed by an independent re-fetch', async () => {
    const token = await signupBuyer();
    await fetch(`${BACKEND_URL}/garage/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ vehicleId: 'v3' }),
    });
    await fetch(`${BACKEND_URL}/garage/me/v3`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });

    const listRes = await fetch(`${BACKEND_URL}/garage/me`, { headers: { Authorization: `Bearer ${token}` } });
    const garage = await listRes.json();
    expect(garage.find((v) => v.id === 'v3')).toBeUndefined();
  });

  it('CRITICAL: a second buyer never sees the first buyer\'s saved vehicles', async () => {
    const tokenA = await signupBuyer();
    await fetch(`${BACKEND_URL}/garage/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ vehicleId: 'v1' }),
    });

    const tokenB = await signupBuyer();
    const res = await fetch(`${BACKEND_URL}/garage/me`, { headers: { Authorization: `Bearer ${tokenB}` } });
    const garageB = await res.json();
    expect(garageB).toEqual([]);
  });

  it('removing a vehicle that only exists in someone else\'s garage is a silent no-op, not an error or a leak', async () => {
    const tokenA = await signupBuyer();
    await fetch(`${BACKEND_URL}/garage/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ vehicleId: 'v2' }),
    });

    const tokenB = await signupBuyer();
    const deleteRes = await fetch(`${BACKEND_URL}/garage/me/v2`, { method: 'DELETE', headers: { Authorization: `Bearer ${tokenB}` } });
    expect(deleteRes.status).toBe(200); // no error, just doesn't affect buyer A's garage

    // Confirm buyer A's vehicle is still there — buyer B's delete call had no effect.
    const listResA = await fetch(`${BACKEND_URL}/garage/me`, { headers: { Authorization: `Bearer ${tokenA}` } });
    const garageA = await listResA.json();
    expect(garageA.find((v) => v.id === 'v2')).toBeDefined();
  });

  it('rejects a save request with no vehicleId', async () => {
    const token = await signupBuyer();
    const res = await fetch(`${BACKEND_URL}/garage/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
