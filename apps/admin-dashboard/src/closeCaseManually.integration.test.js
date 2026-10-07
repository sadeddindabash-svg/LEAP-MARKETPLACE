// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import { Pool } from 'pg';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';
// Direct DB access for inspection only (the case's own fields, the shipment's resolution), same approach as payouts.integration.test.js.
const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev';
const ADDRESS = { recipientName: 'John Smith', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' };

async function isBackendUp() {
  try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; }
}
const backendUp = await isBackendUp();

const json = { 'Content-Type': 'application/json' };
const auth = (token) => ({ ...json, Authorization: `Bearer ${token}` });
const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const ARABIC = /[\u0600-\u06FF]/;
const adminToken = async () => (await login('admin@leap.dev', 'admin_dev_password_123')).token;
const supplierToken = async () => (await login('supplier@leap.dev', 'supplier_dev_password_123')).token;
const hubToken = async () => (await login('hub@leap.dev', 'hub_dev_password_123')).token;
const pool = new Pool({ connectionString: TEST_DB_URL });
afterAll(async () => { await pool.end(); });
const in5Days = () => new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);

const record = async (shipmentId, step, extra = {}) => fetch(`${BACKEND_URL}/hub/me/shipments/${shipmentId}/events`, { method: 'POST', headers: auth(await hubToken()), body: JSON.stringify({ step, photos: ['/uploads/test.jpg'], ...extra }) });
const hubShipmentOfSub = async (subOrderId) => (await fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: auth(await hubToken()) }).then((r) => r.json())).find((s) => s.subOrderId === subOrderId);
const post = async (path, body, token) => fetch(`${BACKEND_URL}${path}`, { method: 'POST', headers: auth(token || (await adminToken())), body: JSON.stringify(body || {}) });
const inQueue = async (shipmentId) => (await fetch(`${BACKEND_URL}/hub/flagged`, { headers: auth(await adminToken()) }).then((r) => r.json())).some((q) => q.id === shipmentId);
const caseRow = async (caseId) => (await pool.query('SELECT status, outcome, completed_at, closed_manually_by, closed_manually_note FROM fault_cases WHERE id = $1', [caseId])).rows[0];
const shipmentRow = async (shipmentId) => (await pool.query('SELECT resolution, resolved_at FROM hub_shipments WHERE id = $1', [shipmentId])).rows[0];
const close = (caseId, note, token) => post(`/fault-cases/${caseId}/close`, note === undefined ? {} : { note }, token);

