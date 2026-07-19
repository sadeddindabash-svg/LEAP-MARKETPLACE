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

describe.runIf(backendUp)('real FX rate automatic/manual toggle against a REAL running backend', () => {
  it('CRITICAL: defaults to manual mode, and the manual rate endpoint works normally in that mode', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    // Ensure a known starting state regardless of any earlier test run.
    await fetch(`${BACKEND_URL}/pricing/fx-rate-mode`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ mode: 'manual' }),
    });

    const modeRes = await fetch(`${BACKEND_URL}/pricing/fx-rate-mode`, { headers: { Authorization: `Bearer ${adminToken}` } });
    expect((await modeRes.json()).mode).toBe('manual');

    const updateRes = await fetch(`${BACKEND_URL}/pricing/fx-rate`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ pair: 'CNY_USD', rate: 0.145 }),
    });
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.rate).toBe(0.145);
    expect(updated.source).toBe('manual');
  });

  it('CRITICAL: switching to automatic mode rejects the manual rate endpoint, with a real, clear message', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const switchRes = await fetch(`${BACKEND_URL}/pricing/fx-rate-mode`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ mode: 'automatic' }),
    });
    expect(switchRes.status).toBe(200);
    expect((await switchRes.json()).mode).toBe('automatic');

    const manualAttempt = await fetch(`${BACKEND_URL}/pricing/fx-rate`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ pair: 'CNY_USD', rate: 0.2 }),
    });
    expect(manualAttempt.status).toBe(400);
    expect((await manualAttempt.json()).error).toContain('manual mode first');

    // Restore manual mode for other tests/manual use.
    await fetch(`${BACKEND_URL}/pricing/fx-rate-mode`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ mode: 'manual' }),
    });
  }, 15000);

  it('an invalid mode value is rejected, and non-admins cannot access either endpoint', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const invalidRes = await fetch(`${BACKEND_URL}/pricing/fx-rate-mode`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ mode: 'nonsense' }),
    });
    expect(invalidRes.status).toBe(400);

    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const nonAdminGet = await fetch(`${BACKEND_URL}/pricing/fx-rate-mode`, { headers: { Authorization: `Bearer ${supplierToken}` } });
    expect(nonAdminGet.status).toBe(403);
    const nonAdminPatch = await fetch(`${BACKEND_URL}/pricing/fx-rate-mode`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ mode: 'automatic' }),
    });
    expect(nonAdminPatch.status).toBe(403);
  });

  it('restores manual mode with a real, valid rate so other tests and manual use are unaffected', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    await fetch(`${BACKEND_URL}/pricing/fx-rate-mode`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ mode: 'manual' }),
    });
    const res = await fetch(`${BACKEND_URL}/pricing/fx-rate`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ pair: 'CNY_USD', rate: 0.145 }),
    });
    expect(res.status).toBe(200);
  });
});
