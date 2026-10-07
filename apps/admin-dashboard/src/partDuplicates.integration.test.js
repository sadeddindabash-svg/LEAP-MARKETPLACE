// @vitest-environment node
import { describe, it, expect, vi, afterAll } from 'vitest';
import { Pool } from 'pg';
import { login } from './auth';
import { ensureSeedParts } from './productFixtures';

const BACKEND_URL = 'http://localhost:4000';
// Direct DB access for inspection only (the unique index, ids), same approach as payouts.integration.test.js.
const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev';

async function isBackendUp() {
  try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; }
}
const backendUp = await isBackendUp();

const json = { 'Content-Type': 'application/json' };
const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pool = new Pool({ connectionString: TEST_DB_URL });
afterAll(async () => { await pool.end(); });
const adminToken = async () => (await login('admin@leap.dev', 'admin_dev_password_123')).token;
const addPart = async (categoryId, nameEn, nameAr = 'قطعة اختبار') => fetch(`${BACKEND_URL}/catalog/categories/${categoryId}/parts`, { method: 'POST', headers: { ...json, Authorization: `Bearer ${await adminToken()}` }, body: JSON.stringify({ nameEn, nameAr }) });
const partsOf = (categoryId) => fetch(`${BACKEND_URL}/catalog/categories/${categoryId}/parts`).then((r) => r.json());

describe.runIf(backendUp)('a category cannot have two parts with the same name (real backend)', () => {
  it('CRITICAL: the same name again is refused (409), whatever the capitals or extra spaces, and only ONE copy is ever stored', async () => {
    const name = `DupGuard${stamp()}`;
    expect((await addPart('brake', name)).status).toBe(201);
    for (const again of [name, name.toUpperCase(), name.toLowerCase(), `  ${name}  `, `${name}\t`]) {
      const res = await addPart('brake', again);
      expect(res.status, JSON.stringify(again)).toBe(409);
      expect((await res.json()).error).toContain('already has a part called');
    }
    expect((await partsOf('brake')).filter((p) => p.nameEn.toLowerCase() === name.toLowerCase())).toHaveLength(1);
  }, 60000);

  it('the same name in a DIFFERENT category is fine (a "Sensor" can exist in two systems)', async () => {
    const name = `SharedName${stamp()}`;
    expect((await addPart('brake', name)).status).toBe(201);
    expect((await addPart('engine', name)).status).toBe(201);
  }, 60000);

  it('renaming a part into a name that is already taken is refused; renaming it to its own name (or just changing the Arabic) is fine', async () => {
    const a = `RenameA${stamp()}`;
    const b = `RenameB${stamp()}`;
    const partA = await (await addPart('brake', a)).json();
    const partB = await (await addPart('brake', b)).json();
    const rename = async (id, nameEn, nameAr = 'اسم جديد') => fetch(`${BACKEND_URL}/catalog/parts/${id}`, { method: 'PATCH', headers: { ...json, Authorization: `Bearer ${await adminToken()}` }, body: JSON.stringify({ nameEn, nameAr }) });
    expect((await rename(partB.id, a.toUpperCase())).status).toBe(409);       // into A's name
    expect((await rename(partB.id, b)).status).toBe(200);                      // its own name, new Arabic
    expect((await rename(partA.id, `${a} renamed`)).status).toBe(200);        // a genuinely new name
    expect((await rename('part_that_does_not_exist', 'Anything')).status).toBe(404);
  }, 60000);

  it('CRITICAL: ten parts created at the same moment all succeed and get different ids (two made in the same millisecond used to collide)', async () => {
    const base = `Burst${stamp()}`;
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => addPart('filters', `${base}-${i}`)));
    expect(results.map((r) => r.status)).toEqual(Array(10).fill(201));
    const ids = (await Promise.all(results.map((r) => r.json()))).map((p) => p.id);
    expect(new Set(ids).size).toBe(10);
  }, 60000);

  it('CRITICAL: the test helper that restores the seed part LOOKS FIRST: with the part present it sends no creation request at all, however many fresh copies of it run (every test file runs one)', async () => {
    const copies = async () => (await partsOf('brake')).filter((p) => p.nameEn === 'Front Brake Disc').length;
    await ensureSeedParts();
    expect(await copies()).toBe(1);
    const realFetch = globalThis.fetch;
    const creations = [];
    globalThis.fetch = (url, options) => { if (String(url).includes('/parts') && options?.method === 'POST') creations.push(String(url)); return realFetch(url, options); };
    try {
      for (let i = 0; i < 4; i += 1) {
        vi.resetModules();                                   // a fresh copy, with its "already checked" flag reset: what each test FILE gets
        const fresh = await import('./productFixtures');
        await fresh.ensureSeedParts();
      }
    } finally {
      globalThis.fetch = realFetch;
    }
    expect(creations).toEqual([]);                           // it never tried to create the part
    expect(await copies()).toBe(1);
  }, 60000);

  it('the database itself refuses a duplicate even if something bypassed the server (the unique index)', async () => {
    await expect(pool.query(`INSERT INTO category_parts (id, category_id, name_en, name_ar) VALUES ($1, 'brake', 'FRONT BRAKE DISC', 'x')`, [`part_bypass_${stamp()}`])).rejects.toThrow(/category_parts_name_unique|duplicate key/);
  }, 30000);
});
