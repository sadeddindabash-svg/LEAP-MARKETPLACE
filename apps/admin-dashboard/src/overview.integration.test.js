import { describe, it, expect } from 'vitest';
import { login, fetchOverview } from './auth';

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

describe.runIf(backendUp)('admin overview against a REAL running backend', () => {
  it('rejects unauthenticated access', async () => {
    const res = await fetch(`${BACKEND_URL}/overview`);
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin (buyer) account', async () => {
    const email = `overview-test-${Date.now()}@example.com`;
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    });
    const { token: buyerToken } = await signupRes.json();
    await expect(fetchOverview(buyerToken)).rejects.toThrow();
  });

  it('returns real counts, not fabricated numbers, and never a blended GMV figure', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const overview = await fetchOverview(token);

    // Shape checks — these are the fields the real UI reads.
    expect(typeof overview.totalOrders).toBe('number');
    expect(typeof overview.activeSuppliers).toBe('number');
    expect(typeof overview.openDisputes).toBe('number');
    expect(typeof overview.openTickets).toBe('number');
    expect(Array.isArray(overview.ordersByDay)).toBe(true);
    expect(Array.isArray(overview.unitsByCategory)).toBe(true);
    expect(Array.isArray(overview.topSuppliers)).toBe(true);

    // Deliberately absent fields — proves the "no fake GMV, no fake top
    // markets by country" design decision isn't just a frontend choice,
    // the backend response itself never included them.
    expect(overview.gmv).toBeUndefined();
    expect(overview.topMarkets).toBeUndefined();
  });

  it('placing a real order increases totalOrders by exactly one', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const before = await fetchOverview(token);

    await fetch(`${BACKEND_URL}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], guestEmail: `overview-order-test-${Date.now()}@example.com` }),
    });

    const after = await fetchOverview(token);
    expect(after.totalOrders).toBe(before.totalOrders + 1);
  });

  it('topSuppliers is ordered by real order count, descending', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const overview = await fetchOverview(token);
    for (let i = 1; i < overview.topSuppliers.length; i++) {
      expect(overview.topSuppliers[i].orderCount).toBeLessThanOrEqual(overview.topSuppliers[i - 1].orderCount);
    }
  });
});
