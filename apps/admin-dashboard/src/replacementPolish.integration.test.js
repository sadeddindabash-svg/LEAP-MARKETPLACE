// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';
const ADDRESS = { recipientName: 'John Smith', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' };

async function isBackendUp() {
  try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; }
}
const backendUp = await isBackendUp();

const json = { 'Content-Type': 'application/json' };
const auth = (token) => ({ ...json, Authorization: `Bearer ${token}` });
const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const adminToken = async () => (await login('admin@leap.dev', 'admin_dev_password_123')).token;
const supplierToken = async () => (await login('supplier@leap.dev', 'supplier_dev_password_123')).token;
const hubToken = async () => (await login('hub@leap.dev', 'hub_dev_password_123')).token;
const in5Days = () => new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
const record = async (shipmentId, step, extra = {}) => fetch(`${BACKEND_URL}/hub/me/shipments/${shipmentId}/events`, { method: 'POST', headers: auth(await hubToken()), body: JSON.stringify({ step, photos: ['/uploads/test.jpg'], ...extra }) });
const hubList = async () => fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: auth(await hubToken()) }).then((r) => r.json());
const post = async (path, body, token) => fetch(`${BACKEND_URL}${path}`, { method: 'POST', headers: auth(token || (await adminToken())), body: JSON.stringify(body || {}) });

// A real order whose shipment is flagged, a fault case, the supplier saying yes, and the replacement confirmed (and shipped by the supplier to the hub).
async function orderWithReplacement() {
  const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `rp2-buyer-${uniq()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
  const order = await fetch(`${BACKEND_URL}/order`, { method: 'POST', headers: json, body: JSON.stringify({ items: [{ productId: 'p1', quantity: 2 }], userId: buyer.user.id, address: ADDRESS }) }).then((r) => r.json());
  const subOrderId = order.supplierSubOrders[0].subOrderId;
  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, { method: 'PATCH', headers: auth(await adminToken()), body: JSON.stringify({ hubId: 'hub_guangzhou' }) });
  await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, { method: 'PATCH', headers: auth(await supplierToken()), body: JSON.stringify({ status: 'shipped' }) });
  const shipment = (await hubList()).find((s) => s.subOrderId === subOrderId);
  await record(shipment.id, 'received');
  await record(shipment.id, 'flagged', { notes: 'Cracked housing', damageType: 'physical_damage' });
  expect((await post('/fault-cases', { shipmentId: shipment.id, items: ['p1'], costBearer: 'supplier' })).status).toBe(201);
  const caseId = (await fetch(`${BACKEND_URL}/hub/flagged`, { headers: auth(await adminToken()) }).then((r) => r.json())).find((q) => q.id === shipment.id).faultCase.id;
  await post(`/fault-cases/supplier/me/${caseId}/answer`, { canReplace: true, eta: in5Days() }, await supplierToken());
  expect((await post(`/fault-cases/${caseId}/confirm-replacement`, {})).status).toBe(200);
  return { orderId: order.id, replacementOrderId: `${order.id}-R1`, buyerToken: buyer.token, normalSubOrderId: subOrderId };
}
const receipt = (orderId, token, lang) => fetch(`${BACKEND_URL}/order/${orderId}/receipt${lang ? `?lang=${lang}` : ''}`, { headers: token ? auth(token) : {} });

describe.runIf(backendUp)('free replacement orders: receipt and the hub\'s list (real backend)', () => {
  it('CRITICAL: the receipt of a replacement is a real PDF for the buyer (prices hidden) and for an admin (real figures); the original order\'s receipt is unaffected; a stranger gets nothing', async () => {
    const r = await orderWithReplacement();
    for (const [who, token] of [['buyer', r.buyerToken], ['admin', await adminToken()]]) {
      for (const lang of [undefined, 'ar']) {
        const res = await receipt(r.replacementOrderId, token, lang);
        expect(res.status, `${who} ${lang || 'en'}`).toBe(200);
        expect(res.headers.get('content-type')).toContain('application/pdf');
        expect(Buffer.from(await res.arrayBuffer()).subarray(0, 4).toString()).toBe('%PDF');
      }
    }
    expect((await receipt(r.orderId, r.buyerToken)).status).toBe(200);                           // the order the buyer paid for
    expect((await receipt(r.replacementOrderId, null)).status).toBe(404);                         // no login, no guest email
    const other = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `rp2-other-${uniq()}@example.com`, password: 'test_password_123' }) }).then((x) => x.json());
    expect((await receipt(r.replacementOrderId, other.token)).status).toBe(404);                  // somebody else's order
  }, 120000);

  it('CRITICAL: the hub\'s shipment list says which shipment is a free replacement (and for which order); ordinary shipments say nothing', async () => {
    const r = await orderWithReplacement();
    const adminOrder = await fetch(`${BACKEND_URL}/order/${r.replacementOrderId}`, { headers: auth(await adminToken()) }).then((x) => x.json());
    const subOrderId = adminOrder.supplierSubOrders[0].subOrderId;
    expect((await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, { method: 'PATCH', headers: auth(await supplierToken()), body: JSON.stringify({ status: 'shipped' }) })).status).toBe(200);
    const list = await hubList();
    const entry = list.find((s) => s.orderId === r.replacementOrderId);
    expect(entry).toBeTruthy();
    expect(entry.replacementFor).toBe(r.orderId);
    const ordinary = list.find((s) => s.orderId === r.orderId);
    expect(ordinary.replacementFor).toBeNull();
    expect(list.filter((s) => s.replacementFor).every((s) => /-R\d+$/.test(s.orderId))).toBe(true); // only -R orders are tagged
  }, 120000);
});
