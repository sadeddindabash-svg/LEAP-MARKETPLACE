import { describe, it, expect } from 'vitest';
import {
  login, fetchTickets, fetchTicketById, replyToTicket,
  fetchReturnCases, fetchReturnCaseById, replyToReturnCaseSupplier,
} from './auth';

/**
 * Lives in the admin-dashboard app (not supplier-portal or a shared
 * location) because it needs the ADMIN-side helper functions already
 * defined in this app's auth.js (login as admin, replyToTicket,
 * replyToReturnCaseSupplier) to simulate the platform-staff half of these
 * cross-role interactions. The buyer-side calls use plain fetch directly,
 * matching exactly what the mobile app's ApiClient does — no special
 * client library needed for those, since this is really testing the
 * BACKEND's buyer-facing endpoints against a real server, not this app's
 * own UI. Test location is about "which auth.js has the helpers I need,"
 * not "which app owns this feature."
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

async function signupBuyer() {
  const email = `buyer-gap-test-${Date.now()}-${Math.random()}@example.com`;
  const res = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' }),
  });
  return res.json(); // { token, user }
}

const backendUp = await isBackendUp();

describe.runIf(backendUp)('buyer-side ticket and return-case viewing (closing a previously flagged gap)', () => {
  it('buyer creates and views their own ticket', async () => {
    const { token: buyerToken } = await signupBuyer();
    const createRes = await fetch(`${BACKEND_URL}/support/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
      body: JSON.stringify({ subject: 'Gap-closing test', message: 'Initial message' }),
    });
    const created = await createRes.json();

    const myTicketsRes = await fetch(`${BACKEND_URL}/support/my-tickets`, { headers: { Authorization: `Bearer ${buyerToken}` } });
    const myTickets = await myTicketsRes.json();
    expect(myTickets.find((t) => t.id === created.id)).toBeDefined();
  });

  it('a second buyer cannot see the first buyer\'s ticket, in the list or by direct ID', async () => {
    const { token: buyerAToken } = await signupBuyer();
    const createRes = await fetch(`${BACKEND_URL}/support/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerAToken}` },
      body: JSON.stringify({ subject: 'Private to buyer A', message: 'Should never leak to buyer B' }),
    });
    const created = await createRes.json();

    const { token: buyerBToken } = await signupBuyer();
    const listRes = await fetch(`${BACKEND_URL}/support/my-tickets`, { headers: { Authorization: `Bearer ${buyerBToken}` } });
    const list = await listRes.json();
    expect(list.find((t) => t.id === created.id)).toBeUndefined();

    const directRes = await fetch(`${BACKEND_URL}/support/my-tickets/${created.id}`, { headers: { Authorization: `Bearer ${buyerBToken}` } });
    expect(directRes.status).toBe(404);
  });

  it('buyer sends a follow-up on their own ticket, and an admin reply is visible to them', async () => {
    const { token: buyerToken } = await signupBuyer();
    const createRes = await fetch(`${BACKEND_URL}/support/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
      body: JSON.stringify({ subject: 'Follow-up test', message: 'Initial' }),
    });
    const created = await createRes.json();

    await fetch(`${BACKEND_URL}/support/my-tickets/${created.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
      body: JSON.stringify({ message: 'A follow-up from the buyer' }),
    });

    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    await replyToTicket(adminToken, created.id, 'A reply from the platform');

    const detailRes = await fetch(`${BACKEND_URL}/support/my-tickets/${created.id}`, { headers: { Authorization: `Bearer ${buyerToken}` } });
    const detail = await detailRes.json();
    expect(detail.messages.length).toBe(3);
    expect(detail.messages[2].senderRole).toBe('admin');
  });

  it('CRITICAL: a buyer viewing their own return case never sees the supplier thread', async () => {
    const { token: buyerToken, user: buyer } = await signupBuyer();

    const orderRes = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer?.id }),
    });
    const order = await orderRes.json();
    const subOrderId = order.supplierSubOrders[0].subOrderId;

    const caseRes = await fetch(`${BACKEND_URL}/returns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
      body: JSON.stringify({ subOrderId, reason: 'Gap test', message: 'Buyer-only message, must stay private from supplier view logic test' }),
    });
    const created = await caseRes.json();

    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    await replyToReturnCaseSupplier(adminToken, created.id, 'Supplier-facing note the buyer must never see');

    const buyerViewRes = await fetch(`${BACKEND_URL}/returns/my-cases/${created.id}`, { headers: { Authorization: `Bearer ${buyerToken}` } });
    const buyerView = await buyerViewRes.json();

    const serialized = JSON.stringify(buyerView);
    expect(serialized).not.toContain('Supplier-facing note');
    expect(buyerView.supplierMessages).toBeUndefined();
    expect(buyerView.messages.length).toBe(1); // just their own original message
  });

  it('a second buyer cannot see the first buyer\'s return case', async () => {
    const { token: buyerAToken, user: buyerA } = await signupBuyer();
    const orderRes = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerAToken}` },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyerA?.id }),
    });
    const order = await orderRes.json();
    const subOrderId = order.supplierSubOrders[0].subOrderId;
    const caseRes = await fetch(`${BACKEND_URL}/returns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerAToken}` },
      body: JSON.stringify({ subOrderId, reason: 'test', message: 'test' }),
    });
    const created = await caseRes.json();

    const { token: buyerBToken } = await signupBuyer();
    const listRes = await fetch(`${BACKEND_URL}/returns/my-cases`, { headers: { Authorization: `Bearer ${buyerBToken}` } });
    const list = await listRes.json();
    expect(list.find((c) => c.id === created.id)).toBeUndefined();

    const directRes = await fetch(`${BACKEND_URL}/returns/my-cases/${created.id}`, { headers: { Authorization: `Bearer ${buyerBToken}` } });
    expect(directRes.status).toBe(404);
  });
});
