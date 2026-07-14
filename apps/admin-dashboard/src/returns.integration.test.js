import { describe, it, expect } from 'vitest';
import {
  login, fetchReturnCases, fetchReturnCaseById,
  replyToReturnCaseBuyer, replyToReturnCaseSupplier, updateReturnCaseStatus,
} from './auth';

const BACKEND_URL = 'http://localhost:4000';

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function createTestReturnCase() {
  const orderRes = await fetch(`${BACKEND_URL}/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], guestEmail: `admin-returns-test-${Date.now()}@example.com` }),
  });
  const order = await orderRes.json();
  const subOrderId = order.supplierSubOrders[0].subOrderId;

  const caseRes = await fetch(`${BACKEND_URL}/returns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subOrderId, reason: 'Integration test reason', message: 'Integration test initial message', guestEmail: `admin-returns-test-${Date.now()}@example.com` }),
  });
  return caseRes.json();
}

const backendUp = await isBackendUp();

describe.runIf(backendUp)('admin return-case management against a REAL running backend', () => {
  it('rejects a non-admin (buyer) account', async () => {
    const email = `returns-test-buyer-${Date.now()}@example.com`;
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    });
    const { token: buyerToken } = await signupRes.json();
    await expect(fetchReturnCases(buyerToken)).rejects.toThrow();
  });

  it('admin sees a newly created case in the full list', async () => {
    const created = await createTestReturnCase();
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const cases = await fetchReturnCases(token);
    expect(cases.find((c) => c.id === created.id)).toBeDefined();
  });

  it('fetches full case detail including the real initial buyer message', async () => {
    const created = await createTestReturnCase();
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const detail = await fetchReturnCaseById(token, created.id);
    expect(detail.buyerMessages.length).toBe(1);
    expect(detail.buyerMessages[0].senderRole).toBe('buyer');
    expect(detail.supplierMessages.length).toBe(0);
  });

  it('admin replying to the buyer adds to the buyer thread only, never the supplier thread', async () => {
    const created = await createTestReturnCase();
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');

    await replyToReturnCaseBuyer(token, created.id, 'We are reviewing your request.');
    const detail = await fetchReturnCaseById(token, created.id);
    expect(detail.buyerMessages.length).toBe(2);
    expect(detail.supplierMessages.length).toBe(0);
  });

  it('admin messaging the supplier adds to the supplier thread only, never the buyer thread', async () => {
    const created = await createTestReturnCase();
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');

    await replyToReturnCaseSupplier(token, created.id, 'Can you confirm stock for a replacement?');
    const detail = await fetchReturnCaseById(token, created.id);
    expect(detail.supplierMessages.length).toBe(1);
    expect(detail.buyerMessages.length).toBe(1); // unaffected
  });

  it('status updates are real and persisted, confirmed by independent re-fetch', async () => {
    const created = await createTestReturnCase();
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');

    await updateReturnCaseStatus(token, created.id, 'approved');
    const detail = await fetchReturnCaseById(token, created.id);
    expect(detail.status).toBe('approved');
  });

  it('rejects an invalid status', async () => {
    const created = await createTestReturnCase();
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    await expect(updateReturnCaseStatus(token, created.id, 'banana')).rejects.toThrow();
  });
});