// A flagged shipment with a fault case opened. `answered` = the supplier has said they can replace it.
async function flaggedCase({ answered = false } = {}) {
  const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `cc-buyer-${uniq()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
  const order = await fetch(`${BACKEND_URL}/order`, { method: 'POST', headers: json, body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.user.id, address: ADDRESS }) }).then((r) => r.json());
  const subOrderId = order.supplierSubOrders[0].subOrderId;
  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, { method: 'PATCH', headers: auth(await adminToken()), body: JSON.stringify({ hubId: 'hub_guangzhou' }) });
  await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, { method: 'PATCH', headers: auth(await supplierToken()), body: JSON.stringify({ status: 'shipped' }) });
  const shipment = await hubShipmentOfSub(subOrderId);
  await record(shipment.id, 'received');
  expect((await record(shipment.id, 'flagged', { notes: 'Cracked housing', damageType: 'physical_damage' })).status).toBe(201);
  expect((await post('/fault-cases', { shipmentId: shipment.id, items: ['p1'], costBearer: 'supplier' })).status).toBe(201);
  const caseId = (await fetch(`${BACKEND_URL}/hub/flagged`, { headers: auth(await adminToken()) }).then((r) => r.json())).find((q) => q.id === shipment.id).faultCase.id;
  if (answered) expect((await post(`/fault-cases/supplier/me/${caseId}/answer`, { canReplace: true, eta: in5Days() }, await supplierToken())).status).toBe(200);
  return { orderId: order.id, shipmentId: shipment.id, caseId, buyerToken: buyer.token };
}

describe.runIf(backendUp)('closing a fault case by hand (real backend)', () => {
  it('CRITICAL: a written reason is required, only an admin can close, and every refusal leaves the case and the flag exactly as they were', async () => {
    const c = await flaggedCase();
    for (const bad of [undefined, '', '   ', 'no', 'x'.repeat(501)]) {
      const res = await close(c.caseId, bad);
      expect(res.status).toBe(400);
    }
    for (const token of [c.buyerToken, await supplierToken(), await hubToken()]) expect((await close(c.caseId, 'Closing it for a good reason', token)).status).toBe(403);
    expect((await close(999999, 'Closing a case that does not exist')).status).toBe(404);
    expect(await caseRow(c.caseId)).toMatchObject({ status: 'awaiting_supplier', closed_manually_by: null });
    expect(await inQueue(c.shipmentId)).toBe(true);
    expect((await shipmentRow(c.shipmentId)).resolved_at).toBeNull();
  }, 90000);

  it('CRITICAL: closing a stuck case takes the flag out of the hub queue, records who and why, closes the buyer\'s return case and tells the buyer (both languages); it is audit-logged', async () => {
    const c = await flaggedCase();
    const res = await close(c.caseId, '  The hub never confirmed the return; agreed with the supplier  ');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.faultCase.status).toBe('completed');
    expect(body.faultCase.closedManually).toMatchObject({ note: 'The hub never confirmed the return; agreed with the supplier' });
    expect(body.returnCase).toMatchObject({ status: 'completed', updated: true });

    const row = await caseRow(c.caseId);
    expect(row).toMatchObject({ status: 'completed', closed_manually_note: 'The hub never confirmed the return; agreed with the supplier' });
    expect(row.closed_manually_by).toBeTruthy();
    expect(row.completed_at).not.toBeNull();
    expect(await shipmentRow(c.shipmentId)).toMatchObject({ resolution: 'fault_closed_manually' });
    expect((await shipmentRow(c.shipmentId)).resolved_at).not.toBeNull();
    expect(await inQueue(c.shipmentId)).toBe(false);                          // the flag has left the queue

    const en = (await fetch(`${BACKEND_URL}/notifications/me`, { headers: auth(c.buyerToken) }).then((r) => r.json())).find((n) => n.body.includes('This case is now closed'));
    expect(en).toBeTruthy();
    const ar = (await fetch(`${BACKEND_URL}/notifications/me?lang=ar`, { headers: auth(c.buyerToken) }).then((r) => r.json())).find((n) => n.id === en.id);
    expect(ar.body).toMatch(ARABIC);

    const log = await fetch(`${BACKEND_URL}/admin/audit-log?action=fault_case_closed_manually`, { headers: auth(await adminToken()) }).then((r) => r.json());
    expect((Array.isArray(log) ? log : log.entries).some((e) => e.targetId === String(c.caseId))).toBe(true);
  }, 90000);

  it('a case that is already closed cannot be closed again, and nothing about it changes', async () => {
    const c = await flaggedCase();
    expect((await close(c.caseId, 'First close, for a good reason')).status).toBe(200);
    const before = await caseRow(c.caseId);
    const again = await close(c.caseId, 'Second close, should be refused');
    expect(again.status).toBe(400);
    expect((await again.json()).error).toMatch(/already closed/i);
    expect(await caseRow(c.caseId)).toEqual(before);                           // the original reason is not overwritten
  }, 90000);

  it('CRITICAL: it is never a way round money: while the buyer is owed a refund that has not been recorded as issued, the case cannot be closed; once it is recorded, it can', async () => {
    const c = await flaggedCase({ answered: true });
    expect((await post(`/fault-cases/${c.caseId}/confirm-refund`, {})).status).toBe(200);
    const refused = await close(c.caseId, 'Trying to skip the refund');
    expect(refused.status).toBe(400);
    expect((await refused.json()).error).toMatch(/refund.*not been recorded as issued/i);
    expect((await caseRow(c.caseId)).status).not.toBe('completed');
    expect(await inQueue(c.shipmentId)).toBe(true);

    expect((await post(`/fault-cases/${c.caseId}/mark-refunded`, { reference: 're_test_123' })).status).toBe(200);
    const row = await caseRow(c.caseId);
    if (row.status !== 'completed') {                                          // the hub has not returned the unit yet: the stuck case an admin may now close
      expect((await close(c.caseId, 'Refund issued; the hub will not return the unit')).status).toBe(200);
    }
    expect((await caseRow(c.caseId)).status).toBe('completed');
    expect(await inQueue(c.shipmentId)).toBe(false);
  }, 120000);

  it('a case with a replacement on its way, or one the supplier has not answered yet, can be closed by an admin\'s judgement', async () => {
    const replacement = await flaggedCase({ answered: true });
    expect((await post(`/fault-cases/${replacement.caseId}/confirm-replacement`, {})).status).toBe(200);
    expect((await caseRow(replacement.caseId)).status).toBe('replacement_pending');
    expect((await close(replacement.caseId, 'Replacement cancelled by agreement with the buyer')).status).toBe(200);
    expect((await caseRow(replacement.caseId)).status).toBe('completed');

    const unanswered = await flaggedCase();
    expect((await close(unanswered.caseId, 'This case was opened twice by mistake')).status).toBe(200);
    expect(await inQueue(unanswered.shipmentId)).toBe(false);
  }, 120000);
});
