import { describe, it, expect } from 'vitest';

const BACKEND_URL = 'http://localhost:4000';

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function signupBuyer(password = 'test_password_123') {
  const email = `change-email-test-${Date.now()}-${Math.random()}@example.com`;
  const res = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  return { email, password, token: body.token };
}

const backendUp = await isBackendUp();

// Real "change email" endpoint (new) -- closes a real, confirmed gap:
// no self-service way to change your account email existed at all
// before this, only display-only in every real client.
describe.runIf(backendUp)('PATCH /auth/me/email against a REAL running backend', () => {
  it('CRITICAL: a real, correct request actually changes the email and returns a real, fresh JWT with the new email claim', async () => {
    const { password, token } = await signupBuyer();
    const newEmail = `changed-${Date.now()}@example.com`;
    const res = await fetch(`${BACKEND_URL}/auth/me/email`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ newEmail, currentPassword: password }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe(newEmail);

    // Real JWT claim check -- decode the real payload directly, not
    // just trust the response body's own user object.
    const payload = JSON.parse(Buffer.from(body.token.split('.')[1], 'base64url').toString());
    expect(payload.email).toBe(newEmail);

    // Real round-trip -- the new token should actually work.
    const meRes = await fetch(`${BACKEND_URL}/auth/me`, { headers: { Authorization: `Bearer ${body.token}` } });
    const me = await meRes.json();
    expect(me.email).toBe(newEmail);
  });

  it('CRITICAL: a wrong current password is rejected, the real email never changes', async () => {
    const { email, token } = await signupBuyer();
    const res = await fetch(`${BACKEND_URL}/auth/me/email`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ newEmail: 'someone-new@example.com', currentPassword: 'wrong_password' }),
    });
    expect(res.status).toBe(401);

    const meRes = await fetch(`${BACKEND_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    const me = await meRes.json();
    expect(me.email).toBe(email); // unchanged
  });

  it('rejects an invalid email format', async () => {
    const { password, token } = await signupBuyer();
    const res = await fetch(`${BACKEND_URL}/auth/me/email`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ newEmail: 'not-an-email', currentPassword: password }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects an email already used by a real, different account', async () => {
    const buyerA = await signupBuyer();
    const buyerB = await signupBuyer();
    const res = await fetch(`${BACKEND_URL}/auth/me/email`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerA.token}` },
      body: JSON.stringify({ newEmail: buyerB.email, currentPassword: buyerA.password }),
    });
    expect(res.status).toBe(409);
  });

  it('rejects setting it to the exact same email already in use', async () => {
    const { email, password, token } = await signupBuyer();
    const res = await fetch(`${BACKEND_URL}/auth/me/email`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ newEmail: email, currentPassword: password }),
    });
    expect(res.status).toBe(400);
  });
});
