import { describe, it, expect } from 'vitest';
import { login, fetchOrders, fetchOrderById } from './auth';

/**
 * REAL integration tests — no mocking. Requires services/api running
 * locally with the dev admin seeded. Auto-skips if the backend isn't
 * reachable (see auth.integration.test.js for the same pattern).
 */
const BACKEND_URL = 'http://localhost:4000';

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

describe.runIf(await isBackendUp())('order fetching against a REAL running backend', () => {
  it('fetches the real order list as an authenticated admin', async () => {
    const { token, user } = await login('admin@leap.dev', 'admin_dev_password_123');
    expect(user.role).toBe('admin');

    const orders = await fetchOrders(token);
    expect(Array.isArray(orders)).toBe(true);
    // Every order in the system should be visible to an admin — this is
    // the server-side scoping added during the auth work, being exercised
    // here from the actual dashboard code path, not just curl.
    expect(orders.length).toBeGreaterThan(0);
    expect(orders[0]).toHaveProperty('id');
    expect(orders[0]).toHaveProperty('status');
    expect(orders[0]).toHaveProperty('total');
  });

  it('fetches full order detail including real supplier sub-orders and line items', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const orders = await fetchOrders(token);
    const targetOrder = orders[0];

    const detail = await fetchOrderById(token, targetOrder.id);
    expect(detail.id).toBe(targetOrder.id);
    expect(Array.isArray(detail.supplierSubOrders)).toBe(true);
    expect(detail.supplierSubOrders.length).toBeGreaterThan(0);
    // Real join data — proves this isn't just echoing back request params.
    expect(detail.supplierSubOrders[0]).toHaveProperty('items');
  });

  it('rejects fetchOrders with no token', async () => {
    await expect(fetchOrders(null)).rejects.toThrow();
  });

  it('rejects fetchOrders with a garbage token', async () => {
    await expect(fetchOrders('not.a.real.token')).rejects.toThrow();
  });
});
