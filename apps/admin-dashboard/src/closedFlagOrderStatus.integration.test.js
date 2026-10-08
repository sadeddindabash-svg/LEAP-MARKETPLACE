// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import { Pool } from 'pg';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';
// Direct DB access only to reproduce an OLD state (a flag with no return case) that the current code can no longer create.
const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev';
const pool = new Pool({ connectionString: TEST_DB_URL });
afterAll(async () => { await pool.end(); });

async function isBackendUp() {
  try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; }
}
const backendUp = await isBackendUp();
const json = { 'Content-Type': 'application/json' };
const auth = (token) => ({ ...json, Authorization: `Bearer ${token}` });
const ADDRESS = { recipientName: 'John Smith', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' };
const adminToken = async () => (await login('admin@leap.dev', 'admin_dev_password_123')).token;

// An order the hub has flagged (supplier already "shipped" it to the hub).
async function flaggedOrder() {
  const admin = await adminToken();
  const supplier = (await login('supplier@leap.dev', 'supplier_dev_password_123')).token;
  const hub = (await login('hub@leap.dev', 'hub_dev_password_123')).token;
  const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `closedflag.${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
  const order = await fetch(`${BACKEND_URL}/order`, { method: 'POST', headers: json, body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.user.id, address: ADDRESS }) }).then((r) => r.json());
  const subOrderId = order.supplierSubOrders[0].subOrderId;
  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, { method: 'PATCH', headers: auth(admin), body: JSON.stringify({ hubId: 'hub_guangzhou' }) });
  await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, { method: 'PATCH', headers: auth(supplier), body: JSON.stringify({ status: 'shipped' }) });
  const shipment = (await fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: auth(hub) }).then((r) => r.json())).find((s) => s.subOrderId === subOrderId);
  const step = (s, extra = {}) => fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/events`, { method: 'POST', headers: auth(hub), body: JSON.stringify({ step: s, photos: ['/uploads/test.jpg'], ...extra }) });
  await step('received');
  expect((await step('flagged', { notes: 'Cracked housing', damageType: 'physical_damage' })).status).toBe(201);
  return { orderId: order.id, subOrderId, shipmentId: shipment.id, buyerToken: buyer.token, admin };
}
const listEntry = async (f) => (await fetch(`${BACKEND_URL}/order`, { headers: auth(f.admin) }).then((r) => r.json())).find((o) => o.id === f.orderId);
const detail = async (f, token) => fetch(`${BACKEND_URL}/order/${f.orderId}`, { headers: auth(token || f.admin) }).then((r) => r.json());
const closeByHand = async (f) => {
  await fetch(`${BACKEND_URL}/fault-cases`, { method: 'POST', headers: auth(f.admin), body: JSON.stringify({ shipmentId: f.shipmentId, costBearer: 'supplier' }) });
  const queue = await fetch(`${BACKEND_URL}/hub/flagged`, { headers: auth(f.admin) }).then((r) => r.json());
  const caseId = queue.find((q) => q.id === f.shipmentId).faultCase.id;
  return fetch(`${BACKEND_URL}/fault-cases/${caseId}/close`, { method: 'POST', headers: auth(f.admin), body: JSON.stringify({ note: 'Closed by hand for this test' }) });
};

describe.runIf(backendUp)('an order whose flag was CLOSED is not a dispute any more (real backend)', () => {
  it('CRITICAL: the admin list says "flagged" while the flag is open and "closed" once it is closed by hand, while the supplier\'s own status stays "shipped" (that is the supplier\'s leg, not a mismatch)', async () => {
    const f = await flaggedOrder();
    expect((await listEntry(f)).hubStatus).toBe('flagged');
    expect((await closeByHand(f)).status).toBe(200);
    const entry = await listEntry(f);
    expect(entry.hubStatus).toBe('closed');                                     // the Disputes tab (hubStatus === 'flagged') no longer lists it
    const d = await detail(f);
    expect(d.supplierSubOrders[0].status).toBe('shipped');                      // the supplier's own leg: unchanged and correct
    expect(d.supplierSubOrders[0].hubShipment).toMatchObject({ status: 'flagged', resolution: 'fault_closed_manually' });
    expect(d.supplierSubOrders[0].hubShipment.resolvedAt).toBeTruthy();         // so the order page can show "Closed"
  }, 90000);

  it('CRITICAL: an order with a flag but NO return case (older data) is a "dispute" while the flag is open, and stops being one once the flag is closed', async () => {
    const f = await flaggedOrder();
    await pool.query('DELETE FROM return_cases WHERE order_id = $1', [f.orderId]);   // how older flags looked: no return case
    expect((await detail(f)).displayStatus).toBe('dispute');
    await pool.query(`UPDATE hub_shipments SET resolution = 'fault_closed_manually', resolved_at = now() WHERE id = $1`, [f.shipmentId]);
    expect((await detail(f)).displayStatus).toBe('returns');                     // it used to stay "dispute" for ever
    expect((await listEntry(f)).hubStatus).toBe('closed');
  }, 90000);

  it('buyers never see the internal facts: no "dispute" status, and no resolution on the parcel', async () => {
    const f = await flaggedOrder();
    await closeByHand(f);
    const buyerView = await detail(f, f.buyerToken);
    expect(buyerView.displayStatus).not.toBe('dispute');
    expect(JSON.stringify(buyerView.supplierSubOrders[0].hubShipment || {})).not.toMatch(/resolution|resolvedAt|fault_closed/);
  }, 90000);
});
