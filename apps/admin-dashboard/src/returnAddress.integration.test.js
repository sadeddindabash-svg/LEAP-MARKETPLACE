import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';
// Direct DB access for setup only (clearing a supplier's address, which has no API on purpose), same approach as payouts.integration.test.js.
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
const supplierToken = async () => (await login('supplier@leap.dev', 'supplier_dev_password_123')).token;
const otherSupplierToken = async () => (await login('leap-supplier@leap.dev', 'LeapSupplier2026!')).token;

const VALID = { contactName: 'Wang Fang', phone: '+86 20 8888 1234', address: 'Building 3, 88 Huangpu Avenue, Tianhe District, Guangzhou 510000' };

const putMine = async (body, token) => fetch(`${BACKEND_URL}/supplier/me/return-address`, { method: 'PUT', headers: auth(token || (await supplierToken())), body: JSON.stringify(body) });
const getMine = async (token) => fetch(`${BACKEND_URL}/supplier/me/return-address`, { headers: auth(token || (await supplierToken())) });
const putFor = async (id, body, token) => fetch(`${BACKEND_URL}/supplier/${id}/return-address`, { method: 'PUT', headers: auth(token || (await adminToken())), body: JSON.stringify(body) });

async function clearAddressOf(supplierId) {
  const pool = new Pool({ connectionString: TEST_DB_URL });
  await pool.query('DELETE FROM supplier_return_addresses WHERE supplier_id = $1', [supplierId]);
  await pool.end();
}

// A brand-new hub with its own staff login, so a test's shipments belong to that test alone.
async function createIsolatedHub() {
  const admin = await adminToken();
  const hub = await fetch(`${BACKEND_URL}/hub/locations`, { method: 'POST', headers: auth(admin), body: JSON.stringify({ name: `Return Test Hub ${uniq()}`, region: 'Test Region' }) }).then((r) => r.json());
  const email = `return-staff-${uniq()}@example.com`;
  const created = await fetch(`${BACKEND_URL}/hub-staff`, { method: 'POST', headers: auth(admin), body: JSON.stringify({ email, name: 'Return Tester', hubId: hub.id }) }).then((r) => r.json());
  return { hubId: hub.id, hubToken: (await login(email, created.temporaryPassword)).token };
}

async function createFlaggedShipment() {
  const admin = await adminToken();
  const { hubId, hubToken } = await createIsolatedHub();
  const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `ra-buyer-${uniq()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
  const order = await fetch(`${BACKEND_URL}/order`, { method: 'POST', headers: json, body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.user.id, address: TEST_ADDRESS }) }).then((r) => r.json());
  const subOrderId = order.supplierSubOrders[0].subOrderId;
  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, { method: 'PATCH', headers: auth(admin), body: JSON.stringify({ hubId }) });
  await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, { method: 'PATCH', headers: auth(await supplierToken()), body: JSON.stringify({ status: 'shipped' }) });
  const shipment = (await fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: auth(hubToken) }).then((r) => r.json())).find((s) => s.subOrderId === subOrderId);
  const record = (step, extra = {}) => fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/events`, { method: 'POST', headers: auth(hubToken), body: JSON.stringify({ step, photos: ['/uploads/test.jpg'], ...extra }) });
  await record('received');
  expect((await record('flagged', { notes: 'Cracked', damageType: 'physical_damage' })).status).toBe(201);
  return { shipmentId: shipment.id, orderId: order.id, hubToken, buyerToken: buyer.token, record };
}

const openCase = async (f) => fetch(`${BACKEND_URL}/fault-cases`, { method: 'POST', headers: auth(await adminToken()), body: JSON.stringify({ shipmentId: f.shipmentId, items: ['p1'], costBearer: 'supplier' }) });
const queueEntry = async (shipmentId) => (await fetch(`${BACKEND_URL}/hub/flagged`, { headers: auth(await adminToken()) }).then((r) => r.json())).find((q) => q.id === shipmentId);
const hubFaultCase = (f) => fetch(`${BACKEND_URL}/hub/me/shipments/${f.shipmentId}`, { headers: auth(f.hubToken) }).then((r) => r.json()).then((d) => d.faultCase);
const supplierCaseFor = async (orderId) => (await fetch(`${BACKEND_URL}/fault-cases/supplier/me`, { headers: auth(await supplierToken()) }).then((r) => r.json())).find((c) => c.orderId === orderId);
const supplierNotificationFor = async (orderId) => (await fetch(`${BACKEND_URL}/notifications/me`, { headers: auth(await supplierToken()) }).then((r) => r.json())).find((n) => n.type === 'supplier_message' && n.linkId === orderId);

