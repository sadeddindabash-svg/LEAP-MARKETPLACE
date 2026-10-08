// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { login } from './auth';
import { hubShipsToBuyer } from './hubFixtures';

const BACKEND_URL = 'http://localhost:4000';
async function isBackendUp() {
  try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; }
}
const backendUp = await isBackendUp();
const json = { 'Content-Type': 'application/json' };
const auth = (token) => ({ ...json, Authorization: `Bearer ${token}` });
const ADDRESS = { recipientName: 'John Smith', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' };
const ARABIC = /[\u0600-\u06FF]/;

// An order that has been through every hub step, and has been delivered.
async function deliveredOrder() {
  const admin = (await login('admin@leap.dev', 'admin_dev_password_123')).token;
  const supplier = (await login('supplier@leap.dev', 'supplier_dev_password_123')).token;
  const guestEmail = `tracking.${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
  const order = await fetch(`${BACKEND_URL}/order`, { method: 'POST', headers: json, body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], guestEmail, address: ADDRESS }) }).then((r) => r.json());
  const subOrderId = order.supplierSubOrders[0].subOrderId;
  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, { method: 'PATCH', headers: auth(admin), body: JSON.stringify({ hubId: 'hub_guangzhou' }) });
  await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, { method: 'PATCH', headers: auth(supplier), body: JSON.stringify({ status: 'shipped' }) });
  const shipmentId = await hubShipsToBuyer(subOrderId, { login });
  const hub = (await login('hub@leap.dev', 'hub_dev_password_123')).token;
  const delivered = await fetch(`${BACKEND_URL}/hub/me/shipments/${shipmentId}/confirm-delivery`, { method: 'PATCH', headers: auth(hub), body: JSON.stringify({ deliveryNote: 'Handed over at the door (test)' }) });
  expect(delivered.status).toBe(200);
  return { orderId: order.id, guestEmail, shipmentId, hub };
}
const tracking = async (o, query = '') => fetch(`${BACKEND_URL}/order/${o.orderId}/tracking?guestEmail=${encodeURIComponent(o.guestEmail)}${query}`).then((r) => r.json());
const hubRows = (body) => body.subOrders[0].timeline.filter((e) => e.source === 'hub');

describe.runIf(backendUp)('the tracking timeline in the buyer\'s language (real backend)', () => {
  it('CRITICAL: ?lang=ar gives every hub step in Arabic, and the default (and any other language) stays English exactly as before', async () => {
    const o = await deliveredOrder();
    const english = hubRows(await tracking(o));
    expect(english.map((e) => e.description).sort()).toEqual(['Delivered (confirmed by hub)', 'Inspection complete', 'Opened for inspection', 'Received at hub', 'Repacked for shipping', 'Shipped to you']);
    expect(hubRows(await tracking(o, '&lang=en')).map((e) => e.description)).toEqual(english.map((e) => e.description));
    expect(hubRows(await tracking(o, '&lang=fr')).map((e) => e.description)).toEqual(english.map((e) => e.description));   // anything but "ar" is English

    const arabic = hubRows(await tracking(o, '&lang=ar'));
    expect(arabic).toHaveLength(6);
    for (const row of arabic) { expect(row.description).toMatch(ARABIC); expect(row.description).not.toMatch(/[A-Za-z]/); }
    expect(arabic.map((e) => e.description)).toContain('تم الاستلام في المركز');
    expect(arabic.map((e) => e.description)).toContain('تم شحنها إليك');
    expect(arabic.map((e) => e.description)).toContain('تم التسليم (بتأكيد المركز)');
  }, 90000);

  it('CRITICAL: every hub step carries its own name (kind), the same in both languages, so the app can choose icons without reading English words', async () => {
    const o = await deliveredOrder();
    const kinds = (rows) => rows.map((e) => e.kind).sort();
    const expected = ['delivered', 'inspected', 'opened', 'packed', 'received', 'shipped_to_buyer'];
    expect(kinds(hubRows(await tracking(o)))).toEqual(expected);
    expect(kinds(hubRows(await tracking(o, '&lang=ar')))).toEqual(expected);
    const byKind = Object.fromEntries(hubRows(await tracking(o, '&lang=ar')).map((e) => [e.kind, e.description]));
    expect(byKind.delivered).toContain('التسليم');                       // the "delivered" row really is the delivered one
  }, 90000);

  it('CRITICAL: a flagged shipment\'s internal steps are never shown to the buyer (they used to appear as the raw word "flagged")', async () => {
    const admin = (await login('admin@leap.dev', 'admin_dev_password_123')).token;
    const supplier = (await login('supplier@leap.dev', 'supplier_dev_password_123')).token;
    const hub = (await login('hub@leap.dev', 'hub_dev_password_123')).token;
    const guestEmail = `tracking.flag.${Date.now()}@example.com`;
    const order = await fetch(`${BACKEND_URL}/order`, { method: 'POST', headers: json, body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], guestEmail, address: ADDRESS }) }).then((r) => r.json());
    const subOrderId = order.supplierSubOrders[0].subOrderId;
    await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, { method: 'PATCH', headers: auth(admin), body: JSON.stringify({ hubId: 'hub_guangzhou' }) });
    await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, { method: 'PATCH', headers: auth(supplier), body: JSON.stringify({ status: 'shipped' }) });
    const shipment = (await fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: auth(hub) }).then((r) => r.json())).find((s) => s.subOrderId === subOrderId);
    const step = (s, extra = {}) => fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/events`, { method: 'POST', headers: auth(hub), body: JSON.stringify({ step: s, photos: ['/uploads/test.jpg'], ...extra }) });
    expect((await step('received')).status).toBe(201);
    expect((await step('flagged', { notes: 'Cracked housing', damageType: 'physical_damage' })).status).toBe(201);

    for (const query of ['', '&lang=ar']) {
      const body = await tracking({ orderId: order.id, guestEmail }, query);
      const text = JSON.stringify(body.subOrders[0].timeline);
      expect(text).not.toMatch(/flagged/i);
      expect(body.subOrders[0].timeline.map((e) => e.kind)).toEqual(['received']);   // only the buyer-facing step
    }
  }, 90000);
});
