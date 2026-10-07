// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import { Pool } from 'pg';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';
// Direct DB access for inspection only (what is stored, whether a reset code was created), same approach as payouts.integration.test.js.
const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev';
const ADDRESS = { recipientName: 'John Smith', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' };

async function isBackendUp() {
  try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; }
}
const backendUp = await isBackendUp();

const json = { 'Content-Type': 'application/json' };
const auth = (token) => ({ ...json, Authorization: `Bearer ${token}` });
const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pool = new Pool({ connectionString: TEST_DB_URL });
afterAll(async () => { await pool.end(); });
const adminToken = async () => (await login('admin@leap.dev', 'admin_dev_password_123')).token;

const signup = (email, password = 'test_password_123') => fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email, password }) });
const loginAs = (email, password = 'test_password_123') => fetch(`${BACKEND_URL}/auth/login`, { method: 'POST', headers: json, body: JSON.stringify({ email, password }) });
const forgot = (email) => fetch(`${BACKEND_URL}/auth/forgot-password`, { method: 'POST', headers: json, body: JSON.stringify({ email }) });
const storedEmail = async (id) => (await pool.query('SELECT email FROM users WHERE id = $1', [id])).rows[0].email;
const resetCodes = async (userId) => Number((await pool.query('SELECT count(*) AS n FROM password_reset_tokens WHERE user_id = $1', [userId])).rows[0].n);

