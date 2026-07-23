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

// REAL BUG FOUND AND FIXED HERE (migration 044): this whole test file
// used to exercise the old vehicleId-based API, joining a table
// (product_fitment) nothing in this codebase ever wrote a row into --
// a saved vehicle could never actually match a real product. Rewritten
// against the real, populated Brand->Model->Generation cascade (the
// SAME real seeded reference data -- gen_bmw_1_series_f20 -- already
// used throughout this project's other real fitment tests), not a
// mocked or fabricated one.
describe.runIf(backendUp)('garage (saved vehicles) against a REAL running backend', () => {
  const REAL_GENERATION_ID = 'gen_bmw_1_series_f20'; // real seeded BMW 1 Series F20, 2015-2019
  const REAL_YEAR = 2018;

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

  it('saves a real generation+year and it appears in the garage with full real details', async () => {
    const token = await signupBuyer();
    const saveRes = await fetch(`${BACKEND_URL}/garage/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ generationId: REAL_GENERATION_ID, year: REAL_YEAR }),
    });
    expect(saveRes.status).toBe(201);
    const saved = await saveRes.json();
    expect(saved.brand).toBe('BMW');
    expect(saved.model).toBe('1 Series');
    expect(saved.generation).toBe('F20');
    expect(saved.year).toBe(REAL_YEAR);

    const listRes = await fetch(`${BACKEND_URL}/garage/me`, { headers: { Authorization: `Bearer ${token}` } });
    const garage = await listRes.json();
    expect(garage.find((v) => v.generationId === REAL_GENERATION_ID && v.year === REAL_YEAR)).toBeDefined();
  });

  it('CRITICAL: this saved vehicle actually filters the real catalog to real matching products', async () => {
    const token = await signupBuyer();
    await fetch(`${BACKEND_URL}/garage/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ generationId: REAL_GENERATION_ID, year: REAL_YEAR }),
    });

    const garageRes = await fetch(`${BACKEND_URL}/garage/me`, { headers: { Authorization: `Bearer ${token}` } });
    const [saved] = await garageRes.json();

    const productsRes = await fetch(`${BACKEND_URL}/catalog/products?generationId=${saved.generationId}&year=${saved.year}`);
    const products = await productsRes.json();
    expect(products.length).toBeGreaterThan(0);
  });

  it('rejects saving a generation ID that does not exist in the reference catalog', async () => {
    const token = await signupBuyer();
    const res = await fetch(`${BACKEND_URL}/garage/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ generationId: 'not-a-real-generation', year: 2018 }),
    });
    expect(res.status).toBe(404);
  });

  it('rejects a real year outside the real generation\'s actual range', async () => {
    const token = await signupBuyer();
    const res = await fetch(`${BACKEND_URL}/garage/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ generationId: REAL_GENERATION_ID, year: 1999 }), // F20 is 2015-2019
    });
    expect(res.status).toBe(400);
  });

  it('saving the same generation+year twice is idempotent, not an error and not a duplicate', async () => {
    const token = await signupBuyer();
    await fetch(`${BACKEND_URL}/garage/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ generationId: REAL_GENERATION_ID, year: REAL_YEAR }),
    });
    const secondRes = await fetch(`${BACKEND_URL}/garage/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ generationId: REAL_GENERATION_ID, year: REAL_YEAR }),
    });
    expect(secondRes.status).toBe(201);

    const listRes = await fetch(`${BACKEND_URL}/garage/me`, { headers: { Authorization: `Bearer ${token}` } });
    const garage = await listRes.json();
    expect(garage.filter((v) => v.generationId === REAL_GENERATION_ID && v.year === REAL_YEAR).length).toBe(1);
  });

  it('removing a vehicle actually removes it, confirmed by an independent re-fetch', async () => {
    const token = await signupBuyer();
    await fetch(`${BACKEND_URL}/garage/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ generationId: REAL_GENERATION_ID, year: REAL_YEAR }),
    });
    await fetch(`${BACKEND_URL}/garage/me/${REAL_GENERATION_ID}/${REAL_YEAR}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });

    const listRes = await fetch(`${BACKEND_URL}/garage/me`, { headers: { Authorization: `Bearer ${token}` } });
    const garage = await listRes.json();
    expect(garage.find((v) => v.generationId === REAL_GENERATION_ID && v.year === REAL_YEAR)).toBeUndefined();
  });

  it('removing one saved year does not remove a different saved year for the same generation', async () => {
    const token = await signupBuyer();
    await fetch(`${BACKEND_URL}/garage/me`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ generationId: REAL_GENERATION_ID, year: 2016 }),
    });
    await fetch(`${BACKEND_URL}/garage/me`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ generationId: REAL_GENERATION_ID, year: 2018 }),
    });
    await fetch(`${BACKEND_URL}/garage/me/${REAL_GENERATION_ID}/2016`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });

    const listRes = await fetch(`${BACKEND_URL}/garage/me`, { headers: { Authorization: `Bearer ${token}` } });
    const garage = await listRes.json();
    expect(garage.find((v) => v.year === 2016)).toBeUndefined();
    expect(garage.find((v) => v.year === 2018)).toBeDefined();
  });

  it('CRITICAL: a second buyer never sees the first buyer\'s saved vehicles', async () => {
    const tokenA = await signupBuyer();
    await fetch(`${BACKEND_URL}/garage/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ generationId: REAL_GENERATION_ID, year: REAL_YEAR }),
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
      body: JSON.stringify({ generationId: REAL_GENERATION_ID, year: REAL_YEAR }),
    });

    const tokenB = await signupBuyer();
    const deleteRes = await fetch(`${BACKEND_URL}/garage/me/${REAL_GENERATION_ID}/${REAL_YEAR}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tokenB}` } });
    expect(deleteRes.status).toBe(200); // no error, just doesn't affect buyer A's garage

    // Confirm buyer A's vehicle is still there — buyer B's delete call had no effect.
    const listResA = await fetch(`${BACKEND_URL}/garage/me`, { headers: { Authorization: `Bearer ${tokenA}` } });
    const garageA = await listResA.json();
    expect(garageA.find((v) => v.generationId === REAL_GENERATION_ID && v.year === REAL_YEAR)).toBeDefined();
  });

  it('rejects a save request with no generationId', async () => {
    const token = await signupBuyer();
    const res = await fetch(`${BACKEND_URL}/garage/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ year: 2018 }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects a save request with no year', async () => {
    const token = await signupBuyer();
    const res = await fetch(`${BACKEND_URL}/garage/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ generationId: REAL_GENERATION_ID }),
    });
    expect(res.status).toBe(400);
  });
});
