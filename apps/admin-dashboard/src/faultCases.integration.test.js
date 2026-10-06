import { describe, it, expect } from 'vitest';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';
const TEST_ADDRESS = { recipientName: 'Test Buyer', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' };

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

const backendUp = await isBackendUp();

const json = { 'Content-Type': 'application/json' };
const auth = (token) => ({ ...json, Authorization: `Bearer ${token}` });
const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const adminToken = async () => (await login('admin@leap.dev', 'admin_dev_password_123')).token;
const supplierToken = async () => (await login('supplier@leap.dev', 'supplier_dev_password_123')).token;
// A DIFFERENT supplier account (the platform's own), used to prove one supplier can't touch another's case.
const otherSupplierToken = async () => (await login('leap-supplier@leap.dev', 'LeapSupplier2026!')).token;

// A brand-new hub with its own staff login, so each test's shipments and the hub's workload are its own.
async function createIsolatedHub() {
  const admin = await adminToken();
  const hub = await fetch(`${BACKEND_URL}/hub/locations`, { method: 'POST', headers: auth(admin), body: JSON.stringify({ name: `Fault Test Hub ${uniq()}`, region: 'Test Region' }) }).then((r) => r.json());
  const email = `fault-staff-${uniq()}@example.com`;
  const created = await fetch(`${BACKEND_URL}/hub-staff`, { method: 'POST', headers: auth(admin), body: JSON.stringify({ email, name: 'Fault Tester', hubId: hub.id }) }).then((r) => r.json());
  return { hubId: hub.id, hubToken: (await login(email, created.temporaryPassword)).token };
}

// Order for the seeded product p1 -> routed to a hub -> shipped -> received -> FLAGGED.
async function createFlaggedShipment() {
  const admin = await adminToken();
  const { hubId, hubToken } = await createIsolatedHub();
  const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `fault-buyer-${uniq()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
  const order = await fetch(`${BACKEND_URL}/order`, { method: 'POST', headers: json, body: JSON.stringify({ items: [{ productId: 'p1', quantity: 2 }], userId: buyer.user.id, address: TEST_ADDRESS }) }).then((r) => r.json());
  const subOrderId = order.supplierSubOrders[0].subOrderId;
  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, { method: 'PATCH', headers: auth(admin), body: JSON.stringify({ hubId }) });
  await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, { method: 'PATCH', headers: auth(await supplierToken()), body: JSON.stringify({ status: 'shipped' }) });
  const shipments = await fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: auth(hubToken) }).then((r) => r.json());
  const shipment = shipments.find((s) => s.subOrderId === subOrderId);
  const record = (step, extra = {}) => fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/events`, { method: 'POST', headers: auth(hubToken), body: JSON.stringify({ step, photos: ['/uploads/test.jpg'], ...extra }) });
  await record('received');
  expect((await record('flagged', { notes: 'Cracked housing', damageType: 'physical_damage' })).status).toBe(201);
  return { shipmentId: shipment.id, subOrderId, orderId: order.id, orderTotal: order.total, hubId, hubToken, buyerToken: buyer.token, record };
}

const post = async (path, body, token) => fetch(`${BACKEND_URL}${path}`, { method: 'POST', headers: auth(token || (await adminToken())), body: JSON.stringify(body) });
const openCase = (f, over = {}) => post('/fault-cases', { shipmentId: f.shipmentId, items: ['p1'], costBearer: 'supplier', notes: 'Confirmed by photo', ...over });
const queueEntry = async (shipmentId) => (await fetch(`${BACKEND_URL}/hub/flagged`, { headers: auth(await adminToken()) }).then((r) => r.json())).find((q) => q.id === shipmentId);
const returnCaseFor = async (shipmentId) => {
  const entry = await queueEntry(shipmentId);
  return entry?.returnCaseId ? fetch(`${BACKEND_URL}/returns/${entry.returnCaseId}`, { headers: auth(await adminToken()) }).then((r) => r.json()) : null;
};
const notificationsOf = async (token) => fetch(`${BACKEND_URL}/notifications/me`, { headers: auth(token) }).then((r) => r.json());
const workloadFor = async (hubId) => (await fetch(`${BACKEND_URL}/hub/workload`, { headers: auth(await adminToken()) }).then((r) => r.json())).find((h) => h.id === hubId);
const ARABIC = /[\u0600-\u06FF]/;

