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

describe.runIf(backendUp)('real scheduled (future-start) promo codes against a REAL running backend', () => {
  it('CRITICAL: a real code scheduled for a real future start date is rejected as not active yet', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const code = `SCHEDFUTURE${Date.now()}`;
    await fetch(`${BACKEND_URL}/promo-codes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code, type: 'flat', value: 5, startsAt: '2099-01-01T00:00:00.000Z' }),
    });

    const result = await fetch(`${BACKEND_URL}/promo-codes/validate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).then((r) => r.json());
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('This code is not active yet.');
  });

  it('CRITICAL: a real code whose scheduled start date has already passed is genuinely usable', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const code = `SCHEDPAST${Date.now()}`;
    await fetch(`${BACKEND_URL}/promo-codes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code, type: 'flat', value: 5, startsAt: '2020-01-01T00:00:00.000Z' }),
    });

    const result = await fetch(`${BACKEND_URL}/promo-codes/validate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).then((r) => r.json());
    expect(result.valid).toBe(true);
  });

  it('a real code with a scheduled start after its own expiry is rejected as an impossible range', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const code = `SCHEDBADRANGE${Date.now()}`;
    const res = await fetch(`${BACKEND_URL}/promo-codes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code, type: 'flat', value: 5, startsAt: '2099-01-01T00:00:00.000Z', expiresAt: '2050-01-01T00:00:00.000Z' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('startsAt must be before expiresAt');
  });

  it('a real, already-existing code can have a scheduled start added via update, and takes effect', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const code = `SCHEDUPDATE${Date.now()}`;
    await fetch(`${BACKEND_URL}/promo-codes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code, type: 'flat', value: 5 }),
    });

    // Real, genuinely usable before any scheduled start is set.
    const before = await fetch(`${BACKEND_URL}/promo-codes/validate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).then((r) => r.json());
    expect(before.valid).toBe(true);

    await fetch(`${BACKEND_URL}/promo-codes/${code}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ startsAt: '2099-01-01T00:00:00.000Z' }),
    });

    const after = await fetch(`${BACKEND_URL}/promo-codes/validate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).then((r) => r.json());
    expect(after.valid).toBe(false);
    expect(after.reason).toBe('This code is not active yet.');
  });
});
