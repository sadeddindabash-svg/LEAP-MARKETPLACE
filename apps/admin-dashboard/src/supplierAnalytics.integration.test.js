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

describe.runIf(backendUp)('real supplier analytics against a REAL running backend', () => {
  it('CRITICAL: a supplier sees their own real analytics (revenue/volume, top products, status breakdown, low-stock, payout summary), all shaped correctly', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const overview = await fetch(`${BACKEND_URL}/supplier/me/overview`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

    expect(overview).toHaveProperty('analytics');
    const a = overview.analytics;
    expect(Array.isArray(a.revenueAndVolume)).toBe(true);
    expect(Array.isArray(a.topProducts)).toBe(true);
    expect(Array.isArray(a.statusBreakdown)).toBe(true);
    expect(Array.isArray(a.lowStockProducts)).toBe(true);
    expect(a.payoutSummary).toHaveProperty('totalPaid');
    expect(a.payoutSummary).toHaveProperty('amountOwed');
    expect(typeof a.payoutSummary.totalPaid).toBe('number');
    expect(typeof a.payoutSummary.amountOwed).toBe('number');

    if (a.topProducts.length > 0) {
      expect(a.topProducts[0]).toHaveProperty('unitsSold');
      expect(a.topProducts[0]).toHaveProperty('revenue');
    }
  });

  it('CRITICAL: an admin can view a specific real supplier\'s analytics, matching that supplier\'s own view of their own data', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');

    const asAdmin = await fetch(`${BACKEND_URL}/supplier/s1/analytics`, { headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.json());
    const asSupplier = await fetch(`${BACKEND_URL}/supplier/me/overview`, { headers: { Authorization: `Bearer ${supplierToken}` } }).then((r) => r.json());

    expect(asAdmin.payoutSummary.totalPaid).toBe(asSupplier.analytics.payoutSummary.totalPaid);
    expect(asAdmin.payoutSummary.amountOwed).toBe(asSupplier.analytics.payoutSummary.amountOwed);
  });

  it('a real, nonexistent supplier ID returns a 404, not an empty analytics object', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const res = await fetch(`${BACKEND_URL}/supplier/definitely-not-a-real-supplier/analytics`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(404);
  });

  it('a supplier cannot view another supplier\'s analytics via the admin-only endpoint', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const res = await fetch(`${BACKEND_URL}/supplier/s1/analytics`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(403);
  });

  it('CRITICAL: low-stock products in the analytics genuinely reflect products at or below their own real threshold, not an arbitrary fixed number', async () => {
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const products = await fetch(`${BACKEND_URL}/supplier/me/products`, { headers: { Authorization: `Bearer ${supplierToken}` } }).then((r) => r.json());
    const overview = await fetch(`${BACKEND_URL}/supplier/me/overview`, { headers: { Authorization: `Bearer ${supplierToken}` } }).then((r) => r.json());

    const genuinelyLowStock = products.filter((p) => p.status === 'active' && p.stockQuantity <= p.lowStockThreshold);
    expect(overview.analytics.lowStockProducts.length).toBe(genuinelyLowStock.length);
  }, 20000); // real, deliberately generous timeout -- this shared dev database has accumulated thousands of real test products across this whole project's history, making a real, full product list fetch genuinely slower than the default 5s.
});
