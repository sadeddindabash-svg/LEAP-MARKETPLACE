import { describe, it, expect } from 'vitest';
import { login } from './auth';
import { Pool } from 'pg';

const BACKEND_URL = 'http://localhost:4000';
const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev';

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

const backendUp = await isBackendUp();

describe.runIf(backendUp)('real supplier payout method against a REAL running backend', () => {
  it('CRITICAL: a supplier with no real payout method on file gets a genuine null, not an error', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    // Real, direct DB cleanup for this one test only, so it starts
    // from a genuinely clean state regardless of other tests/manual
    // use having already set one for this same real supplier.
    const pool = new Pool({ connectionString: TEST_DB_URL });
    await pool.query(`DELETE FROM supplier_payout_methods WHERE supplier_id = 's1'`);
    await pool.end();

    const res = await fetch(`${BACKEND_URL}/supplier/me/payout-method`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it('CRITICAL: setting a payout method requires every real field', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const res = await fetch(`${BACKEND_URL}/supplier/me/payout-method`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bankName: 'Test Bank' }),
    });
    expect(res.status).toBe(400);
  });

  it('CRITICAL: a real, complete payout method saves and can be fetched back correctly, and a real update replaces it', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const first = await fetch(`${BACKEND_URL}/supplier/me/payout-method`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bankName: 'Bank of China', accountNumber: '111', accountHolderName: 'Guangzhou AutoParts Co.' }),
    });
    expect(first.status).toBe(200);

    const fetched = await fetch(`${BACKEND_URL}/supplier/me/payout-method`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    expect(fetched).toMatchObject({ bankName: 'Bank of China', accountNumber: '111', accountHolderName: 'Guangzhou AutoParts Co.' });

    await fetch(`${BACKEND_URL}/supplier/me/payout-method`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bankName: 'ICBC', accountNumber: '222', accountHolderName: 'Guangzhou AutoParts Co.' }),
    });
    const refetched = await fetch(`${BACKEND_URL}/supplier/me/payout-method`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    expect(refetched.bankName).toBe('ICBC');
    expect(refetched.accountNumber).toBe('222');
  });

  it('CRITICAL: an admin can view a real payout method, but a non-admin cannot view another supplier\'s', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    await fetch(`${BACKEND_URL}/supplier/me/payout-method`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ bankName: 'Bank of China', accountNumber: '111', accountHolderName: 'Guangzhou AutoParts Co.' }),
    });

    const adminRes = await fetch(`${BACKEND_URL}/supplier/s1/payout-method`, { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(adminRes.status).toBe(200);

    const nonAdminRes = await fetch(`${BACKEND_URL}/supplier/s1/payout-method`, { headers: { Authorization: `Bearer ${supplierToken}` } });
    expect(nonAdminRes.status).toBe(403);
  });

  it('CRITICAL: recording a payout is rejected when the supplier has no real payout method on file, with a real, clear message', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const pool = new Pool({ connectionString: TEST_DB_URL });
    await pool.query(`DELETE FROM supplier_payout_methods WHERE supplier_id = 's1'`);
    await pool.end();

    const res = await fetch(`${BACKEND_URL}/payouts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ supplierId: 's1' }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('payout method');

    // Restore for any other real tests/manual use relying on this
    // real supplier having one.
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    await fetch(`${BACKEND_URL}/supplier/me/payout-method`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ bankName: 'Bank of China', accountNumber: '111', accountHolderName: 'Guangzhou AutoParts Co.' }),
    });
  });
});
