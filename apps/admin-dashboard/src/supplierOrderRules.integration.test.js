// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';
async function isBackendUp() {
  try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; }
}
const backendUp = await isBackendUp();
const json = { 'Content-Type': 'application/json' };
const auth = (token) => ({ ...json, Authorization: `Bearer ${token}` });
const ADDRESS = { recipientName: 'John Smith', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' };
const adminToken = async () => (await login('admin@leap.dev', 'admin_dev_password_123')).token;
const supplierToken = async () => (await login('supplier@leap.dev', 'supplier_dev_password_123')).token;
const hubToken = async () => (await login('hub@leap.dev', 'hub_dev_password_123')).token;

// An order of supplier s1 (optionally with a hub assigned) and the buyer's token.
async function newOrder({ assignHub = true } = {}) {
  const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `suprules.${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
  const order = await fetch(`${BACKEND_URL}/order`, { method: 'POST', headers: json, body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.user.id, address: ADDRESS }) }).then((r) => r.json());
  const subOrderId = order.supplierSubOrders[0].subOrderId;
  if (assignHub) await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, { method: 'PATCH', headers: auth(await adminToken()), body: JSON.stringify({ hubId: 'hub_guangzhou' }) });
  return { orderId: order.id, subOrderId, buyerToken: buyer.token };
}
const patch = async (o, body) => fetch(`${BACKEND_URL}/supplier/me/orders/${o.subOrderId}`, { method: 'PATCH', headers: auth(await supplierToken()), body: JSON.stringify(body) });
const entry = async (o) => (await fetch(`${BACKEND_URL}/supplier/me/orders`, { headers: auth(await supplierToken()) }).then((r) => r.json())).find((x) => x.subOrderId === o.subOrderId);
const hubStep = async (o, step, extra = {}) => {
  const hub = await hubToken();
  const shipment = (await fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: auth(hub) }).then((r) => r.json())).find((s) => s.subOrderId === o.subOrderId);
  return fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/events`, { method: 'POST', headers: auth(hub), body: JSON.stringify({ step, photos: ['/uploads/test.jpg'], ...extra }) });
};
const buyerNotificationsAbout = async (o) => (await fetch(`${BACKEND_URL}/notifications/me`, { headers: auth(o.buyerToken) }).then((r) => r.json())).filter((n) => n.linkId === o.orderId);

