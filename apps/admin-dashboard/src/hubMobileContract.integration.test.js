// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { login } from './auth';

// The hub PHONE app (Flutter) cannot be run where these tests run. This test does exactly what the app does, request by request, against the REAL backend,
// and checks the replies contain exactly the fields the app's models read (apps/hub-mobile/lib/models/shipment.dart). If the server and the app ever drift
// apart, this fails.
const BACKEND_URL = 'http://localhost:4000';
async function isBackendUp() {
  try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; }
}
const backendUp = await isBackendUp();
const json = { 'Content-Type': 'application/json' };
const auth = (token) => ({ ...json, Authorization: `Bearer ${token}` });
const ADDRESS = { recipientName: 'John Smith', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' };
const adminToken = async () => (await login('admin@leap.dev', 'admin_dev_password_123')).token;
const hubToken = async () => (await login('hub@leap.dev', 'hub_dev_password_123')).token;
const supplierToken = async () => (await login('supplier@leap.dev', 'supplier_dev_password_123')).token;

async function flaggedShipment() {
  const admin = await adminToken(); const hub = await hubToken(); const supplier = await supplierToken();
  const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `hubapp.${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
  const order = await fetch(`${BACKEND_URL}/order`, { method: 'POST', headers: json, body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.user.id, address: ADDRESS }) }).then((r) => r.json());
  const subOrderId = order.supplierSubOrders[0].subOrderId;
  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, { method: 'PATCH', headers: auth(admin), body: JSON.stringify({ hubId: 'hub_guangzhou' }) });
  await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, { method: 'PATCH', headers: auth(supplier), body: JSON.stringify({ status: 'shipped' }) });
  const shipment = (await fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: auth(hub) }).then((r) => r.json())).find((s) => s.subOrderId === subOrderId);
  const step = (name, extra = {}) => fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/events`, { method: 'POST', headers: auth(hub), body: JSON.stringify({ step: name, photos: ['/uploads/test.jpg'], ...extra }) });
  await step('received');
  expect((await step('flagged', { notes: 'Cracked housing' })).status).toBe(201);   // NO damageType: the phone app does not send one
  const open = await fetch(`${BACKEND_URL}/fault-cases`, { method: 'POST', headers: auth(admin), body: JSON.stringify({ shipmentId: shipment.id, costBearer: 'supplier' }) });
  expect(open.status).toBe(201);
  return { shipmentId: shipment.id, orderId: order.id, hub, admin, step };
}
const detailOf = async (f) => fetch(`${BACKEND_URL}/hub/me/shipments/${f.shipmentId}`, { headers: auth(f.hub) }).then((r) => r.json());
const listEntry = async (f) => (await fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: auth(f.hub) }).then((r) => r.json())).find((s) => s.id === f.shipmentId);