describe.runIf(backendUp)('fault cases: a real fault on a flagged shipment, against a REAL running backend', () => {
  it('CRITICAL: confirming a real fault opens a case, asks the supplier, and tells the buyer in both languages', async () => {
    const f = await createFlaggedShipment();
    const res = await openCase(f);
    expect(res.status).toBe(201);
    const { faultCase, returnCase } = await res.json();
    expect(faultCase.status).toBe('awaiting_supplier');
    expect(faultCase.costBearer).toBe('supplier');
    expect(faultCase.items).toEqual([expect.objectContaining({ productId: 'p1', quantity: 2 })]);
    expect(returnCase.status).toBe('in_progress');

    // the flag stays in the admin queue, now carrying its fault case
    const entry = await queueEntry(f.shipmentId);
    expect(entry.faultCase.id).toBe(faultCase.id);

    // the buyer's case thread and notification explain it in English AND Arabic
    const rc = await returnCaseFor(f.shipmentId);
    const message = rc.buyerMessages.at(-1).message;
    expect(message).toContain('Our inspection confirmed a problem');
    expect(message).toMatch(ARABIC);
    const buyerNote = (await notificationsOf(f.buyerToken)).find((n) => n.type === 'return_status' && n.linkId === f.orderId);
    expect(buyerNote).toBeTruthy();
    expect(buyerNote.body).toMatch(ARABIC);

    // the supplier is asked the replacement question
    const supplierNote = (await notificationsOf(await supplierToken())).find((n) => n.type === 'supplier_message' && n.linkId === f.orderId);
    expect(supplierNote.title).toBe(`Can you replace? Order ${f.orderId}`);
  }, 40000);

  it('rejects a bad request: cost bearer, no items, an item not in the shipment, a shipment that is not flagged, and a second case', async () => {
    const f = await createFlaggedShipment();
    expect((await openCase(f, { costBearer: 'the_moon' })).status).toBe(400);
    expect((await openCase(f, { items: [] })).status).toBe(400);
    const wrongItem = await openCase(f, { items: ['p4'] });
    expect(wrongItem.status).toBe(400);
    expect((await wrongItem.json()).error).toContain('not an item in this shipment');
    expect((await openCase(f, { shipmentId: 99999999 })).status).toBe(404);

    expect((await openCase(f)).status).toBe(201);
    const again = await openCase(f);
    expect(again.status).toBe(400);
    expect((await again.json()).error).toContain('already has a fault case');
  }, 40000);

  it('only an admin with the Flagged page can open or change a case', async () => {
    const f = await createFlaggedShipment();
    expect((await openCase(f, {}, undefined)).status).toBe(201);
    const caseId = (await queueEntry(f.shipmentId)).faultCase.id;
    for (const token of [f.hubToken, f.buyerToken, await supplierToken()]) {
      expect((await post('/fault-cases', { shipmentId: f.shipmentId, items: ['p1'], costBearer: 'leap' }, token)).status).toBe(403);
      expect((await post(`/fault-cases/${caseId}/confirm-refund`, {}, token)).status).toBe(403);
      expect((await post(`/fault-cases/${caseId}/mark-refunded`, { reference: 'abc' }, token)).status).toBe(403);
    }
    const anon = await fetch(`${BACKEND_URL}/fault-cases/${caseId}/confirm-refund`, { method: 'POST', headers: json, body: '{}' });
    expect(anon.status).toBe(401);
  }, 40000);

  it('CRITICAL: only the supplier whose order it is can answer; a "yes" needs a valid date; an answer is final', async () => {
    const f = await createFlaggedShipment();
    await openCase(f);
    const caseId = (await queueEntry(f.shipmentId)).faultCase.id;
    const answer = async (body, token) => fetch(`${BACKEND_URL}/fault-cases/supplier/me/${caseId}/answer`, { method: 'POST', headers: auth(token || (await supplierToken())), body: JSON.stringify(body) });

    // a different supplier cannot even tell the case exists
    expect((await answer({ canReplace: false }, await otherSupplierToken())).status).toBe(404);
    expect(((await fetch(`${BACKEND_URL}/fault-cases/supplier/me`, { headers: auth(await otherSupplierToken()) }).then((r) => r.json())).some((c) => c.id === caseId))).toBe(false);
    // admin and buyers are not suppliers
    expect((await answer({ canReplace: false }, await adminToken())).status).toBe(403);
    expect((await answer({ canReplace: false }, f.buyerToken)).status).toBe(403);

    expect((await answer({ canReplace: 'maybe' })).status).toBe(400);
    expect((await answer({ canReplace: true })).status).toBe(400); // a yes needs a date
    expect((await answer({ canReplace: true, eta: 'next week' })).status).toBe(400);
    expect((await answer({ canReplace: true, eta: '2001-01-01' })).status).toBe(400); // in the past

    const eta = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    const ok = await answer({ canReplace: true, eta, note: 'We have stock' });
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body).toMatchObject({ status: 'awaiting_admin', canReplace: true, eta, note: 'We have stock' });

    expect((await answer({ canReplace: false })).status).toBe(400); // already answered

    // the admin sees the answer
    const seen = (await queueEntry(f.shipmentId)).faultCase;
    expect(seen.status).toBe('awaiting_admin');
    expect(seen.supplier).toMatchObject({ answered: true, canReplace: true, eta, note: 'We have stock' });
  }, 40000);

  it("the supplier sees the question and how it ended, but never the platform's private details or the refund amount", async () => {
    const f = await createFlaggedShipment();
    await openCase(f, { costBearer: 'leap', notes: 'PRIVATE: supplier is repeat offender' });
    const mine = (await fetch(`${BACKEND_URL}/fault-cases/supplier/me`, { headers: auth(await supplierToken()) }).then((r) => r.json())).find((c) => c.orderId === f.orderId);
    expect(mine).toBeTruthy();
    expect(mine.status).toBe('awaiting_supplier');
    const blob = JSON.stringify(mine);
    expect(blob).not.toContain('PRIVATE');
    expect(blob).not.toMatch(/costBearer|cost_bearer|refund|adminNotes/i);
  }, 40000);

  it('CRITICAL: a refund is confirmed (default = the faulty items\' value), then marked issued with a reference; the buyer is told at each step', async () => {
    const f = await createFlaggedShipment();
    await openCase(f);
    const caseId = (await queueEntry(f.shipmentId)).faultCase.id;
    const unitPrice = (await queueEntry(f.shipmentId)).faultCase.items[0].unitPrice;

    // bad amounts
    expect((await post(`/fault-cases/${caseId}/confirm-refund`, { amount: 0 })).status).toBe(400);
    expect((await post(`/fault-cases/${caseId}/confirm-refund`, { amount: -5 })).status).toBe(400);
    expect((await post(`/fault-cases/${caseId}/confirm-refund`, { amount: 999999 })).status).toBe(400); // more than the order total
    // marking refunded before confirming it is refused
    expect((await post(`/fault-cases/${caseId}/mark-refunded`, { reference: 're_123' })).status).toBe(400);

    const confirm = await post(`/fault-cases/${caseId}/confirm-refund`, {});
    expect(confirm.status).toBe(200);
    const confirmed = await confirm.json();
    expect(confirmed.faultCase.status).toBe('refund_pending');
    expect(confirmed.faultCase.refund).toMatchObject({ status: 'pending', amount: Number((unitPrice * 2).toFixed(2)) });
    expect(confirmed.returnCase.status).toBe('approved');
    expect((await returnCaseFor(f.shipmentId)).buyerMessages.at(-1).message).toMatch(/We are refunding \$/);
    expect((await post(`/fault-cases/${caseId}/confirm-refund`, {})).status).toBe(400); // can't confirm twice

    // marking it issued needs a traceable reference
    expect((await post(`/fault-cases/${caseId}/mark-refunded`, {})).status).toBe(400);
    expect((await post(`/fault-cases/${caseId}/mark-refunded`, { reference: 'x' })).status).toBe(400);
    const issued = await post(`/fault-cases/${caseId}/mark-refunded`, { reference: 're_3PxABC123' });
    expect(issued.status).toBe(200);
    const done = await issued.json();
    expect(done.faultCase.refund).toMatchObject({ status: 'issued', reference: 're_3PxABC123' });

    const message = (await returnCaseFor(f.shipmentId)).buyerMessages.at(-1).message;
    expect(message).toContain('has been issued (reference: re_3PxABC123)');
    expect(message).toMatch(ARABIC);

    // not complete yet: the hub hasn't dealt with the unit, so the flag is still in the queue
    expect(done.faultCase.status).toBe('refund_pending');
    expect(await queueEntry(f.shipmentId)).toBeTruthy();
  }, 60000);

  it('an admin may override and refund before the supplier answers, and can set a smaller amount', async () => {
    const f = await createFlaggedShipment();
    await openCase(f, { costBearer: 'leap' });
    const caseId = (await queueEntry(f.shipmentId)).faultCase.id;
    const res = await post(`/fault-cases/${caseId}/confirm-refund`, { amount: 12.5 });
    expect(res.status).toBe(200);
    expect((await res.json()).faultCase.refund.amount).toBe(12.5);
  }, 40000);

  it('CRITICAL: the hub returns the unit (tracking + photo needed); the unit leaves the hub\'s workload; the buyer sees a return and cannot cancel the part', async () => {
    const f = await createFlaggedShipment();
    // before a fault is confirmed there is nothing to send back
    const early = await f.record('returned_to_supplier', { trackingNumber: 'RET-1' });
    expect(early.status).toBe(400);
    expect((await early.json()).error).toContain('no fault case');

    await openCase(f);
    expect((await workloadFor(f.hubId)).totalWorkload).toBe(1);

    // the hub sees WHAT to send back -- and none of the platform's money
    const hubView = await fetch(`${BACKEND_URL}/hub/me/shipments/${f.shipmentId}`, { headers: auth(f.hubToken) }).then((r) => r.json());
    expect(hubView.faultCase).toMatchObject({ needsReturn: true, hubReturn: null, items: [expect.objectContaining({ productId: 'p1' })] });
    expect(JSON.stringify(hubView.faultCase)).not.toMatch(/refund|costBearer|cost_bearer|supplier.*answer|notes/i);

    // tracking is required to return it to the supplier
    expect((await f.record('returned_to_supplier')).status).toBe(400);
    const sent = await f.record('returned_to_supplier', { trackingNumber: 'RET-998877', notes: 'Packed and collected' });
    expect(sent.status).toBe(201);
    expect((await sent.json()).status).toBe('returned_to_supplier');

    expect((await workloadFor(f.hubId)).totalWorkload).toBe(0); // it physically left
    expect((await f.record('returned_to_supplier', { trackingNumber: 'RET-2' })).status).toBe(400); // not twice
    expect((await f.record('discarded_at_hub')).status).toBe(400);

    // the buyer's order still shows as a return, and they can no longer cancel the part
    const order = await fetch(`${BACKEND_URL}/order/${f.orderId}`, { headers: auth(f.buyerToken) }).then((r) => r.json());
    // `displayStatus` is what buyers see; an order with an open return case always shows as 'returns'
    expect(order.displayStatus).toBe('returns');
    const cancel = await fetch(`${BACKEND_URL}/order/${f.orderId}/sub-orders/${f.subOrderId}/cancel`, { method: 'POST', headers: auth(f.buyerToken), body: '{}' });
    expect(cancel.status).toBe(400);
  }, 60000);

  it('the hub can discard a unit instead of shipping it back (no tracking needed)', async () => {
    const f = await createFlaggedShipment();
    await openCase(f);
    const res = await f.record('discarded_at_hub', { notes: 'Not worth shipping back' });
    expect(res.status).toBe(201);
    expect((await res.json()).status).toBe('discarded_at_hub');
    const entry = await queueEntry(f.shipmentId);
    expect(entry.hubStatus).toBe('discarded_at_hub'); // still in the queue: the refund is still to do
    expect(entry.faultCase.hubReturn).toBe('discarded');
  }, 40000);

  it('CRITICAL: the case completes only when BOTH the refund is issued and the unit is back -- in either order -- and then the flag is closed', async () => {
    // order A: refund first, then the hub
    const a = await createFlaggedShipment();
    await openCase(a);
    const caseA = (await queueEntry(a.shipmentId)).faultCase.id;
    await post(`/fault-cases/${caseA}/confirm-refund`, {});
    await post(`/fault-cases/${caseA}/mark-refunded`, { reference: 'ref-A-001' });
    expect(await queueEntry(a.shipmentId)).toBeTruthy(); // refund alone is not enough
    await a.record('returned_to_supplier', { trackingNumber: 'RET-A' });
    expect(await queueEntry(a.shipmentId)).toBeUndefined(); // now closed
    const rcA = await fetch(`${BACKEND_URL}/returns/${(await adminReturnCaseId(a))}`, { headers: auth(await adminToken()) }).then((r) => r.json());
    expect(rcA.status).toBe('completed');
    expect(rcA.buyerMessages.at(-1).message).toContain('This case is now closed');

    // order B: the hub first, then the refund
    const b = await createFlaggedShipment();
    await openCase(b);
    const caseB = (await queueEntry(b.shipmentId)).faultCase.id;
    await b.record('returned_to_supplier', { trackingNumber: 'RET-B' });
    await post(`/fault-cases/${caseB}/confirm-refund`, {});
    expect(await queueEntry(b.shipmentId)).toBeTruthy(); // the hub alone is not enough
    const finished = await (await post(`/fault-cases/${caseB}/mark-refunded`, { reference: 'ref-B-001' })).json();
    expect(finished.faultCase.status).toBe('completed');
    expect(await queueEntry(b.shipmentId)).toBeUndefined();
  }, 90000);

  it('a shipment with a confirmed fault can no longer be recorded as "no fault"', async () => {
    const f = await createFlaggedShipment();
    await openCase(f);
    const res = await fetch(`${BACKEND_URL}/hub/flagged/${f.shipmentId}/resolve`, { method: 'PATCH', headers: auth(await adminToken()), body: JSON.stringify({ resolution: 'continue_processing' }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('real fault has already been confirmed');
  }, 40000);

  it('every step is in the audit log, and the refund reference is recorded', async () => {
    const f = await createFlaggedShipment();
    await openCase(f);
    const caseId = (await queueEntry(f.shipmentId)).faultCase.id;
    await post(`/fault-cases/${caseId}/confirm-refund`, {});
    await post(`/fault-cases/${caseId}/mark-refunded`, { reference: 'audit-ref-77' });
    const log = await fetch(`${BACKEND_URL}/admin/audit-log`, { headers: auth(await adminToken()) }).then((r) => r.json());
    const mine = (Array.isArray(log) ? log : log.entries).filter((e) => e.targetType === 'fault_case' && String(e.targetId) === String(caseId));
    expect(mine.map((e) => e.action).sort()).toEqual(['fault_case_created', 'fault_case_refund_confirmed', 'fault_case_refund_issued']);
    expect(mine.find((e) => e.action === 'fault_case_refund_issued').details.reference).toBe('audit-ref-77');
  }, 40000);
});

// the return case id of a flagged shipment, even after it has left the queue
async function adminReturnCaseId(f) {
  const rows = await fetch(`${BACKEND_URL}/returns`, { headers: auth(await adminToken()) }).then((r) => r.json());
  return rows.find((c) => c.orderId === f.orderId)?.id;
}
