// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import { createRequire } from 'module';
import { spawn } from 'node:child_process';
import path from 'node:path';

const require = createRequire(import.meta.url);
const apiDir = path.resolve(import.meta.dirname, '../../../services/api');
const { getPendingMigrations, describeDatabaseError, databaseUnreachableBanner } = require(path.join(apiDir, 'src/config/pendingMigrations.js'));
const dir = path.join(apiDir, 'db/migrations');
const dbThrowing = (err) => ({ query: async () => { throw err; } });
const withCode = (code, message = 'x') => Object.assign(new Error(message), { code });

describe('a database that cannot be reached is reported as that, not as "every migration is pending"', () => {
  it('CRITICAL: a MISSING migrations table still means nothing was applied; a connection failure is NOT mistaken for it', async () => {
    const all = await getPendingMigrations({ db: dbThrowing(withCode('42P01', 'relation "schema_migrations" does not exist')), dir });
    expect(all.length).toBeGreaterThan(90);                                        // every migration file is pending
    for (const code of ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', '28P01', '3D000', '57P03']) {
      await expect(getPendingMigrations({ db: dbThrowing(withCode(code)), dir }), code).rejects.toMatchObject({ code });   // surfaced, not hidden
    }
  });

  it('every kind of database failure is described in plain words, and the startup banner names the reason and the fix', () => {
    expect(describeDatabaseError(withCode('ECONNREFUSED'))).toMatch(/not running|not accepting connections/);
    expect(describeDatabaseError(withCode('ENOTFOUND'))).toMatch(/cannot be found/);
    expect(describeDatabaseError(withCode('ETIMEDOUT'))).toMatch(/did not answer in time/);
    expect(describeDatabaseError(withCode('28P01'))).toMatch(/user name or password/);
    expect(describeDatabaseError(withCode('3D000'))).toMatch(/does not exist/);
    expect(describeDatabaseError(new Error('something odd'))).toBe('something odd');
    expect(describeDatabaseError(null)).toBeNull();
    const banner = databaseUnreachableBanner(withCode('ECONNREFUSED'));
    expect(banner).toContain('THE DATABASE CANNOT BE REACHED');
    expect(banner).toMatch(/Reason: the database is not running/);
    expect(banner).toMatch(/start PostgreSQL/);
    expect(banner).toMatch(/DATABASE_URL/);
  });
});

// The REAL backend, started with a database address nothing listens on.
const PORT = 4793;
let server;
afterAll(() => { if (server) server.kill(); });
async function waitForHealth() {
  for (let i = 0; i < 60; i += 1) {
    try { const r = await fetch(`http://localhost:${PORT}/health`); return { status: r.status, body: await r.json() }; } catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  throw new Error('the backend never answered');
}

describe('the real backend with no database', () => {
  it('CRITICAL: /health says "database_unreachable" with HTTP 503 and the reason, and does not list every migration as pending', async () => {
    server = spawn(process.execPath, ['src/index.js'], { cwd: apiDir, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, PORT: String(PORT), DATABASE_URL: 'postgresql://nobody:nothing@127.0.0.1:1/none', NODE_ENV: 'development' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    server.stdout.on('data', (d) => { output += d; }); server.stderr.on('data', (d) => { output += d; });
    const { status, body } = await waitForHealth();
    expect(status).toBe(503);
    expect(body.status).toBe('database_unreachable');
    expect(body.database.reachable).toBe(false);
    expect(body.database.reason).toMatch(/not running|not accepting connections/);
    expect(body.pendingMigrations).toBeNull();                                      // NOT the list of every migration file
    await new Promise((r) => setTimeout(r, 1500));
    expect(output).toContain('THE DATABASE CANNOT BE REACHED');                     // and the backend's own window says it too
    expect(output).not.toContain('DATABASE NOT UP TO DATE');
  }, 60000);
});
