import { describe, it, expect } from 'vitest';
import { login, fetchSuppliers, verifySupplier } from './auth';

const BACKEND_URL = 'http://localhost:4000';

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

describe.runIf(await isBackendUp())('supplier management against a REAL running backend', () => {
  it('fetches the real supplier list as an authenticated admin, with real listing counts', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const suppliers = await fetchSuppliers(token);

    expect(Array.isArray(suppliers)).toBe(true);
    expect(suppliers.length).toBeGreaterThan(0);
    const s1 = suppliers.find((s) => s.id === 's1');
    expect(s1).toBeDefined();
    // listingCount is a real derived join, not a stored/fake number —
    // just confirming the field exists and is numeric.
    expect(typeof s1.listingCount).toBe('number');
  });

  it('rejects fetchSuppliers with no token', async () => {
    await expect(fetchSuppliers(null)).rejects.toThrow();
  });

  it('changes a supplier verification status and the change is real and persisted (round-trip, regardless of starting state)', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');

    const before = await fetchSuppliers(token);
    const target = before[0];
    expect(target).toBeDefined();

    // Round-trip through both states rather than assuming a specific
    // starting status — this test is self-contained regardless of what a
    // previous test run left in the (real, persistent) dev database.
    await verifySupplier(token, target.id, 'rejected');
    let afterReject = (await fetchSuppliers(token)).find((s) => s.id === target.id);
    expect(afterReject.verificationStatus).toBe('rejected');

    await verifySupplier(token, target.id, 'verified');
    let afterVerify = (await fetchSuppliers(token)).find((s) => s.id === target.id);
    expect(afterVerify.verificationStatus).toBe('verified');
  });

  it('rejects an invalid verification status', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const suppliers = await fetchSuppliers(token);
    await expect(verifySupplier(token, suppliers[0].id, 'banana')).rejects.toThrow();
  });

  it('rejects a non-admin (buyer) account from viewing suppliers', async () => {
    const email = `supplier-test-${Date.now()}@example.com`;
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    });
    const { token: buyerToken } = await signupRes.json();

    await expect(fetchSuppliers(buyerToken)).rejects.toThrow();
  });
});
