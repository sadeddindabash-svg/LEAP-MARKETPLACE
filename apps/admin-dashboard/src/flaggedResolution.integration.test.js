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

// A brand-new hub with its own staff login, so a test's shipments (and the hub's workload) belong to
// that test alone -- other test files run at the same time against the same database.
async function createIsolatedHub() {
  const admin = await adminToken();
  const hub = await fetch(`${BACKEND_URL}/hub/locations`, { method: 'POST', headers: auth(admin), body: JSON.stringify({ name: `Flag Test Hub ${uniq()}`, region: 'Test Region' }) }).then((r) => r.json());
  const email = `flag-staff-${uniq()}@example.com`;
  const created = await fetch(`${BACKEND_URL}/hub-staff`, { method: 'POST', headers: auth(admin), body: JSON.stringify({ email, name: 'Flag Tester', hubId: hub.id }) }).then((r) => r.json());
  const hubToken = (await login(email, created.temporaryPassword)).token;
  return { hubId: hub.id, hubToken };
}

// Places an order for the seeded product p1, routes it to the hub, ships it, receives it at the hub and
// flags it. `guest: true` places the order as a guest (no account).
async function createFlaggedShipment({ damageType, guest = false } = {}) {
  const admin = await adminToken();
  const { hubId, hubToken } = await createIsolatedHub();

  let buyerToken = null;
  let orderBody = { items: [{ productId: 'p1', quantity: 1 }], address: TEST_ADDRESS };
  if (guest) {
    orderBody = { ...orderBody, guestEmail: `flag-guest-${uniq()}@example.com` };
  } else {
    const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `flag-buyer-${uniq()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
    buyerToken = buyer.token;
    orderBody = { ...orderBody, userId: buyer.user.id };
  }
  const order = await fetch(`${BACKEND_URL}/order`, { method: 'POST', headers: json, body: JSON.stringify(orderBody) }).then((r) => r.json());
  const subOrderId = order.supplierSubOrders[0].subOrderId;

  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, { method: 'PATCH', headers: auth(admin), body: JSON.stringify({ hubId }) });
  await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, { method: 'PATCH', headers: auth(await supplierToken()), body: JSON.stringify({ status: 'shipped' }) });

  const shipments = await fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: auth(hubToken) }).then((r) => r.json());
  const shipment = shipments.find((s) => s.subOrderId === subOrderId);
  const record = (step, extra = {}) => fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/events`, { method: 'POST', headers: auth(hubToken), body: JSON.stringify({ step, photos: ['/uploads/test.jpg'], ...extra }) });
  await record('received');
  const flagRes = await record('flagged', { notes: 'Box crushed on arrival', damageType });
  expect(flagRes.status).toBe(201);

  const queue = await fetch(`${BACKEND_URL}/hub/flagged`, { headers: auth(admin) }).then((r) => r.json());
  const entry = queue.find((q) => q.id === shipment.id);
  return { shipmentId: shipment.id, subOrderId, orderId: order.id, hubId, hubToken, buyerToken, queueEntry: entry, returnCaseId: entry?.returnCaseId };
}

const resolve = async (shipmentId, body, token) =>
  fetch(`${BACKEND_URL}/hub/flagged/${shipmentId}/resolve`, { method: 'PATCH', headers: auth(token || (await adminToken())), body: JSON.stringify(body) });
const getCase = async (caseId) => fetch(`${BACKEND_URL}/returns/${caseId}`, { headers: auth(await adminToken()) }).then((r) => r.json());
const queueIds = async () => (await fetch(`${BACKEND_URL}/hub/flagged`, { headers: auth(await adminToken()) }).then((r) => r.json())).map((q) => q.id);
const workloadFor = async (hubId) => (await fetch(`${BACKEND_URL}/hub/workload`, { headers: auth(await adminToken()) }).then((r) => r.json())).find((h) => h.id === hubId);
const hubDetail = (shipmentId, hubToken) => fetch(`${BACKEND_URL}/hub/me/shipments/${shipmentId}`, { headers: auth(hubToken) }).then((r) => r.json());