describe.runIf(backendUp)('email addresses are matched WITHOUT regard to capital letters (real backend)', () => {
  it('CRITICAL: an address typed with capitals is stored in lowercase, and the person can sign in however they type it (a phone keyboard capitalising the first letter used to lock them out)', async () => {
    const lower = `case.${stamp()}@example.com`;
    const typed = `Case.${lower.slice(5).toUpperCase().replace('@EXAMPLE.COM', '@Example.com')}`;
    const res = await signup(typed);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.email).toBe(typed.toLowerCase());
    expect(await storedEmail(body.user.id)).toBe(typed.toLowerCase());
    for (const attempt of [typed, typed.toLowerCase(), typed.toUpperCase(), `  ${typed}  `]) {
      expect((await loginAs(attempt)).status, attempt).toBe(200);
    }
    expect((await loginAs(typed, 'wrong-password')).status).toBe(401);       // the password is still checked
  }, 60000);

  it('CRITICAL: the same address in different capitals is the SAME account: it cannot be registered twice', async () => {
    const email = `dup.${stamp()}@example.com`;
    expect((await signup(email)).status).toBe(201);
    const again = await signup(email.toUpperCase().replace('@EXAMPLE.COM', '@example.com'));
    expect(again.status).toBe(409);
    expect((await again.json()).error).toMatch(/already exists/i);
    // and the database itself refuses it (the unique index is on lower(email))
    await expect(pool.query(`INSERT INTO users (id, email, role) VALUES ($1, $2, 'buyer')`, [`u_dup_${stamp()}`, email.toUpperCase()])).rejects.toThrow(/users_email_lower_unique|duplicate key/);
  }, 60000);

  it('CRITICAL: "forgot password" finds the account whatever capitals were typed (it used to silently send nothing)', async () => {
    const email = `forgot.${stamp()}@example.com`;
    const { user } = await (await signup(email)).json();
    expect(await resetCodes(user.id)).toBe(0);
    for (const attempt of [email, email.toUpperCase(), `${email[0].toUpperCase()}${email.slice(1)}`]) {
      expect((await forgot(attempt)).status).toBe(200);
    }
    expect(await resetCodes(user.id)).toBe(3);                              // each spelling created a real reset code
    const unknown = await forgot(`nobody.${stamp()}@example.com`);
    expect(unknown.status).toBe(200);                                       // an unknown address still looks exactly the same from outside
    expect((await unknown.json()).message).toMatch(/If that email is registered/);
  }, 60000);

  it('CRITICAL: "forgot password" is answered at once, and just as fast for an unknown address as for a real one (it must never wait for the email: a slow mail server made the app say "no internet connection", and the delay told a stranger the address was registered)', async () => {
    const email = `fast.${stamp()}@example.com`;
    await signup(email);
    const time = async (address) => { const start = Date.now(); const res = await forgot(address); return { status: res.status, ms: Date.now() - start }; };
    const real = await time(email);
    const unknown = await time(`nobody.${stamp()}@example.com`);
    expect(real.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(real.ms).toBeLessThan(1500);
    expect(unknown.ms).toBeLessThan(1500);
    expect(Math.abs(real.ms - unknown.ms)).toBeLessThan(1000);          // no tell-tale difference
  }, 30000);

  it('changing your email stores it in lowercase, and cannot take an address that differs from someone else\'s only by capitals', async () => {
    const mine = `mine.${stamp()}@example.com`;
    const theirs = `theirs.${stamp()}@example.com`;
    const me = await (await signup(mine)).json();
    await signup(theirs);
    const change = (newEmail) => fetch(`${BACKEND_URL}/auth/me/email`, { method: 'PATCH', headers: auth(me.token), body: JSON.stringify({ newEmail, currentPassword: 'test_password_123' }) });
    const taken = await change(theirs.toUpperCase().replace('@EXAMPLE.COM', '@example.com'));
    expect(taken.status).toBe(409);
    const moved = `Moved.${stamp()}@Example.COM`;
    const ok = await change(moved);
    expect(ok.status).toBe(200);
    expect(await storedEmail(me.user.id)).toBe(moved.toLowerCase());
    expect((await loginAs(moved)).status).toBe(200);
  }, 60000);

  it('hub staff and admin accounts are stored in lowercase too, and "Sara@x.com" cannot be created next to "sara@x.com"', async () => {
    const token = await adminToken();
    const hubEmail = `Hub.Case.${stamp()}@Example.com`;
    const created = await fetch(`${BACKEND_URL}/hub-staff`, { method: 'POST', headers: auth(token), body: JSON.stringify({ email: hubEmail, name: 'Case Test Staff', hubId: 'hub_guangzhou' }) });
    expect(created.status).toBe(201);
    const { staff, temporaryPassword } = await created.json();
    expect(await storedEmail(staff.id)).toBe(hubEmail.toLowerCase());
    expect((await loginAs(hubEmail.toUpperCase().replace('@EXAMPLE.COM', '@example.com'), temporaryPassword)).status).toBe(200);
    const dup = await fetch(`${BACKEND_URL}/hub-staff`, { method: 'POST', headers: auth(token), body: JSON.stringify({ email: hubEmail.toLowerCase(), name: 'Another', hubId: 'hub_guangzhou' }) });
    expect(dup.status).toBe(409);

    const adminEmail = `Admin.Case.${stamp()}@Example.com`;
    const admin = await fetch(`${BACKEND_URL}/admin-users`, { method: 'POST', headers: auth(token), body: JSON.stringify({ email: adminEmail, name: 'Case Admin', password: 'test_password_123', allowedPages: [] }) });
    expect([200, 201]).toContain(admin.status);
    expect((await loginAs(adminEmail.toLowerCase())).status).toBe(200);
  }, 60000);

  it('CRITICAL: a guest\'s order is reachable with the address typed in ANY capitals, a different address is refused, and signing up links the guest orders whatever the capitals', async () => {
    const guest = `Guest.${stamp()}@Example.com`;
    const order = await fetch(`${BACKEND_URL}/order`, { method: 'POST', headers: json, body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], guestEmail: guest, address: ADDRESS }) }).then((r) => r.json());
    expect(order.id).toBeTruthy();
    expect((await pool.query('SELECT guest_email FROM orders WHERE id = $1', [order.id])).rows[0].guest_email).toBe(guest.toLowerCase());
    for (const attempt of [guest, guest.toLowerCase(), guest.toUpperCase()]) {
      expect((await fetch(`${BACKEND_URL}/order/${order.id}?guestEmail=${encodeURIComponent(attempt)}`)).status, attempt).toBe(200);
    }
    expect((await fetch(`${BACKEND_URL}/order/${order.id}?guestEmail=${encodeURIComponent(`other.${stamp()}@example.com`)}`)).status).toBe(404);
    expect((await fetch(`${BACKEND_URL}/order/${order.id}`)).status).toBe(404);                  // no address at all

    const signedUp = await (await signup(guest.toLowerCase())).json();                          // they register later, typing it differently
    expect(signedUp.linkedOrderCount).toBe(1);
    expect((await pool.query('SELECT buyer_id FROM orders WHERE id = $1', [order.id])).rows[0].buyer_id).toBe(signedUp.user.id);
  }, 60000);
});
