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
const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const adminToken = async () => (await login('admin@leap.dev', 'admin_dev_password_123')).token;
const rawLogin = (email, password) => fetch(`${BACKEND_URL}/auth/login`, { method: 'POST', headers: json, body: JSON.stringify({ email, password }) });
const me = (token) => fetch(`${BACKEND_URL}/auth/me`, { headers: auth(token) }).then((r) => r.json());
const changePassword = (token, body) => fetch(`${BACKEND_URL}/auth/me/password`, { method: 'PATCH', headers: auth(token), body: JSON.stringify(body) });

// An admin creates a hub staff account: returns its email and TEMPORARY password.
async function newHubStaff() {
  const email = `pw-staff-${uniq()}@example.com`;
  const res = await fetch(`${BACKEND_URL}/hub-staff`, { method: 'POST', headers: auth(await adminToken()), body: JSON.stringify({ email, name: 'Password Test Staff', hubId: 'hub_guangzhou' }) });
  expect(res.status).toBe(201);
  const body = await res.json();
  return { email, temporaryPassword: body.temporaryPassword, staffId: body.staff.id };
}

describe.runIf(backendUp)('choosing your own password after being given a temporary one (real backend)', () => {
  it('CRITICAL: a new hub staff account is flagged "must change password" on login AND on /auth/me; an ordinary account is not', async () => {
    const staff = await newHubStaff();
    const loginRes = await rawLogin(staff.email, staff.temporaryPassword);
    expect(loginRes.status).toBe(200);
    const body = await loginRes.json();
    expect(body.user.mustChangePassword).toBe(true);
    expect((await me(body.token)).mustChangePassword).toBe(true);

    const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `pw-buyer-${uniq()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
    expect((await me(buyer.token)).mustChangePassword).toBe(false);
    expect((await login('admin@leap.dev', 'admin_dev_password_123')).user.mustChangePassword).toBe(false);
  }, 60000);

  it('CRITICAL: the refusals: no login, wrong current password, too short, the same password, nothing sent; none of them changes the password or the flag', async () => {
    const staff = await newHubStaff();
    const { token } = await (await rawLogin(staff.email, staff.temporaryPassword)).json();
    expect((await fetch(`${BACKEND_URL}/auth/me/password`, { method: 'PATCH', headers: json, body: JSON.stringify({ currentPassword: 'x', newPassword: 'y'.repeat(10) }) })).status).toBe(401);
    expect((await changePassword(token, { currentPassword: 'not-the-password', newPassword: 'a-good-new-password' })).status).toBe(401);
    expect((await changePassword(token, { currentPassword: staff.temporaryPassword, newPassword: 'short' })).status).toBe(400);
    const same = await changePassword(token, { currentPassword: staff.temporaryPassword, newPassword: staff.temporaryPassword });
    expect(same.status).toBe(400);
    expect((await same.json()).error).toMatch(/different/i);
    expect((await changePassword(token, {})).status).toBe(400);
    expect((await changePassword(token, { currentPassword: staff.temporaryPassword })).status).toBe(400);

    expect((await rawLogin(staff.email, staff.temporaryPassword)).status).toBe(200);   // the temporary password still works
    expect((await me(token)).mustChangePassword).toBe(true);                           // and the flag is still set
  }, 60000);

  it('CRITICAL: choosing a new password works: the new one logs in, the temporary one no longer does, and the flag is cleared', async () => {
    const staff = await newHubStaff();
    const { token } = await (await rawLogin(staff.email, staff.temporaryPassword)).json();
    const res = await changePassword(token, { currentPassword: staff.temporaryPassword, newPassword: 'my-own-new-password' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    expect((await rawLogin(staff.email, staff.temporaryPassword)).status).toBe(401);
    const again = await rawLogin(staff.email, 'my-own-new-password');
    expect(again.status).toBe(200);
    const body = await again.json();
    expect(body.user.mustChangePassword).toBe(false);
    expect((await me(body.token)).mustChangePassword).toBe(false);
  }, 60000);

  it('CRITICAL: when an admin RESETS the password the flag comes back, so the person must choose a new one again', async () => {
    const staff = await newHubStaff();
    const { token } = await (await rawLogin(staff.email, staff.temporaryPassword)).json();
    await changePassword(token, { currentPassword: staff.temporaryPassword, newPassword: 'my-own-new-password' });
    expect((await me((await (await rawLogin(staff.email, 'my-own-new-password')).json()).token)).mustChangePassword).toBe(false);

    const reset = await fetch(`${BACKEND_URL}/hub-staff/${staff.staffId}/reset-password`, { method: 'POST', headers: auth(await adminToken()), body: JSON.stringify({}) });
    expect(reset.status).toBe(200);
    const { temporaryPassword } = await reset.json();
    expect((await rawLogin(staff.email, 'my-own-new-password')).status).toBe(401);       // the old one stops working
    const body = await (await rawLogin(staff.email, temporaryPassword)).json();
    expect(body.user.mustChangePassword).toBe(true);
  }, 60000);

  it('anyone can change their own password (a buyer too), and it never touches anybody else\'s', async () => {
    const email = `pw-buyer2-${uniq()}@example.com`;
    const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email, password: 'test_password_123' }) }).then((r) => r.json());
    const other = await newHubStaff();
    expect((await changePassword(buyer.token, { currentPassword: 'test_password_123', newPassword: 'a-new-buyer-password' })).status).toBe(200);
    expect((await rawLogin(email, 'a-new-buyer-password')).status).toBe(200);
    expect((await rawLogin(other.email, other.temporaryPassword)).status).toBe(200);     // the other account is untouched
  }, 60000);
});
