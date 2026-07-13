import { describe, it, expect } from 'vitest';
import { login, getCurrentUser } from './auth';

/**
 * REAL integration test — no mocked fetch. Requires services/api actually
 * running locally with the dev admin seeded (node db/seed.js). Skipped
 * automatically if the backend isn't reachable, so this doesn't break CI
 * runs where a database isn't available — but when it does run, it proves
 * the actual login flow works against a real server, not just against a
 * fetch mock that assumes the API contract is correct.
 */
const BACKEND_URL = 'http://localhost:4000';

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

describe.runIf(await isBackendUp())('auth.js against a REAL running backend', () => {
  it('logs in with the seeded dev admin and gets a real JWT', async () => {
    const { token, user } = await login('admin@leap.dev', 'admin_dev_password_123');
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3); // real JWT structure: header.payload.signature
    expect(user.role).toBe('admin');
    expect(user.email).toBe('admin@leap.dev');
  });

  it('rejects a wrong password against the real backend', async () => {
    await expect(login('admin@leap.dev', 'wrong_password')).rejects.toThrow(/invalid email or password/i);
  });

  it('round-trips the token through the real GET /auth/me endpoint', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const user = await getCurrentUser(token);
    expect(user.email).toBe('admin@leap.dev');
    expect(user.role).toBe('admin');
  });

  it('rejects a garbage token against the real backend', async () => {
    await expect(getCurrentUser('not.a.real.token')).rejects.toThrow();
  });
});