describe.runIf(backendUp)('supplier return addresses against a REAL running backend', () => {
  beforeAll(async () => { await putMine(VALID); });
  // leave the shared dev data with a valid address, as other flows expect
  afterAll(async () => { await putMine(VALID); });

  it('CRITICAL: a supplier saves and reads their own return address; saving again replaces it (no history)', async () => {
    expect((await putMine(VALID)).status).toBe(200);
    const first = await getMine().then((r) => r.json());
    expect(first).toMatchObject(VALID);

    const changed = { ...VALID, contactName: 'Li Wei', phone: '020-8888-9999' };
    expect((await putMine(changed)).status).toBe(200);
    const second = await getMine().then((r) => r.json());
    expect(second).toMatchObject(changed);
    expect(second.contactName).not.toBe(VALID.contactName);
  });

  it('rejects incomplete or malformed details, and trims what it accepts', async () => {
    for (const bad of [
      {}, { ...VALID, contactName: '' }, { ...VALID, phone: '' }, { ...VALID, address: '' },
      { ...VALID, contactName: 'X' },                // too short
      { ...VALID, phone: 'call me maybe' },          // not a phone number
      { ...VALID, phone: '12' },                     // too short
      { ...VALID, address: 'too short' },            // under 10 characters
      { ...VALID, address: 'x'.repeat(301) },        // over 300
    ]) {
      expect((await putMine(bad)).status).toBe(400);
    }
    const padded = await putMine({ contactName: '  Wang Fang  ', phone: ' +86 20 8888 1234 ', address: `  ${VALID.address}  ` });
    expect(padded.status).toBe(200);
    expect((await padded.json())).toMatchObject(VALID);
  });

  it('one supplier can never see or change another supplier\'s address', async () => {
    await putMine(VALID);
    const other = await getMine(await otherSupplierToken()).then((r) => r.json());
    expect(other === null || other.address !== VALID.address).toBe(true);
    // writing as the other supplier changes only THEIR row
    const theirs = { contactName: 'Other Supplier', phone: '+971 4 555 0000', address: 'Warehouse 7, Jebel Ali Free Zone, Dubai, UAE' };
    expect((await putMine(theirs, await otherSupplierToken())).status).toBe(200);
    expect((await getMine().then((r) => r.json())).address).toBe(VALID.address);
  });

  it('only suppliers use /me/return-address; buyers, hub staff, admins and anonymous callers cannot', async () => {
    const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `ra-roles-${uniq()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
    const hub = (await login('hub@leap.dev', 'hub_dev_password_123')).token;
    for (const token of [buyer.token, hub, await adminToken()]) {
      expect((await getMine(token)).status).toBe(403);
      expect((await putMine(VALID, token)).status).toBe(403);
    }
    expect((await fetch(`${BACKEND_URL}/supplier/me/return-address`)).status).toBe(401);
  });

  it('an admin can read and correct any supplier\'s address; it is audit-logged without copying the address; limited admins cannot', async () => {
    const admin = await adminToken();
    const corrected = { contactName: 'Admin Fixed', phone: '+86 755 1234 5678', address: 'Unit 12, Industrial Road 5, Longgang, Shenzhen 518100' };
    expect((await putFor('s1', corrected)).status).toBe(200);
    expect((await fetch(`${BACKEND_URL}/supplier/s1/return-address`, { headers: auth(admin) }).then((r) => r.json()))).toMatchObject(corrected);
    expect((await getMine().then((r) => r.json())).contactName).toBe('Admin Fixed'); // the supplier sees the correction

    expect((await putFor('s1', { ...corrected, phone: 'abc' })).status).toBe(400);
    expect((await putFor('no-such-supplier', corrected)).status).toBe(404);
    expect((await fetch(`${BACKEND_URL}/supplier/no-such-supplier/return-address`, { headers: auth(admin) })).status).toBe(404);

    const log = await fetch(`${BACKEND_URL}/admin/audit-log?action=supplier_return_address_updated`, { headers: auth(admin) }).then((r) => r.json());
    const entries = (Array.isArray(log) ? log : log.entries).filter((e) => e.targetId === 's1');
    expect(entries.length).toBeGreaterThan(0);
    expect(JSON.stringify(entries)).not.toContain('Industrial Road');

    const limitedEmail = `ra-limited-${uniq()}@example.com`;
    await fetch(`${BACKEND_URL}/admin-users`, { method: 'POST', headers: auth(admin), body: JSON.stringify({ email: limitedEmail, password: 'limited_pass_123', name: 'Limited', allowedPages: ['orders'] }) });
    const limited = (await login(limitedEmail, 'limited_pass_123')).token;
    expect((await putFor('s1', corrected, limited)).status).toBe(403);
    expect((await fetch(`${BACKEND_URL}/supplier/s1/return-address`, { headers: auth(limited) })).status).toBe(403);
    await putMine(VALID);
  }, 40000);

  it('CRITICAL: the admin queue says whether the supplier has a return address, BEFORE a fault case is opened', async () => {
    const f = await createFlaggedShipment();
    await putMine(VALID);
    expect((await queueEntry(f.shipmentId)).supplierReturnAddressOnFile).toBe(true);
    await clearAddressOf('s1');
    expect((await queueEntry(f.shipmentId)).supplierReturnAddressOnFile).toBe(false);
  }, 40000);

  it('the supplier\'s "can you replace?" notice asks for a return address ONLY when they have none', async () => {
    await clearAddressOf('s1');
    const without = await createFlaggedShipment();
    await openCase(without);
    expect((await supplierNotificationFor(without.orderId)).body).toContain('You have no return address on file');

    await putMine(VALID);
    const withAddress = await createFlaggedShipment();
    await openCase(withAddress);
    expect((await supplierNotificationFor(withAddress.orderId)).body).not.toContain('return address');
  }, 60000);

  it('CRITICAL: the hub sees where to send the unit (and null when the supplier has no address), and nothing about money', async () => {
    await putMine(VALID);
    const f = await createFlaggedShipment();
    await openCase(f);
    const faultCase = await hubFaultCase(f);
    expect(faultCase.returnAddress).toMatchObject(VALID);
    expect(JSON.stringify(faultCase)).not.toMatch(/refund|costBearer|cost_bearer/i);

    await clearAddressOf('s1');
    expect((await hubFaultCase(f)).returnAddress).toBeNull();
    await putMine(VALID);
  }, 40000);

  it('the supplier is shown the return tracking number once the hub has sent the unit back -- and not before, nor for a discarded unit', async () => {
    await putMine(VALID);
    const sent = await createFlaggedShipment();
    await openCase(sent);
    expect((await supplierCaseFor(sent.orderId)).returnTrackingNumber).toBeNull();
    const number = `RET-SUP-${uniq()}`;
    expect((await sent.record('returned_to_supplier', { trackingNumber: number })).status).toBe(201);
    expect((await supplierCaseFor(sent.orderId)).returnTrackingNumber).toBe(number);

    const discarded = await createFlaggedShipment();
    await openCase(discarded);
    expect((await discarded.record('discarded_at_hub')).status).toBe(201);
    expect((await supplierCaseFor(discarded.orderId)).returnTrackingNumber).toBeNull();
  }, 60000);

  it('the return address never reaches the buyer', async () => {
    await putMine(VALID);
    const f = await createFlaggedShipment();
    await openCase(f);
    const order = await fetch(`${BACKEND_URL}/order/${f.orderId}`, { headers: auth(f.buyerToken) }).then((r) => r.json());
    const blob = JSON.stringify(order);
    expect(blob).not.toContain('Huangpu');
    expect(blob).not.toContain(VALID.phone);
    expect(blob).not.toContain(VALID.contactName);
  }, 40000);
});
