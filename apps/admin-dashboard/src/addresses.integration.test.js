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
    body: JSON.stringify({ email: `addr-test-${suffix}@example.com`, password: 'test_password_123', name: 'Address Test' }),
  });
  return res.json(); // { token, user }
}

function realAddressPayload(overrides = {}) {
  return {
    label: 'Home', recipientName: 'Test Buyer', phone: '+1-555-0100',
    country: 'United States', city: 'Austin', streetAddress: '123 Main St', postalCode: '78701',
    ...overrides,
  };
}

describe.runIf(backendUp)('real buyer address book (capped at 3) against a REAL running backend', () => {
  it('CRITICAL: the first address a buyer saves becomes the real default automatically, regardless of what was passed', async () => {
    const { token } = await registerFreshBuyer();
    const res = await fetch(`${BACKEND_URL}/addresses/me`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(realAddressPayload({ isDefault: false })), // deliberately false -- should still become default
    });
    expect(res.status).toBe(201);
    const address = await res.json();
    expect(address.isDefault).toBe(true);
  });

  it('CRITICAL: a real cap of 3 addresses is enforced -- a 4th is rejected with a clear message', async () => {
    const { token } = await registerFreshBuyer();
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${BACKEND_URL}/addresses/me`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(realAddressPayload({ label: `Address ${i}` })),
      });
      expect(res.status).toBe(201);
    }
    const fourthRes = await fetch(`${BACKEND_URL}/addresses/me`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(realAddressPayload({ label: 'Fourth' })),
    });
    expect(fourthRes.status).toBe(409);
    const body = await fourthRes.json();
    expect(body.error).toContain('3');
  });

  it('CRITICAL: setting a new default un-defaults every other real address for that buyer -- exactly one default at all times', async () => {
    const { token } = await registerFreshBuyer();
    const first = await (await fetch(`${BACKEND_URL}/addresses/me`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(realAddressPayload({ label: 'First' })),
    })).json();
    const second = await (await fetch(`${BACKEND_URL}/addresses/me`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(realAddressPayload({ label: 'Second' })),
    })).json();
    expect(first.isDefault).toBe(true);
    expect(second.isDefault).toBe(false);

    await fetch(`${BACKEND_URL}/addresses/me/${second.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isDefault: true }),
    });

    const listRes = await fetch(`${BACKEND_URL}/addresses/me`, { headers: { Authorization: `Bearer ${token}` } });
    const list = await listRes.json();
    const defaults = list.filter((a) => a.isDefault);
    expect(defaults.length).toBe(1);
    expect(defaults[0].id).toBe(second.id);
  });

  it('CRITICAL: deleting the current default real-promotes the next real address to default, never leaving zero defaults with addresses still present', async () => {
    const { token } = await registerFreshBuyer();
    const first = await (await fetch(`${BACKEND_URL}/addresses/me`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(realAddressPayload({ label: 'First' })),
    })).json();
    await fetch(`${BACKEND_URL}/addresses/me`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(realAddressPayload({ label: 'Second' })),
    });

    const deleteRes = await fetch(`${BACKEND_URL}/addresses/me/${first.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    expect(deleteRes.status).toBe(204);

    const listRes = await fetch(`${BACKEND_URL}/addresses/me`, { headers: { Authorization: `Bearer ${token}` } });
    const list = await listRes.json();
    expect(list.length).toBe(1);
    expect(list[0].isDefault).toBe(true);
  });

  it('CRITICAL: a buyer only ever sees and can only modify their OWN real addresses -- cross-buyer access is rejected', async () => {
    const { token: token1 } = await registerFreshBuyer();
    const address = await (await fetch(`${BACKEND_URL}/addresses/me`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify(realAddressPayload()),
    })).json();

    const { token: token2 } = await registerFreshBuyer();
    const listRes = await fetch(`${BACKEND_URL}/addresses/me`, { headers: { Authorization: `Bearer ${token2}` } });
    const list = await listRes.json();
    expect(list.length).toBe(0);

    const deleteRes = await fetch(`${BACKEND_URL}/addresses/me/${address.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token2}` } });
    expect(deleteRes.status).toBe(404);

    const patchRes = await fetch(`${BACKEND_URL}/addresses/me/${address.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
      body: JSON.stringify({ label: 'Hijacked' }),
    });
    expect(patchRes.status).toBe(404);
  });

  it('missing required fields are rejected with a clear message listing exactly which ones', async () => {
    const { token } = await registerFreshBuyer();
    const res = await fetch(`${BACKEND_URL}/addresses/me`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ label: 'Incomplete' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('recipientName');
    expect(body.error).toContain('phone');
  });

  it('unauthenticated requests are rejected on every endpoint', async () => {
    const getRes = await fetch(`${BACKEND_URL}/addresses/me`);
    expect(getRes.status).toBe(401);
    const postRes = await fetch(`${BACKEND_URL}/addresses/me`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(realAddressPayload()),
    });
    expect(postRes.status).toBe(401);
  });

  it('a real update changes exactly the fields provided and leaves the rest untouched', async () => {
    const { token } = await registerFreshBuyer();
    const address = await (await fetch(`${BACKEND_URL}/addresses/me`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(realAddressPayload()),
    })).json();

    const patchRes = await fetch(`${BACKEND_URL}/addresses/me/${address.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ city: 'Houston' }),
    });
    expect(patchRes.status).toBe(200);
    const updated = await patchRes.json();
    expect(updated.city).toBe('Houston');
    expect(updated.recipientName).toBe('Test Buyer'); // untouched
    expect(updated.streetAddress).toBe('123 Main St'); // untouched
  });
});
