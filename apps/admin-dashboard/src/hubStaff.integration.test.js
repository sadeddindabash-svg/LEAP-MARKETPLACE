import { describe, it, expect } from 'vitest';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';

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
const uniqueEmail = (tag) => `hubstaff-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;

async function adminToken() {
  return (await login('admin@leap.dev', 'admin_dev_password_123')).token;
}

async function createStaff(token, { hubId = 'hub_guangzhou', name = 'Test Staff' } = {}) {
  const email = uniqueEmail('s');
  const res = await fetch(`${BACKEND_URL}/hub-staff`, { method: 'POST', headers: auth(token), body: JSON.stringify({ email, name, hubId }) });
  expect(res.status).toBe(201);
  const body = await res.json();
  return { ...body, email };
}

const staffLogin = (email, password) =>
  fetch(`${BACKEND_URL}/auth/login`, { method: 'POST', headers: json, body: JSON.stringify({ email, password }) });

const hubShipments = (token) => fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: auth(token) });

// Makes sure a hub definitely has a shipment, using the seeded product p1 (placing an
// order, assigning it to the hub, and having the supplier ship it creates one).
async function ensureShipmentAt(hubId) {
  const owner = await adminToken();
  const supplier = (await login('supplier@leap.dev', 'supplier_dev_password_123')).token;
  const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: uniqueEmail('buyer'), password: 'test_password_123' }) }).then((r) => r.json());
  const order = await fetch(`${BACKEND_URL}/order`, {
    method: 'POST', headers: json,
    body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.user.id, address: { recipientName: 'Test Buyer', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' } }),
  }).then((r) => r.json());
  const subOrderId = order.supplierSubOrders[0].subOrderId;
  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, { method: 'PATCH', headers: auth(owner), body: JSON.stringify({ hubId }) });
  const shipped = await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, { method: 'PATCH', headers: auth(supplier), body: JSON.stringify({ status: 'shipped', trackingNumber: `HS-${Date.now()}` }) });
  expect(shipped.status).toBe(200);
}

const shipmentIds = async (token) => (await hubShipments(token).then((r) => r.json())).map((s) => s.id).sort((a, b) => a - b);

describe.runIf(backendUp)('hub staff account management against a REAL running backend', () => {
  it('CRITICAL: an admin can create hub staff; the temporary password works for login and is returned only once', async () => {
    const token = await adminToken();
    const { staff, temporaryPassword, email } = await createStaff(token);

    expect(staff.isDisabled).toBe(false);
    expect(staff.hubId).toBe('hub_guangzhou');
    expect(temporaryPassword.length).toBeGreaterThanOrEqual(12);

    const loginRes = await staffLogin(email, temporaryPassword);
    expect(loginRes.status).toBe(200);
    const body = await loginRes.json();
    expect(body.user.role).toBe('hub_staff');
    expect(body.user.hubId).toBe('hub_guangzhou');

    // The list never exposes the password (or a hash) -- only the creating response does.
    const list = await fetch(`${BACKEND_URL}/hub-staff`, { headers: auth(token) }).then((r) => r.json());
    const row = list.find((s) => s.id === staff.id);
    expect(row).toBeTruthy();
    expect(Object.keys(row).some((k) => /pass|hash/i.test(k))).toBe(false);
    expect(JSON.stringify(list)).not.toContain(temporaryPassword);
  });

  it('CRITICAL: disabling takes effect IMMEDIATELY -- an already-issued token is refused, and so is a fresh login', async () => {
    const token = await adminToken();
    const { staff, temporaryPassword, email } = await createStaff(token);
    const staffToken = (await staffLogin(email, temporaryPassword).then((r) => r.json())).token;
    expect((await hubShipments(staffToken)).status).toBe(200);

    const disabled = await fetch(`${BACKEND_URL}/hub-staff/${staff.id}/disable`, { method: 'POST', headers: auth(token) }).then((r) => r.json());
    expect(disabled.isDisabled).toBe(true);

    // Same token, no re-login: refused right away (not after the 7-day token expiry).
    const refused = await hubShipments(staffToken);
    expect(refused.status).toBe(401);
    expect((await refused.json()).code).toBe('account_disabled');

    const freshLogin = await staffLogin(email, temporaryPassword);
    expect(freshLogin.status).toBe(403);
    expect((await freshLogin.json()).code).toBe('account_disabled');

    // Re-enabling restores access, including for the token that was refused.
    await fetch(`${BACKEND_URL}/hub-staff/${staff.id}/enable`, { method: 'POST', headers: auth(token) });
    expect((await hubShipments(staffToken)).status).toBe(200);
    expect((await staffLogin(email, temporaryPassword)).status).toBe(200);
  });

  it('a wrong password on a disabled account does NOT reveal that it is disabled', async () => {
    const token = await adminToken();
    const { staff, email } = await createStaff(token);
    await fetch(`${BACKEND_URL}/hub-staff/${staff.id}/disable`, { method: 'POST', headers: auth(token) });
    const res = await staffLogin(email, 'definitely-wrong-password');
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Invalid email or password');
  });

  it('CRITICAL: resetting the password gives a new working one and the old one stops working', async () => {
    const token = await adminToken();
    const { staff, temporaryPassword: oldPassword, email } = await createStaff(token);

    const reset = await fetch(`${BACKEND_URL}/hub-staff/${staff.id}/reset-password`, { method: 'POST', headers: auth(token) }).then((r) => r.json());
    expect(reset.temporaryPassword).not.toBe(oldPassword);
    expect((await staffLogin(email, oldPassword)).status).toBe(401);
    expect((await staffLogin(email, reset.temporaryPassword)).status).toBe(200);
  });

  it('CRITICAL: moving staff to another hub applies to their existing session on the very next request', async () => {
    const token = await adminToken();
    await ensureShipmentAt('hub_guangzhou'); // so the old hub definitely has something to see
    const { staff, temporaryPassword, email } = await createStaff(token, { hubId: 'hub_guangzhou' });
    const staffToken = (await staffLogin(email, temporaryPassword).then((r) => r.json())).token;

    const before = await shipmentIds(staffToken);
    expect(before.length).toBeGreaterThan(0);

    const moved = await fetch(`${BACKEND_URL}/hub-staff/${staff.id}`, { method: 'PATCH', headers: auth(token), body: JSON.stringify({ hubId: 'hub_dubai' }) }).then((r) => r.json());
    expect(moved.hubId).toBe('hub_dubai');

    // Same token, issued while the person was at Guangzhou: none of Guangzhou's shipments any more...
    const after = await shipmentIds(staffToken);
    for (const id of before) expect(after).not.toContain(id);

    // ...and exactly what a staff member created directly at Dubai sees.
    const dubaiStaff = await createStaff(token, { hubId: 'hub_dubai' });
    const dubaiToken = (await staffLogin(dubaiStaff.email, dubaiStaff.temporaryPassword).then((r) => r.json())).token;
    expect(after).toEqual(await shipmentIds(dubaiToken));
  }, 20000);

  it('rejects bad input: invalid email, empty name, unknown hub, a duplicate email in any letter case, and empty/unknown-hub edits', async () => {
    const token = await adminToken();
    const post = (body) => fetch(`${BACKEND_URL}/hub-staff`, { method: 'POST', headers: auth(token), body: JSON.stringify(body) });
    expect((await post({ email: 'not-an-email', name: 'X', hubId: 'hub_dubai' })).status).toBe(400);
    expect((await post({ email: uniqueEmail('n'), name: '   ', hubId: 'hub_dubai' })).status).toBe(400);
    expect((await post({ email: uniqueEmail('h'), name: 'X', hubId: 'hub_does_not_exist' })).status).toBe(400);

    const { email, staff } = await createStaff(token);
    expect((await post({ email: email.toUpperCase(), name: 'Dup', hubId: 'hub_dubai' })).status).toBe(409);

    const patch = (body) => fetch(`${BACKEND_URL}/hub-staff/${staff.id}`, { method: 'PATCH', headers: auth(token), body: JSON.stringify(body) });
    expect((await patch({})).status).toBe(400);
    expect((await patch({ hubId: 'hub_does_not_exist' })).status).toBe(400);
    expect((await patch({ name: '  ' })).status).toBe(400);
  });

  it('CRITICAL: this can only ever touch hub staff -- an admin or supplier account id is a 404, and is left untouched', async () => {
    const token = await adminToken();
    const me = await fetch(`${BACKEND_URL}/auth/me`, { headers: auth(token) }).then((r) => r.json());
    for (const path of [`/hub-staff/${me.id}/disable`, `/hub-staff/${me.id}/reset-password`]) {
      expect((await fetch(`${BACKEND_URL}${path}`, { method: 'POST', headers: auth(token) })).status).toBe(404);
    }
    expect((await fetch(`${BACKEND_URL}/hub-staff/${me.id}`, { method: 'PATCH', headers: auth(token), body: JSON.stringify({ name: 'hacked' }) })).status).toBe(404);
    expect((await login('admin@leap.dev', 'admin_dev_password_123')).token).toBeTruthy(); // still can log in
  });

  it('only an admin with the Hubs page permission can use it -- hub staff, suppliers, buyers and other admins are refused', async () => {
    const owner = await adminToken();
    const get = (token) => fetch(`${BACKEND_URL}/hub-staff`, { headers: token ? auth(token) : json });

    expect((await get(null)).status).toBe(401);
    expect((await get((await login('hub@leap.dev', 'hub_dev_password_123')).token)).status).toBe(403);
    expect((await get((await login('supplier@leap.dev', 'supplier_dev_password_123')).token)).status).toBe(403);

    const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: uniqueEmail('b'), password: 'test_password_123' }) }).then((r) => r.json());
    expect((await get(buyer.token)).status).toBe(403);

    // An admin whose permissions don't include the Hubs page.
    const limitedEmail = uniqueEmail('limited');
    await fetch(`${BACKEND_URL}/admin-users`, { method: 'POST', headers: auth(owner), body: JSON.stringify({ email: limitedEmail, password: 'limited_pass_123', name: 'Limited', allowedPages: ['orders'] }) });
    const limited = (await login(limitedEmail, 'limited_pass_123')).token;
    expect((await get(limited)).status).toBe(403);
    expect((await get(owner)).status).toBe(200);
  });

  it('every change is in the audit log, and no password ever appears there', async () => {
    const token = await adminToken();
    const { staff, temporaryPassword } = await createStaff(token);
    await fetch(`${BACKEND_URL}/hub-staff/${staff.id}/disable`, { method: 'POST', headers: auth(token) });
    const reset = await fetch(`${BACKEND_URL}/hub-staff/${staff.id}/reset-password`, { method: 'POST', headers: auth(token) }).then((r) => r.json());

    const log = await fetch(`${BACKEND_URL}/admin/audit-log`, { headers: auth(token) }).then((r) => r.json());
    const entries = (Array.isArray(log) ? log : log.entries).filter((e) => e.targetId === staff.id);
    const actions = entries.map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['hub_staff_created', 'hub_staff_disabled', 'hub_staff_password_reset']));
    const blob = JSON.stringify(entries);
    expect(blob).not.toContain(temporaryPassword);
    expect(blob).not.toContain(reset.temporaryPassword);
  });
});
