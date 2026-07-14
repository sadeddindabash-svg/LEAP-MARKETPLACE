import { describe, it, expect } from 'vitest';
import { login, fetchMyOverview } from './auth';

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

describe.runIf(backendUp)('supplier overview against a REAL running backend', () => {
  it('rejects unauthenticated access', async () => {
    const res = await fetch(`${BACKEND_URL}/supplier/me/overview`);
    expect(res.status).toBe(401);
  });

  it('rejects an admin account (this endpoint is supplier-only)', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    await expect(fetchMyOverview(token)).rejects.toThrow();
  });

  it('returns real counts, never a fabricated ¥ sales figure or star rating', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const overview = await fetchMyOverview(token);

    expect(typeof overview.totalOrders).toBe('number');
    expect(typeof overview.pendingOrders).toBe('number');
    expect(typeof overview.totalListings).toBe('number');
    expect(typeof overview.pendingReturns).toBe('number');
    expect(Array.isArray(overview.ordersByDay)).toBe(true);
    expect(Array.isArray(overview.topProducts)).toBe(true);
    expect(Array.isArray(overview.recentOrders)).toBe(true);

    // Deliberately absent fields — proves this isn't just a frontend
    // choice not to display fabricated data; the backend never sends it.
    expect(overview.salesTotal).toBeUndefined();
    expect(overview.rating).toBeUndefined();
  });

  it('totalListings matches the real product count for this supplier', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const overview = await fetchMyOverview(token);

    const productsRes = await fetch(`${BACKEND_URL}/supplier/me/products`, { headers: { Authorization: `Bearer ${token}` } });
    const products = await productsRes.json();
    expect(overview.totalListings).toBe(products.length);
  });

  it('placing a real order for this supplier increases totalOrders by exactly one', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const before = await fetchMyOverview(token);

    // p1 belongs to supplier s1 (the seeded dev supplier login).
    await fetch(`${BACKEND_URL}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], guestEmail: `supplier-overview-test-${Date.now()}@example.com` }),
    });

    const after = await fetchMyOverview(token);
    expect(after.totalOrders).toBe(before.totalOrders + 1);
  });

  it('recentOrders never includes an order from a different supplier', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    // p4 belongs to supplier s2, not s1 (the logged-in supplier here).
    const orderRes = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p4', quantity: 1 }], guestEmail: `cross-supplier-overview-test-${Date.now()}@example.com` }),
    });
    const order = await orderRes.json();

    const overview = await fetchMyOverview(token);
    expect(overview.recentOrders.find((o) => o.orderId === order.id)).toBeUndefined();
  });
});
