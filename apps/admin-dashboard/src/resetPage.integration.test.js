// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import { Pool } from 'pg';

const BACKEND_URL = 'http://localhost:4000';
// Direct DB access only to read the reset code the backend created (in real life it arrives by email), same approach as passwordReset.integration.test.js.
const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev';

async function isBackendUp() {
  try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; }
}
const backendUp = await isBackendUp();

const json = { 'Content-Type': 'application/json' };
const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pool = new Pool({ connectionString: TEST_DB_URL });
afterAll(async () => { await pool.end(); });
const ARABIC = /[\u0600-\u06FF]/;

async function userWithResetCode() {
  const email = `reset.${stamp()}@example.com`;
  const { user } = await (await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email, password: 'old_password_123' }) })).json();
  expect((await fetch(`${BACKEND_URL}/auth/forgot-password`, { method: 'POST', headers: json, body: JSON.stringify({ email }) })).status).toBe(200);
  const token = (await pool.query('SELECT token FROM password_reset_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [user.id])).rows[0].token;
  return { email, token };
}

describe.runIf(backendUp)('the page the password reset email\'s button opens (real backend)', () => {
  it('CRITICAL: the page opens for a real code, in English AND Arabic, never cached and never passed on, and holds nothing but the code', async () => {
    const { token, email } = await userWithResetCode();
    const res = await fetch(`${BACKEND_URL}/reset-password?token=${token}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    const html = await res.text();
    expect(html).toContain('Choose a new password');
    expect(html).toMatch(ARABIC);
    expect(html).toContain('اختر كلمة مرور جديدة');
    expect(html).toContain(token);
    expect(html).toContain('noindex');
    expect(html).not.toContain(email);                                    // nothing about the person is in the page
  }, 60000);

  it('CRITICAL: anything that is not a well-formed code gets a polite 404 page, and nothing is ever written into the page', async () => {
    for (const bad of ['', 'short', 'z'.repeat(64), `${'a'.repeat(63)}"`, encodeURIComponent('"></script><script>alert(1)</script>'), 'a'.repeat(65)]) {
      const res = await fetch(`${BACKEND_URL}/reset-password?token=${bad}`);
      expect(res.status, bad).toBe(404);
      expect(res.headers.get('content-type')).toContain('text/html');
      const html = await res.text();
      expect(html).not.toContain('<script>alert');
      expect(html).toMatch(ARABIC);
    }
    expect((await fetch(`${BACKEND_URL}/reset-password`)).status).toBe(404); // no code at all
  }, 60000);

  it('CRITICAL: the whole journey the page performs: the new password works, the old one stops, and the code can be used only once', async () => {
    const { email, token } = await userWithResetCode();
    const reset = (newPassword) => fetch(`${BACKEND_URL}/auth/reset-password`, { method: 'POST', headers: json, body: JSON.stringify({ token, newPassword }) });
    const login = (password) => fetch(`${BACKEND_URL}/auth/login`, { method: 'POST', headers: json, body: JSON.stringify({ email, password }) });

    expect((await reset('short')).status).toBe(400);                       // too short: refused, and the code is NOT used up
    expect((await reset('my_new_password_456')).status).toBe(200);
    expect((await login('my_new_password_456')).status).toBe(200);
    expect((await login('old_password_123')).status).toBe(401);
    const second = await reset('another_password_789');
    expect(second.status).toBe(400);                                       // used once, that is all
    expect((await login('my_new_password_456')).status).toBe(200);         // the second attempt changed nothing
  }, 60000);
});
