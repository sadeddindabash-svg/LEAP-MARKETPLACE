// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { Pool } from 'pg';

// Runs the REAL command (node scripts/check-launch-readiness.js --json) against the database the tests use, with the settings pinned so the answer does not
// depend on any .env, and proves it only READS: nothing in the database changes.
const apiDir = path.resolve(import.meta.dirname, '../../../services/api');
const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev';
const pool = new Pool({ connectionString: TEST_DB_URL });
afterAll(async () => { await pool.end(); });
async function dbUp() { try { await pool.query('SELECT 1'); return true; } catch { return false; } }
const up = await dbUp();
const counts = async () => (await pool.query(`SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM orders) AS orders, (SELECT count(*) FROM products) AS products,
  (SELECT count(*) FROM hubs) AS hubs, (SELECT count(*) FROM schema_migrations) AS migrations, (SELECT string_agg(md5(password_hash), ',' ORDER BY id) FROM users WHERE role <> 'buyer') AS password_fingerprint`)).rows[0];

const PINNED = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, DATABASE_URL: TEST_DB_URL, NODE_ENV: 'development', JWT_SECRET: '', CREDENTIALS_ENCRYPTION_KEY: '', PUBLIC_API_URL: '', STOREFRONT_URL: '', SUPPLIER_PORTAL_URL: '',
  SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASSWORD: '', SMTP_FROM_EMAIL: '', STRIPE_SECRET_KEY: '', TRACK17_WEBHOOK_SECRET: '', TRACK17_API_KEY: '', FIREBASE_SERVICE_ACCOUNT_JSON: '' };

describe.runIf(up)('node scripts/check-launch-readiness.js (the real command)', () => {
  it('CRITICAL: it runs, answers "not ready" for a development setup (exit code 1), names every check, and CHANGES NOTHING in the database', async () => {
    const before = await counts();
    const run = spawnSync(process.execPath, ['scripts/check-launch-readiness.js', '--json'], { cwd: apiDir, env: PINNED, encoding: 'utf8', timeout: 120000 });
    expect(run.status, run.stderr).toBe(1);
    const { summary, results } = JSON.parse(run.stdout);
    const levels = Object.fromEntries(results.map((r) => [r.id, r.level]));
    for (const id of ['environment', 'jwt', 'credentialsKey', 'defaultPasswords', 'testAdmins', 'testAccounts', 'testData', 'fakeReviews', 'twoFactor', 'realHub', 'migrations', 'database',
      'url:PUBLIC_API_URL', 'url:STOREFRONT_URL', 'url:SUPPLIER_PORTAL_URL', 'email', 'payment', 'trackingSecret', 'push', 'storage', 'translation']) expect(Object.keys(levels), id).toContain(id);
    expect(levels.jwt).toBe('fail');                                          // the pinned settings are the development defaults
    expect(levels.email).toBe('fail');
    expect(levels.payment).toBe('fail');
    expect(levels.migrations).toBe('pass');                                  // the test database is fully migrated
    expect(summary.fail).toBeGreaterThan(5);
    expect(run.stdout).not.toMatch(/admin_dev_password_123|supplier_dev_password_123|hub_dev_password_123|test_password_123/);   // never prints a password
    expect(await counts()).toEqual(before);                                  // read-only: users, orders, products, hubs, migrations and every staff password hash untouched
  }, 150000);

  it('the human readable report ends with the verdict and points at the checklist for what a person must do', () => {
    const run = spawnSync(process.execPath, ['scripts/check-launch-readiness.js'], { cwd: apiDir, env: PINNED, encoding: 'utf8', timeout: 120000 });
    expect(run.status).toBe(1);
    expect(run.stdout).toMatch(/\[FAIL\] JWT_SECRET is missing or is the public development default/);
    expect(run.stdout).toMatch(/Fix: Generate a random value/);
    expect(run.stdout).toMatch(/NOT ready: fix every \[FAIL\]/);
    expect(run.stdout).toContain('docs/LAUNCH-CHECKLIST.md');
  }, 150000);
});
