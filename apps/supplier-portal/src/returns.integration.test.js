import { describe, it, expect } from 'vitest';
import { login, fetchMyReturnCases, fetchMyReturnCaseById, replyToReturnCase } from './auth';

const BACKEND_URL = 'http://localhost:4000';

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function createTestReturnCase({ productId = 'p1' } = {}) {
  const orderRes = await fetch(`${BACKEND_URL}/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ productId, quantity: 1 }], guestEmail: `supplier-returns-test-${Date.now()}@example.com` }),
  });
  const order = await orderRes.json();
  const subOrderId = order.supplierSubOrders[0].subOrderId;

  const caseRes = await fetch(`${BACKEND_URL}/returns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subOrderId,
      reason: 'Integration test reason',
      message: 'This is the buyer\'s private message that a supplier must NEVER see',
      guestEmail: `supplier-returns-test-${Date.now()}@example.com`,
    }),
  });
  return caseRes.json();
}

const backendUp = await isBackendUp();

describe.runIf(backendUp)('supplier return-case access against a REAL running backend', () => {
  it('supplier sees a case tied to their own sub-order (p1 belongs to s1)', async () => {
    const created = await createTestReturnCase({ productId: 'p1' });
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const cases = await fetchMyReturnCases(token);
    expect(cases.find((c) => c.id === created.id)).toBeDefined();
  });

  it('supplier does NOT see a case tied to a different supplier\'s sub-order (p4 belongs to s2)', async () => {
    const created = await createTestReturnCase({ productId: 'p4' });
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const cases = await fetchMyReturnCases(token);
    expect(cases.find((c) => c.id === created.id)).toBeUndefined();

    // Also confirm direct detail access is blocked, not just filtered from the list.
    await expect(fetchMyReturnCaseById(token, created.id)).rejects.toThrow();
  });

  it("CRITICAL: the supplier's case detail never includes the buyer's message, identity, or email", async () => {
    const created = await createTestReturnCase({ productId: 'p1' });
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const detail = await fetchMyReturnCaseById(token, created.id);

    // The buyer's actual message text must never appear anywhere in what
    // the supplier can fetch.
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain('NEVER see');
    expect(detail.buyerId).toBeUndefined();
    expect(detail.guestEmail).toBeUndefined();
    expect(detail.messages).toEqual([]); // no admin relay has happened yet
  });

  it('supplier reply only ever lands in the supplier thread, confirmed from the admin side too', async () => {
    const created = await createTestReturnCase({ productId: 'p1' });
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');

    await replyToReturnCase(supplierToken, created.id, 'We will send a replacement.');

    const supplierView = await fetchMyReturnCaseById(supplierToken, created.id);
    expect(supplierView.messages.length).toBe(1);
    expect(supplierView.messages[0].senderRole).toBe('supplier');

    // Cross-check from the admin side: the supplier's reply shows up in
    // supplierMessages, and the buyer thread is completely unaffected.
    const adminLogin = await login('admin@leap.dev', 'admin_dev_password_123');
    const adminDetailRes = await fetch(`${BACKEND_URL}/returns/${created.id}`, {
      headers: { Authorization: `Bearer ${adminLogin.token}` },
    });
    const adminDetail = await adminDetailRes.json();
    expect(adminDetail.supplierMessages.length).toBe(1);
    expect(adminDetail.supplierMessages[0].message).toBe('We will send a replacement.');
    expect(adminDetail.buyerMessages.length).toBe(1); // just the original buyer message
  });

  it('rejects a buyer account from accessing supplier return endpoints', async () => {
    const email = `returns-cross-role-${Date.now()}@example.com`;
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    });
    const { token: buyerToken } = await signupRes.json();
    await expect(fetchMyReturnCases(buyerToken)).rejects.toThrow();
  });

  it('rejects replying to a case that does not belong to this supplier', async () => {
    const created = await createTestReturnCase({ productId: 'p4' }); // belongs to s2
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123'); // s1
    await expect(replyToReturnCase(token, created.id, 'test')).rejects.toThrow();
  });
});