describe.runIf(backendUp)('resolving a flagged hub shipment against a REAL running backend', () => {
  it('a flag can carry a kind of problem, which the admin queue shows; an invalid kind is rejected', async () => {
    const f = await createFlaggedShipment({ damageType: 'water_damage' });
    expect(f.queueEntry).toBeTruthy();
    expect(f.queueEntry.damageType).toBe('water_damage');
    expect(f.returnCaseId).toBeTruthy(); // the flag opened a return case

    // an invalid kind is refused (on a fresh shipment at a valid step, so only the kind is wrong)
    const bad = await fetch(`${BACKEND_URL}/hub/me/shipments/${f.shipmentId}/events`, { method: 'POST', headers: auth(f.hubToken), body: JSON.stringify({ step: 'flagged', photos: ['/uploads/test.jpg'], damageType: 'not_a_kind' }) });
    expect(bad.status).toBe(400);
  }, 30000);

  it('CRITICAL: "continue processing" puts the shipment back in the flow, so the hub can carry on; the case is closed and the buyer told', async () => {
    const f = await createFlaggedShipment({ damageType: 'other' });
    const res = await resolve(f.shipmentId, { resolution: 'continue_processing', resolutionNotes: 'False alarm' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('received'); // back to the last real step, not stuck at 'flagged'
    expect(body.resolution).toBe('continue_processing');
    expect(body.returnCase).toEqual({ id: f.returnCaseId, status: 'rejected', updated: true });

    expect(await queueIds()).not.toContain(f.shipmentId);
    const detail = await hubDetail(f.shipmentId, f.hubToken);
    expect(detail.status).toBe('received');
    expect(detail.resolution).toBe('continue_processing');
    expect(detail.resolutionNotes).toBeUndefined(); // the admin's internal note is not shown to hub staff

    // The hub can genuinely keep going -- this is exactly what used to be impossible.
    const next = await fetch(`${BACKEND_URL}/hub/me/shipments/${f.shipmentId}/events`, { method: 'POST', headers: auth(f.hubToken), body: JSON.stringify({ step: 'opened', photos: ['/uploads/test.jpg'] }) });
    expect(next.status).toBe(201);

    const rc = await getCase(f.returnCaseId);
    expect(rc.status).toBe('rejected');
    expect(rc.buyerMessages.at(-1).message).toContain('no problem');

    const notifications = await fetch(`${BACKEND_URL}/notifications/me`, { headers: auth(f.buyerToken) }).then((r) => r.json());
    const note = notifications.find((n) => n.type === 'return_status' && n.linkId === f.orderId);
    expect(note).toBeTruthy();
    expect(note.body).toBe(`Return ${f.returnCaseId} is now rejected.`);
  }, 40000);

  it('CRITICAL: a case an admin already finalised by hand is left alone: no status change, no extra message, no second notification', async () => {
    const f = await createFlaggedShipment();
    await fetch(`${BACKEND_URL}/returns/${f.returnCaseId}`, { method: 'PATCH', headers: auth(await adminToken()), body: JSON.stringify({ status: 'completed' }) });
    const messagesBefore = (await getCase(f.returnCaseId)).buyerMessages.length;

    const res = await resolve(f.shipmentId, { resolution: 'continue_processing' });
    expect(res.status).toBe(200);
    expect((await res.json()).returnCase).toEqual({ id: f.returnCaseId, status: 'completed', updated: false });

    const rc = await getCase(f.returnCaseId);
    expect(rc.status).toBe('completed');
    expect(rc.buyerMessages.length).toBe(messagesBefore);
  }, 40000);

  it('works for a guest buyer (no account to notify) and still closes the case', async () => {
    const f = await createFlaggedShipment({ guest: true });
    const res = await resolve(f.shipmentId, { resolution: 'continue_processing' });
    expect(res.status).toBe(200);
    expect((await res.json()).returnCase.status).toBe('rejected');
    expect((await getCase(f.returnCaseId)).status).toBe('rejected');
  }, 40000);

  it('rejects an unknown outcome, resolving twice, a shipment that is not flagged, and an unknown id', async () => {
    const f = await createFlaggedShipment();
    expect((await resolve(f.shipmentId, { resolution: 'make_it_vanish' })).status).toBe(400);
    expect((await resolve(f.shipmentId, {})).status).toBe(400);

    // the old terminal outcomes are gone from this endpoint: a REAL fault is a fault case now
    const old = await resolve(f.shipmentId, { resolution: 'discard' });
    expect(old.status).toBe(400);
    expect((await old.json()).error).toContain('fault case');

    expect((await resolve(f.shipmentId, { resolution: 'continue_processing' })).status).toBe(200);
    // after "no fault" the shipment is back in the flow: not a flag any more, so it can't be resolved again
    expect((await resolve(f.shipmentId, { resolution: 'continue_processing' })).status).toBe(400);

    expect((await resolve(99999999, { resolution: 'continue_processing' })).status).toBe(404);
  }, 60000);

  it('only an admin with access to the Flagged page can resolve; hub staff, buyers and anonymous callers cannot', async () => {
    const f = await createFlaggedShipment();
    expect((await resolve(f.shipmentId, { resolution: 'continue_processing' }, f.hubToken)).status).toBe(403);
    expect((await resolve(f.shipmentId, { resolution: 'continue_processing' }, f.buyerToken)).status).toBe(403);
    const anon = await fetch(`${BACKEND_URL}/hub/flagged/${f.shipmentId}/resolve`, { method: 'PATCH', headers: json, body: JSON.stringify({ resolution: 'continue_processing' }) });
    expect(anon.status).toBe(401);
    expect(await queueIds()).toContain(f.shipmentId); // none of those changed anything
  }, 40000);

  it('every resolution is in the audit log with its outcome', async () => {
    const f = await createFlaggedShipment();
    await resolve(f.shipmentId, { resolution: 'continue_processing' });
    const log = await fetch(`${BACKEND_URL}/admin/audit-log?action=flagged_shipment_resolved`, { headers: auth(await adminToken()) }).then((r) => r.json());
    const entry = (Array.isArray(log) ? log : log.entries).find((e) => String(e.targetId) === String(f.shipmentId));
    expect(entry).toBeTruthy();
    expect(entry.details.resolution).toBe('continue_processing');
    expect(entry.details.returnCaseId).toBe(f.returnCaseId);
  }, 40000);
});
