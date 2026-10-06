import { describe, it, expect, afterAll } from 'vitest';
import { Pool } from 'pg';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';
// Direct DB access for setup only (removing a return case to recreate an OLD flag), same approach as payouts.integration.test.js.
const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev';
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
const pool = new Pool({ connectionString: TEST_DB_URL });
afterAll(async () => { await pool.end(); });

// An order for p1, routed to the Guangzhou hub, shipped, received and FLAGGED.
async function createFlaggedOrder() {
  const admin = await adminToken();
  const supplier = (await login('supplier@leap.dev', 'supplier_dev_password_123')).token;
  const hub = (await login('hub@leap.dev', 'hub_dev_password_123')).token;
  const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `bs-buyer-${uniq()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
  const order = await fetch(`${BACKEND_URL}/order`, { method: 'POST', headers: json, body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.user.id, address: TEST_ADDRESS }) }).then((r) => r.json());
  const subOrderId = order.supplierSubOrders[0].subOrderId;
  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, { method: 'PATCH', headers: auth(admin), body: JSON.stringify({ hubId: 'hub_guangzhou' }) });
  await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, { method: 'PATCH', headers: auth(supplier), body: JSON.stringify({ status: 'shipped' }) });
  const shipment = (await fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: auth(hub) }).then((r) => r.json())).find((s) => s.subOrderId === subOrderId);
  const record = (step, extra = {}) => fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/events`, { method: 'POST', headers: auth(hub), body: JSON.stringify({ step, photos: ['/uploads/test.jpg'], ...extra }) });
  await record('received');
  expect((await record('flagged', { notes: 'Cracked', damageType: 'physical_damage' })).status).toBe(201);
  return { orderId: order.id, buyerToken: buyer.token, adminToken: admin };
}

const detailAs = (token, orderId) => fetch(`${BACKEND_URL}/order/${orderId}`, { headers: auth(token) }).then((r) => r.json());
const listAs = (token, query = '') => fetch(`${BACKEND_URL}/order${query}`, { headers: auth(token) }).then((r) => r.json());

describe.runIf(backendUp)('buyers are never shown "dispute" (real backend)', () => {
  it('a flagged order shows the buyer a return -- never "dispute" -- while its return case is open', async () => {
    const o = await createFlaggedOrder();
    expect((await detailAs(o.buyerToken, o.orderId)).displayStatus).toBe('returns');
    const listed = (await listAs(o.buyerToken)).find((x) => x.id === o.orderId);
    expect(listed.displayStatus).toBe('returns');
  }, 40000);

  it('CRITICAL: an OLD flag (from before return cases were opened automatically) shows the buyer a neutral status, while admin still sees "dispute"', async () => {
    const o = await createFlaggedOrder();
    await pool.query('DELETE FROM return_cases WHERE order_id = $1', [o.orderId]); // simulate an old flag with no return case

    const buyerDetail = await detailAs(o.buyerToken, o.orderId);
    expect(buyerDetail.displayStatus).toBe('to_ship');
    expect((await listAs(o.buyerToken)).find((x) => x.id === o.orderId).displayStatus).toBe('to_ship');
    expect(JSON.stringify(buyerDetail)).not.toMatch(/"displayStatus":"dispute"/);

    // admin keeps the real value, so its Dispute filter still finds this order
    expect((await detailAs(o.adminToken, o.orderId)).displayStatus).toBe('dispute');
    const disputes = await listAs(o.adminToken, '?status=dispute');
    expect(disputes.some((x) => x.id === o.orderId)).toBe(true);
  }, 40000);
});
