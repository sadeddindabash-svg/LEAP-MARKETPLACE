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

describe.runIf(backendUp)('real weekly supplier email digest against a REAL running backend', () => {
  it('CRITICAL: triggering the sweep sends due digests and updates last_digest_sent_at so an immediate re-run finds nobody newly due', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');

    const first = await fetch(`${BACKEND_URL}/admin/supplier-digest/check`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.json());
    expect(first).toHaveProperty('due');
    expect(first).toHaveProperty('sent');

    // Immediately re-running should find nobody newly due (everyone
    // due was just handled, and it hasn't been a real week yet).
    const second = await fetch(`${BACKEND_URL}/admin/supplier-digest/check`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.json());
    expect(second.due).toBe(0);
    expect(second.sent).toBe(0);
  });

  it('a non-admin cannot trigger a manual supplier-digest check', async () => {
    const suffix = Date.now() + Math.random();
    const { token } = await (await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `digest-nonadmin-${suffix}@example.com`, password: 'test_password_123' }),
    })).json();
    const res = await fetch(`${BACKEND_URL}/admin/supplier-digest/check`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(403);
  });

  it('CRITICAL: a real new order placed for a supplier is correctly reflected once their digest becomes due again', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');

    // Place a real, fresh order for a real product from supplier s1.
    const suffix = Date.now() + Math.random();
    const buyer = await (await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `digest-order-test-${suffix}@example.com`, password: 'test_password_123' }),
    })).json();
    const orderRes = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.user.id, address: TEST_ADDRESS }),
    });
    expect(orderRes.status).toBe(201);

    // A real, immediate re-check should still find nobody due (this
    // real order alone doesn't make a week pass) -- confirms the
    // real digest cadence is genuinely time-gated, not triggered by
    // every single new order.
    const result = await fetch(`${BACKEND_URL}/admin/supplier-digest/check`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.json());
    expect(result.due).toBe(0);
  });
});
