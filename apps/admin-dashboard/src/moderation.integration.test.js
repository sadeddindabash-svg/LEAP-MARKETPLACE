import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { Pool } from 'pg';
import { login, fetchModerationQueue, moderateProduct } from './auth';

const BACKEND_URL = 'http://localhost:4000';
// Direct DB access for test setup/teardown only (resetting a product's
// moderation status) — there's no "resubmit for review" endpoint yet, so
// this is the only way to get a known starting state for the round-trip
// test below. Legitimate here since this is a Node-based integration test,
// not browser code.
//
// BUG FIXED HERE: this used to be hardcoded to 'leap_marketplace_dev',
// which silently broke in any environment testing against a differently-
// named database (e.g. a fresh verification database) — the reset query
// would succeed against the WRONG database, leaving the real target
// database's product status stale and causing confusing failures in
// unrelated-looking assertions. Now reads DATABASE_URL from the
// environment (the same variable the actual backend server uses), with
// the previous hardcoded value only as a fallback for plain local dev
// where nobody set it explicitly.
const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev';

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

const backendUp = await isBackendUp();
let pool;
if (backendUp) {
  pool = new Pool({ connectionString: TEST_DB_URL });
}

async function resetP9ToTranslating() {
  await pool.query("UPDATE products SET status = 'translating' WHERE id = 'p9'");
}

describe.runIf(backendUp)('catalog moderation against a REAL running backend', () => {
  beforeEach(async () => {
    await resetP9ToTranslating();
  });
  afterAll(async () => {
    await resetP9ToTranslating();
    await pool.end();
  });

  it('rejects fetchModerationQueue with no token', async () => {
    await expect(fetchModerationQueue(null)).rejects.toThrow();
  });

  it('rejects a non-admin (buyer) account', async () => {
    const email = `mod-test-${Date.now()}@example.com`;
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    });
    const { token: buyerToken } = await signupRes.json();
    await expect(fetchModerationQueue(buyerToken)).rejects.toThrow();
  });

  it('rejects an invalid moderate action', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    await expect(moderateProduct(token, 'p9', 'banana')).rejects.toThrow();
  });

  it('lists a known translating product with real, correctly-computed flags', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const queue = await fetchModerationQueue(token);

    const p9 = queue.find((p) => p.id === 'p9');
    expect(p9).toBeDefined();
    expect(p9.supplierName).toBe('Qingdao Transmission Works');
    // Real, derived flags — p9 has no product_fitment rows and its
    // supplier (s3) is seeded as recently created.
    expect(p9.flags).toContain('Missing fitment data');
    expect(p9.flags).toContain('New supplier');
  });

  it('approving moves the product out of the queue, and this is real and persisted', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');

    let queue = await fetchModerationQueue(token);
    expect(queue.find((p) => p.id === 'p9')).toBeDefined();

    const result = await moderateProduct(token, 'p9', 'approve');
    expect(result.status).toBe('active');

    // Re-fetch independently to confirm the removal from the queue is
    // real, not just trusting the moderate-action response.
    queue = await fetchModerationQueue(token);
    expect(queue.find((p) => p.id === 'p9')).toBeUndefined();
  });

  it('rejecting sets the product inactive (also removing it from the queue)', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');

    const result = await moderateProduct(token, 'p9', 'reject');
    expect(result.status).toBe('inactive');

    const queue = await fetchModerationQueue(token);
    expect(queue.find((p) => p.id === 'p9')).toBeUndefined();
  });
});