describe.runIf(backendUp)('the hub phone app against the real backend', () => {
  it('CRITICAL: a confirmed fault arrives with exactly the fields the app reads (items, needsReturn, platformStage, returnAddress), and nothing about money', async () => {
    await fetch(`${BACKEND_URL}/supplier/me/return-address`, { method: 'PUT', headers: auth(await supplierToken()), body: JSON.stringify({ contactName: 'Wei Zhang', phone: '+86 20 1234 5678', address: '12 Industrial Road, Panyu, Guangzhou' }) });
    const f = await flaggedShipment();
    const d = await detailOf(f);
    expect(d.status).toBe('flagged');
    for (const key of ['resolution', 'resolvedAt', 'replacementFor', 'faultCase']) expect(Object.keys(d), key).toContain(key);
    expect(d.resolution).toBeNull();
    expect(d.resolvedAt).toBeNull();
    expect(d.replacementFor).toBeNull();
    expect(typeof d.faultCase.needsReturn).toBe('boolean');
    expect(d.faultCase.needsReturn).toBe(true);
    expect(['reviewing', 'finalising', 'closed']).toContain(d.faultCase.platformStage);
    expect(d.faultCase.items).toHaveLength(1);
    expect(d.faultCase.items[0]).toMatchObject({ productId: 'p1', quantity: 1 });
    expect(typeof d.faultCase.items[0].name).toBe('string');
    expect(d.faultCase.returnAddress).toMatchObject({ contactName: 'Wei Zhang', phone: '+86 20 1234 5678', address: '12 Industrial Road, Panyu, Guangzhou' });   // the three fields the app reads (it ignores the rest)
    expect(JSON.stringify(d.faultCase)).not.toMatch(/refund|costBearer|cost_bearer|amount/i);
    const entry = await listEntry(f);
    for (const key of ['replacementFor', 'resolution', 'resolvedAt']) expect(Object.keys(entry), key).toContain(key);
  }, 120000);

  it('CRITICAL: the app\'s "return to supplier" request (step, photo, return tracking number) is accepted and finishes the hub\'s part; "discard" needs no tracking number', async () => {
    const f = await flaggedShipment();
    const noTracking = await f.step('returned_to_supplier', { notes: 'Sent back' });
    expect(noTracking.status).toBe(400);                                              // the server refuses it too, as the app does before sending
    const returned = await f.step('returned_to_supplier', { notes: 'Sent back', trackingNumber: 'SF-RETURN-1' });
    expect(returned.status).toBe(201);
    const after = await detailOf(f);
    expect(after.status).toBe('returned_to_supplier');
    expect(after.faultCase.needsReturn).toBe(false);                                  // nothing left for the hub: the app shows the "returned" banner

    const g = await flaggedShipment();
    expect((await g.step('discarded_at_hub', { notes: 'Destroyed' })).status).toBe(201);
    const discarded = await detailOf(g);
    expect(discarded.status).toBe('discarded_at_hub');
    expect(discarded.faultCase.needsReturn).toBe(false);
  }, 120000);

  it('CRITICAL: a flag the platform closed arrives as "flagged" + resolution + resolvedAt, which the app shows as Closed (and keeps out of the Flagged filter)', async () => {
    const f = await flaggedShipment();
    const caseId = (await fetch(`${BACKEND_URL}/hub/flagged`, { headers: auth(f.admin) }).then((r) => r.json())).find((q) => q.id === f.shipmentId).faultCase.id;
    expect((await fetch(`${BACKEND_URL}/fault-cases/${caseId}/close`, { method: 'POST', headers: auth(f.admin), body: JSON.stringify({ note: 'Closed by hand for the app contract test' }) })).status).toBe(200);
    const entry = await listEntry(f);
    expect(entry.status).toBe('flagged');
    expect(entry.resolution).toBe('fault_closed_manually');
    expect(Number.isNaN(Date.parse(entry.resolvedAt))).toBe(false);                    // the app parses it with DateTime.parse
    const d = await detailOf(f);
    expect(d.faultCase.needsReturn).toBe(false);
    expect(d.faultCase.platformStage).toBe('closed');
  }, 120000);

  it('CRITICAL: a new hub account must change its temporary password: the login and /auth/me say so, a WRONG current password is a 401 with a message (the app must not sign the worker out), and after the change it is cleared', async () => {
    const admin = await adminToken();
    const email = `hubapp.staff.${Date.now()}@example.com`;
    const created = await fetch(`${BACKEND_URL}/hub-staff`, { method: 'POST', headers: auth(admin), body: JSON.stringify({ email, name: 'Phone App Staff', hubId: 'hub_guangzhou' }) });
    expect(created.status).toBe(201);
    const { temporaryPassword } = await created.json();
    const signedIn = await fetch(`${BACKEND_URL}/auth/login`, { method: 'POST', headers: json, body: JSON.stringify({ email, password: temporaryPassword }) }).then((r) => r.json());
    expect(signedIn.user.role).toBe('hub_staff');
    expect(signedIn.user.mustChangePassword).toBe(true);                               // the app reads this from the login reply...
    const me = (token) => fetch(`${BACKEND_URL}/auth/me`, { headers: auth(token) }).then((r) => r.json());
    expect((await me(signedIn.token)).mustChangePassword).toBe(true);                  // ...and from /auth/me when the app is reopened

    const change = (currentPassword, newPassword) => fetch(`${BACKEND_URL}/auth/me/password`, { method: 'PATCH', headers: auth(signedIn.token), body: JSON.stringify({ currentPassword, newPassword }) });
    const wrong = await change('not-the-temporary-password', 'my_own_password_123');
    expect(wrong.status).toBe(401);
    expect((await wrong.json()).error).toMatch(/current password/i);                   // a message to show, not a reason to log out
    expect((await me(signedIn.token)).mustChangePassword).toBe(true);                  // and the token still works: the session is NOT gone

    expect((await change(temporaryPassword, 'my_own_password_123')).status).toBe(200);
    expect((await me(signedIn.token)).mustChangePassword).toBe(false);
    expect((await fetch(`${BACKEND_URL}/auth/login`, { method: 'POST', headers: json, body: JSON.stringify({ email, password: temporaryPassword }) })).status).toBe(401);
  }, 120000);
});