describe.runIf(backendUp)('what a supplier may do to an order, enforced by the server (real backend)', () => {
  it('CRITICAL: forward only: preparing cannot go back to pending, shipped cannot go back to preparing or pending, and the list tells the portal what is allowed', async () => {
    const o = await newOrder();
    expect(await entry(o)).toMatchObject({ status: 'pending', locked: false, allowedStatuses: ['preparing', 'shipped'], canEditTracking: true });

    const toPreparing = await patch(o, { status: 'preparing' });
    expect(toPreparing.status).toBe(200);
    expect(await toPreparing.json()).toMatchObject({ status: 'preparing', locked: false, allowedStatuses: ['shipped'] });

    const back = await patch(o, { status: 'pending' });
    expect(back.status).toBe(409);
    expect((await back.json()).code).toBe('status_cannot_go_back');
    expect((await entry(o)).status).toBe('preparing');                                    // nothing changed

    expect((await patch(o, { status: 'shipped', trackingNumber: 'SF-TYPO-1' })).status).toBe(200);
    for (const wrong of ['preparing', 'pending']) {
      const refused = await patch(o, { status: wrong });
      expect(refused.status, wrong).toBe(409);
      expect((await refused.json()).code).toBe('status_cannot_go_back');
    }
    expect((await entry(o)).status).toBe('shipped');
  }, 90000);

  it('CRITICAL: until the hub receives the parcel the tracking number can still be corrected, and that does NOT notify the buyer a second time', async () => {
    const o = await newOrder();
    expect((await patch(o, { status: 'shipped', trackingNumber: 'SF-TYPO-1' })).status).toBe(200);
    const before = (await buyerNotificationsAbout(o)).length;
    expect(before).toBeGreaterThanOrEqual(1);                                             // the real "on its way to the hub" notice
    const fixed = await patch(o, { status: 'shipped', trackingNumber: 'SF-CORRECT-2' });
    expect(fixed.status).toBe(200);
    expect((await fixed.json()).trackingNumber).toBe('SF-CORRECT-2');
    expect((await patch(o, { trackingNumber: 'SF-CORRECT-3' })).status).toBe(200);        // tracking alone works too
    expect((await entry(o)).trackingNumber).toBe('SF-CORRECT-3');
    expect((await buyerNotificationsAbout(o)).length).toBe(before);                       // no duplicate notification
  }, 90000);

  it('CRITICAL: once the hub has RECEIVED the parcel, the supplier can change NOTHING (status or tracking), and the list says why', async () => {
    const o = await newOrder();
    await patch(o, { status: 'shipped', trackingNumber: 'SF-1' });
    expect((await hubStep(o, 'received')).status).toBe(201);
    expect(await entry(o)).toMatchObject({ locked: true, lockReason: 'at_hub', allowedStatuses: [], canEditTracking: false });

    for (const body of [{ status: 'preparing' }, { status: 'pending' }, { status: 'shipped' }, { trackingNumber: 'SNEAKY-1' }, { status: 'shipped', trackingNumber: 'SNEAKY-2' }]) {
      const refused = await patch(o, body);
      expect(refused.status, JSON.stringify(body)).toBe(409);
      expect((await refused.json()).code).toBe('order_locked_at_hub');
    }
    expect((await entry(o)).trackingNumber).toBe('SF-1');                                 // untouched
  }, 90000);

  it('CRITICAL: when the hub FLAGS it and the platform decides, the order stays locked, but the supplier can still ANSWER the fault case (the real way back)', async () => {
    const o = await newOrder();
    await patch(o, { status: 'shipped', trackingNumber: 'SF-1' });
    await hubStep(o, 'received');
    expect((await hubStep(o, 'flagged', { notes: 'Cracked housing', damageType: 'physical_damage' })).status).toBe(201);
    const admin = await adminToken();
    const queue = await fetch(`${BACKEND_URL}/hub/flagged`, { headers: auth(admin) }).then((r) => r.json());
    const flagged = queue.find((q) => q.orderId === o.orderId);
    expect((await fetch(`${BACKEND_URL}/fault-cases`, { method: 'POST', headers: auth(admin), body: JSON.stringify({ shipmentId: flagged.id, costBearer: 'supplier' }) })).status).toBe(201);
    const caseId = (await fetch(`${BACKEND_URL}/hub/flagged`, { headers: auth(admin) }).then((r) => r.json())).find((q) => q.orderId === o.orderId).faultCase.id;

    expect((await patch(o, { status: 'preparing' })).status).toBe(409);                   // the order itself stays locked...
    const answered = await fetch(`${BACKEND_URL}/fault-cases/supplier/me/${caseId}/answer`, { method: 'POST', headers: auth(await supplierToken()), body: JSON.stringify({ canReplace: true, eta: '2026-12-01', note: 'We will resend' }) });
    expect(answered.status).toBe(200);                                                    // ...and the supplier can still act on the fault case
  }, 120000);

  it('a part the buyer CANCELLED cannot be brought back by the supplier, "dispute" is no longer a status a supplier can set, and another supplier gets "not found"', async () => {
    const o = await newOrder({ assignHub: false });
    const cancelled = await fetch(`${BACKEND_URL}/order/${o.orderId}/cancel`, { method: 'POST', headers: auth(o.buyerToken), body: JSON.stringify({}) });
    expect(cancelled.status).toBe(200);
    expect(await entry(o)).toMatchObject({ status: 'cancelled', locked: true, lockReason: 'cancelled' });
    const revive = await patch(o, { status: 'preparing' });
    expect(revive.status).toBe(409);
    expect((await revive.json()).code).toBe('order_cancelled');

    const fresh = await newOrder();
    const dispute = await patch(fresh, { status: 'dispute' });
    expect(dispute.status).toBe(400);
    expect((await dispute.json()).error).not.toContain('dispute');
    const stranger = (await login('leap-supplier@leap.dev', 'LeapSupplier2026!')).token;
    expect((await fetch(`${BACKEND_URL}/supplier/me/orders/${fresh.subOrderId}`, { method: 'PATCH', headers: auth(stranger), body: JSON.stringify({ status: 'preparing' }) })).status).toBe(404);
  }, 90000);
});
