// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'module';

// The backend modules involved here have no database dependency (the database is passed in), so they can be tested directly.
const backendDir = path.resolve(import.meta.dirname, '../../../services/api');
const backendRequire = createRequire(path.join(backendDir, 'package.json'));
const { installAsyncErrorHandling } = backendRequire('./src/config/asyncErrors.js');
const { getPendingMigrations, pendingMigrationsBanner } = backendRequire('./src/config/pendingMigrations.js');
const express = backendRequire('express');

const BACKEND_URL = 'http://localhost:4000';
async function isBackendUp() {
  try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; }
}
const backendUp = await isBackendUp();

// ---------------------------------------------------------------------------------------------------------------------------------------
describe('an error inside an async route returns a 500; it never stops the server', () => {
  async function withServer(build, check) {
    installAsyncErrorHandling(express);
    const app = express();
    build(app);
    app.use((err, req, res, next) => res.status(500).json({ error: err.message })); // the app's own error handler
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    try { await check(`http://127.0.0.1:${server.address().port}`); } finally { await new Promise((resolve) => server.close(resolve)); }
  }

  it('CRITICAL: a rejected promise in an async handler becomes a 500, and the very next request is still served', async () => {
    await withServer((app) => {
      app.get('/boom', async () => { throw new Error('column "replacement_of" does not exist'); });
      app.get('/fine', async (req, res) => res.json({ ok: true }));
    }, async (base) => {
      const boom = await fetch(`${base}/boom`);
      expect(boom.status).toBe(500);
      expect((await boom.json()).error).toContain('replacement_of');
      expect((await fetch(`${base}/fine`)).status).toBe(200); // the server is still up
      expect((await fetch(`${base}/boom`)).status).toBe(500);  // and it keeps surviving the same failure
    });
  });

  it('an async error that happens AFTER an await (the real case: a query that fails) is caught too', async () => {
    await withServer((app) => {
      app.post('/after-await', async (req, res) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        res.locals.done = true;
        await Promise.reject(new Error('failed after awaiting'));
      });
    }, async (base) => {
      const res = await fetch(`${base}/after-await`, { method: 'POST' });
      expect(res.status).toBe(500);
      expect((await res.json()).error).toBe('failed after awaiting');
    });
  });

  it('an error thrown synchronously, and a handler that works normally, behave exactly as they always did', async () => {
    await withServer((app) => {
      app.get('/sync-throw', () => { throw new Error('sync problem'); });
      app.get('/ok', (req, res) => res.json({ ok: 1 }));
      app.get('/via-next', (req, res, next) => next(new Error('passed on')));
      app.get('/async-ok', async (req, res) => { await Promise.resolve(); res.json({ ok: 2 }); });
    }, async (base) => {
      expect((await fetch(`${base}/sync-throw`)).status).toBe(500);
      expect(await (await fetch(`${base}/ok`)).json()).toEqual({ ok: 1 });
      expect((await (await fetch(`${base}/via-next`)).json()).error).toBe('passed on');
      expect(await (await fetch(`${base}/async-ok`)).json()).toEqual({ ok: 2 });
    });
  });

  it('middleware still runs in order, and an unknown route is a 404', async () => {
    await withServer((app) => {
      app.use(async (req, res, next) => { res.set('x-seen', 'yes'); next(); });
      app.get('/x', async (req, res) => res.json({ ok: true }));
    }, async (base) => {
      const res = await fetch(`${base}/x`);
      expect(res.headers.get('x-seen')).toBe('yes');
      expect((await fetch(`${base}/nope`)).status).toBe(404);
    });
  });

  it('installing it twice is harmless', () => {
    installAsyncErrorHandling(express);
    expect(installAsyncErrorHandling(express)).toBe(false); // already installed: it does nothing the second time
  });

  it('CRITICAL: the backend actually installs it, BEFORE any route is registered', () => {
    const source = fs.readFileSync(path.join(backendDir, 'src/index.js'), 'utf8');
    const install = source.indexOf('installAsyncErrorHandling();');
    const firstRoute = source.indexOf("app.use('/catalog'");
    expect(install).toBeGreaterThan(-1);
    expect(firstRoute).toBeGreaterThan(-1);
    expect(install).toBeLessThan(firstRoute);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------
describe('the backend says so when a migration has not been run', () => {
  function migrationsDir(...names) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leap-migrations-'));
    for (const name of names) fs.writeFileSync(path.join(dir, name), '-- test');
    return dir;
  }
  const dbWith = (applied) => ({ query: async () => ({ rows: applied.map((filename) => ({ filename })) }) });

  it('CRITICAL: lists exactly the migrations in the code that the database has not had, in order', async () => {
    const dir = migrationsDir('001_a.sql', '002_b.sql', '003_c.sql', '010_d.sql');
    expect(await getPendingMigrations({ db: dbWith(['001_a.sql', '002_b.sql']), dir })).toEqual(['003_c.sql', '010_d.sql']);
  });

  it('nothing pending when the database is up to date; files that are not .sql are ignored', async () => {
    const dir = migrationsDir('001_a.sql', '002_b.sql', 'notes.txt', 'README.md');
    expect(await getPendingMigrations({ db: dbWith(['001_a.sql', '002_b.sql']), dir })).toEqual([]);
  });

  it('a database that has no migrations table at all has EVERYTHING pending', async () => {
    const dir = migrationsDir('001_a.sql', '002_b.sql');
    const brokenDb = { query: async () => { throw new Error('relation "schema_migrations" does not exist'); } };
    expect(await getPendingMigrations({ db: brokenDb, dir })).toEqual(['001_a.sql', '002_b.sql']);
  });

  it('the warning names every pending migration and says exactly what to do', () => {
    const text = pendingMigrationsBanner(['095_replacement_orders.sql', '096_next.sql']);
    expect(text).toContain('2 migrations not applied yet');
    expect(text).toContain('095_replacement_orders.sql');
    expect(text).toContain('096_next.sql');
    expect(text).toContain('node db/migrate.js');
    expect(pendingMigrationsBanner(['095_replacement_orders.sql'])).toContain('1 migration not applied yet');
  });

  it('every real migration file in the repository is picked up (so a new one is never missed)', async () => {
    const real = fs.readdirSync(path.join(backendDir, 'db/migrations')).filter((f) => f.endsWith('.sql'));
    expect(real.length).toBeGreaterThan(90);
    const pending = await getPendingMigrations({ db: dbWith([]), dir: path.join(backendDir, 'db/migrations') });
    expect(pending).toEqual([...real].sort());
  });

  it.runIf(backendUp)('a RUNNING backend reports it in /health, and an up-to-date database shows none', async () => {
    const health = await fetch(`${BACKEND_URL}/health`).then((r) => r.json());
    expect(health.status).toBe('ok');                       // existing checks keep working
    expect(Array.isArray(health.pendingMigrations)).toBe(true);
    expect(health.pendingMigrations).toEqual([]);           // the test database has every migration
  });
});
