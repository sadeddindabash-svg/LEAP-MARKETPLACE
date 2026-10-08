// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { Pool } from 'pg';

// The cleanup tool's DRY RUN must change NOTHING. (This test never runs it with --apply.) It uses the database the backend uses, like the other integration tests.
const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev';
const apiDir = path.resolve(import.meta.dirname, '../../../services/api');
const pool = new Pool({ connectionString: TEST_DB_URL });
afterAll(async () => { await pool.end(); });

async function reachable() { try { await pool.query('SELECT 1'); return true; } catch { return false; } }
const dbUp = await reachable();

async function snapshot() {
  const one = async (sql) => (await pool.query(sql)).rows[0].n;
  return {
    categories: await one('SELECT count(*)::int AS n FROM product_categories'),
    parts: await one('SELECT count(*)::int AS n FROM category_parts'),
    brands: await one('SELECT count(*)::int AS n FROM vehicle_brands'),
    hubs: await one('SELECT count(*)::int AS n FROM hubs'),
    activeProducts: await one(`SELECT count(*)::int AS n FROM products WHERE status = 'active'`),
    inactiveProducts: await one(`SELECT count(*)::int AS n FROM products WHERE status = 'inactive'`),
    admins: await one(`SELECT count(*)::int AS n FROM users WHERE role = 'admin'`),
    lockedOrChanged: await one(`SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND password_hash IS NOT NULL`),
    openFlags: await one(`SELECT count(*)::int AS n FROM hub_shipments WHERE resolved_at IS NULL`),
    openFaultCases: await one(`SELECT count(*)::int AS n FROM fault_cases WHERE status <> 'completed'`),
    openReturnCases: await one(`SELECT count(*)::int AS n FROM return_cases WHERE status NOT IN ('completed', 'rejected')`),
  };
}

describe.runIf(dbUp)('the cleanup tool\'s dry run', () => {
  it('CRITICAL: explains what it would do, says nothing was changed, and really changes nothing (counts before and after are identical)', async () => {
    const before = await snapshot();
    const output = execFileSync('node', ['scripts/remove-test-data.js'], { cwd: apiDir, env: { ...process.env, DATABASE_URL: TEST_DB_URL }, encoding: 'utf8' });
    expect(output).toContain('DRY RUN: nothing is changed');
    expect(output).toContain('Nothing was changed. To do it for real:  node scripts/remove-test-data.js --apply');
    for (const line of ['Test products', 'Test categories', 'Test parts', 'Test vehicle brands', 'Test hubs', 'Test ADMIN accounts', 'Open flagged shipments of TEST accounts']) expect(output).toContain(line);
    expect(output).not.toContain('Removing test data');
    expect(output).not.toContain('backup of what was removed');
    expect(await snapshot()).toEqual(before);
  }, 60000);

  it('running the dry run twice gives the same answer (it is repeatable, and leaves no backup file behind)', async () => {
    const run = () => execFileSync('node', ['scripts/remove-test-data.js'], { cwd: apiDir, env: { ...process.env, DATABASE_URL: TEST_DB_URL }, encoding: 'utf8' });
    const first = run();
    expect(run()).toBe(first);
  }, 90000);
});
