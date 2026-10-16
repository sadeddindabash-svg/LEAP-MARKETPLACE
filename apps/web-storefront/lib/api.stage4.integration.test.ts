import { describe, it, expect } from 'vitest';
import { changeEmail, confirmTwoFactor, deleteAccount, disableTwoFactor, fetchLoyaltyStatus, forgotPassword, setupTwoFactor, updateAvatar } from './api';
import { currentCode } from './testTotp';

// Account and sign-in security against a REAL running backend and database: two-step sign-in with real authenticator codes, changing the email, the photo, loyalty, deleting
// an account, and the reset email request.
const BACKEND_URL = 'http://localhost:4000';
async function isBackendUp(): Promise<boolean> { try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; } }
const backendUp = await isBackendUp();

let counter = 0;
const PASSWORD = 'stage4_password_123';
async function post(path: string, body: unknown, token?: string) {
  const res = await fetch(`${BACKEND_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
async function me(token: string) {
  const res = await fetch(`${BACKEND_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
async function newBuyer(name?: string) {
  const email = `stage4-${Date.now()}-${++counter}@leap.dev`;
  const res = await post('/auth/signup', { email, password: PASSWORD, ...(name ? { name } : {}) });
  expect(res.status).toBe(201);
  return { email, token: res.body.token as string, id: res.body.user.id as string };
}
const login = (email: string, password = PASSWORD) => post('/auth/login', { email, password });

describe.runIf(backendUp)('stage 4a: account and sign-in security against a REAL backend', () => {
  it('sign-up, sign-in and the account: the buyer is known with the fields the pages use; the wrong password and a taken email are refused', async () => {
    const buyer = await newBuyer('Stage Four');
    const account = await me(buyer.token);
    expect(account.body).toMatchObject({ id: buyer.id, email: buyer.email, name: 'Stage Four', role: 'buyer', twoFactorEnabled: false, mustChangePassword: false });
    expect(account.body).toHaveProperty('avatarUrl');
    const ok = await login(buyer.email);
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();
    expect((await login(buyer.email, 'not-the-password')).status).toBe(401);
    const taken = await post('/auth/signup', { email: buyer.email, password: PASSWORD });
    expect(taken.status).toBe(409);
    expect((await post('/auth/signup', { email: `short-${Date.now()}@leap.dev`, password: 'short' })).status).toBe(400);
    expect((await post('/auth/signup', { email: 'not-an-email', password: PASSWORD })).status).toBe(400);
  }, 60000);

  it('CRITICAL: the whole two-step sign-in lifecycle with REAL codes: setup, a wrong code refused, confirm, then the password alone gives NO token, the code gives one, then it is turned off with the password', async () => {
    const buyer = await newBuyer();
    const setup = await setupTwoFactor(buyer.token);
    expect(setup.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(setup.secret).toMatch(/^[A-Z2-7]{16,}$/);
    expect((await me(buyer.token)).body.twoFactorEnabled).toBe(false);                                         // setup alone turns nothing on

    await expect(confirmTwoFactor(buyer.token, '000000')).rejects.toThrow(/Incorrect code/);
    expect((await me(buyer.token)).body.twoFactorEnabled).toBe(false);
    await confirmTwoFactor(buyer.token, await currentCode(setup.secret));
    expect((await me(buyer.token)).body.twoFactorEnabled).toBe(true);

    const first = await login(buyer.email);                                                                    // the password alone
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ requiresTwoFactor: true, userId: buyer.id });
    expect(first.body.token).toBeUndefined();                                                                  // NO token: this is what the website used to get wrong
    const wrong = await post('/auth/login/2fa', { userId: buyer.id, code: '000000' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.token).toBeUndefined();
    const second = await post('/auth/login/2fa', { userId: buyer.id, code: await currentCode(setup.secret) });
    expect(second.status).toBe(200);
    expect((await me(second.body.token)).body).toMatchObject({ email: buyer.email, twoFactorEnabled: true });

    await expect(disableTwoFactor(buyer.token, 'wrong-password')).rejects.toThrow(/Incorrect password/);
    expect((await me(buyer.token)).body.twoFactorEnabled).toBe(true);                                          // a wrong password turned nothing off
    await disableTwoFactor(buyer.token, PASSWORD);
    expect((await me(buyer.token)).body.twoFactorEnabled).toBe(false);
    expect((await login(buyer.email)).body.token).toBeTruthy();                                                // a plain sign-in again
  }, 120000);

  it('CRITICAL: changing the email gives a NEW working token; the new email signs in and the old one no longer does; wrong password, same email, taken email and bad email are refused', async () => {
    const buyer = await newBuyer();
    const other = await newBuyer();
    const newEmail = `changed-${Date.now()}-${++counter}@leap.dev`;
    await expect(changeEmail(buyer.token, newEmail, 'wrong-password')).rejects.toThrow(/incorrect/i);
    await expect(changeEmail(buyer.token, buyer.email, PASSWORD)).rejects.toThrow(/already your current email/i);
    await expect(changeEmail(buyer.token, other.email, PASSWORD)).rejects.toThrow(/already in use/i);
    await expect(changeEmail(buyer.token, 'not-an-email', PASSWORD)).rejects.toThrow(/valid/i);
    const done = await changeEmail(buyer.token, newEmail, PASSWORD);
    expect(done.user).toMatchObject({ id: buyer.id, email: newEmail });
    expect((await me(done.token)).body.email).toBe(newEmail);                                                  // the new token works
    expect((await login(newEmail)).status).toBe(200);
    expect((await login(buyer.email)).status).toBe(401);                                                       // the old email is gone
  }, 90000);

  it('the photo can be set and removed, and the account shows it', async () => {
    const buyer = await newBuyer();
    await updateAvatar(buyer.token, '/uploads/me.jpg');
    expect((await me(buyer.token)).body.avatarUrl).toBe('/uploads/me.jpg');
    await updateAvatar(buyer.token, null);
    expect((await me(buyer.token)).body.avatarUrl).toBeNull();
  }, 30000);

  it('loyalty: the status has the documented shape (every tier with its threshold), and asks for a sign-in', async () => {
    const buyer = await newBuyer();
    const status = await fetchLoyaltyStatus(buyer.token);
    expect(Array.isArray(status.allTiers)).toBe(true);
    for (const tier of status.allTiers) expect(tier).toMatchObject({ id: expect.anything(), name: expect.any(String), color: expect.any(String), icon: expect.any(String), discountPercentage: expect.any(Number), spendThreshold: expect.any(Number) });
    expect(typeof status.lifetimeSpend).toBe('number');
    expect(typeof status.progressPercent).toBe('number');
    if (status.currentTier) expect(status.allTiers.map((t) => t.id)).toContain(status.currentTier.id);
    await expect(fetchLoyaltyStatus('not-a-real-token')).rejects.toThrow();
  }, 30000);

  it('CRITICAL: the reset email request answers the SAME for an address that has an account and one that does not (nobody can find out who is registered)', async () => {
    const buyer = await newBuyer();
    const known = await post('/auth/forgot-password', { email: buyer.email });
    const unknown = await post('/auth/forgot-password', { email: `nobody-${Date.now()}@leap.dev` });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    await expect(forgotPassword(buyer.email)).resolves.toBeUndefined();
    await expect(forgotPassword('not-an-email')).rejects.toThrow(/valid email/i);
  }, 60000);

  it('CRITICAL: deleting the account needs the right password (a wrong one deletes nothing) and afterwards that email can no longer sign in', async () => {
    const buyer = await newBuyer();
    await expect(deleteAccount(buyer.token, 'wrong-password')).rejects.toThrow(/Incorrect password/);
    expect((await login(buyer.email)).status).toBe(200);
    await deleteAccount(buyer.token, PASSWORD);
    expect((await login(buyer.email)).status).toBe(401);
  }, 60000);
});
