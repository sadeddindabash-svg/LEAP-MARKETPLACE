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

async function signupAndGetEmail() {
  const email = `pwreset-test-${Date.now()}-${Math.random()}@example.com`;
  await fetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'original_password_123' }),
  });
  return email;
}

const backendUp = await isBackendUp();

describe.runIf(backendUp)('password reset against a REAL running backend', () => {
  it('forgot-password returns the identical response for a real vs. a fake email (no enumeration leak)', async () => {
    const email = await signupAndGetEmail();
    const realRes = await fetch(`${BACKEND_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const fakeRes = await fetch(`${BACKEND_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `nonexistent-${Date.now()}@example.com` }),
    });
    expect(realRes.status).toBe(fakeRes.status);
    const [realBody, fakeBody] = await Promise.all([realRes.json(), fakeRes.json()]);
    expect(realBody.message).toBe(fakeBody.message);
  });

  it('rejects an invalid email format', async () => {
    const res = await fetch(`${BACKEND_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects a reset with a password under 8 characters', async () => {
    const res = await fetch(`${BACKEND_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'irrelevant-fails-length-check-first', newPassword: 'short' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects a completely invalid/nonexistent token', async () => {
    const res = await fetch(`${BACKEND_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'this-token-does-not-exist', newPassword: 'a_valid_new_password' }),
    });
    expect(res.status).toBe(400);
  });

  it('CRITICAL: a real reset actually changes the password — old password stops working, new one works', async () => {
    const email = await signupAndGetEmail();

    // We can't read the email that would be "sent" in production, but the
    // backend logs the token to its own console as a stand-in for real
    // delivery (see the route's header comment) — for this test, insert
    // a token directly the same way forgot-password itself would, so we
    // can drive the same code path without scraping server stdout.
    const forgotRes = await fetch(`${BACKEND_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    expect(forgotRes.status).toBe(200);

    // Fetch the token the only way a test can — via a direct DB read,
    // scoped to exactly this test's own email so it can't collide with
    // any other concurrently-running test's token.
    const pg = await import('pg');
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev' });
    const tokenRow = await pool.query(
      `SELECT prt.token FROM password_reset_tokens prt JOIN users u ON u.id = prt.user_id WHERE u.email = $1 ORDER BY prt.created_at DESC LIMIT 1`,
      [email]
    );
    await pool.end();
    const token = tokenRow.rows[0].token;

    const resetRes = await fetch(`${BACKEND_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: 'brand_new_password_456' }),
    });
    expect(resetRes.status).toBe(200);

    const oldLoginRes = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'original_password_123' }),
    });
    expect(oldLoginRes.status).toBe(401);

    const newLoginRes = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'brand_new_password_456' }),
    });
    expect(newLoginRes.status).toBe(200);

    // And the same token must not be usable a second time.
    const reuseRes = await fetch(`${BACKEND_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: 'yet_another_password_789' }),
    });
    expect(reuseRes.status).toBe(400);
  });
});
