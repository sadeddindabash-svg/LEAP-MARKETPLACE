// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { makeSheet, row, HEADERS } from './testSheets.js';

const BACKEND_URL = 'http://localhost:4000';
async function isBackendUp() { try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; } }
const backendUp = await isBackendUp();
const UPLOADS = fileURLToPath(new URL('../../../services/api/uploads/', import.meta.url));

const login = async (email, password) => (await (await fetch(`${BACKEND_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const json = (token, method, p, body) => fetch(`${BACKEND_URL}${p}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
async function send(token, p, buffer, mode, name = 'vehicles.xlsx') {
  const form = new FormData();
  if (buffer) form.append('file', new Blob([buffer]), name);
  if (mode) form.append('mode', mode);
  const res = await fetch(`${BACKEND_URL}/fitment/import/${p}`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form });
  return { status: res.status, body: await res.json() };
}

describe.runIf(backendUp)('Excel import of vehicle data, against a REAL running backend', () => {
  let admin, supplier, buyer; const brands = []; const stamp = Date.now(); let counter = 0;
  beforeAll(async () => {
    admin = await login('admin@leap.dev', 'admin_dev_password_123');
    supplier = await login('supplier@leap.dev', 'supplier_dev_password_123');
    buyer = (await (await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `import-test-${stamp}@leap.dev`, password: 'import_test_pw_123' }) })).json()).token;
  });
  afterAll(async () => {
    for (const id of brands) {
      const models = await (await json(null, 'GET', `/fitment/brands/${id}/models`)).json();
      for (const m of models) for (const y of await (await json(null, 'GET', `/fitment/models/${m.id}/generations`)).json()) for (const v of await (await json(null, 'GET', `/fitment/generations/${y.id}/versions`)).json()) {
        if (v.photoUrl && v.photoUrl.startsWith('/uploads/')) fs.rmSync(path.join(UPLOADS, path.basename(v.photoUrl)), { force: true });
      }
      await json(admin, 'DELETE', `/fitment/brands/${id}`);
    }
  });

  // a fresh brand (created the way the admin creates it: by hand, with its photo and three names) and the rows that belong to it
  async function newBrand() {
    const n = ++counter; const name = `ImpBrand${stamp}x${n}`;
    const brand = await (await json(admin, 'POST', '/fitment/brands', { name, nameAr: `ماركة ${n}`, nameZh: `品牌${n}`, photoUrl: '/uploads/brand.png' })).json();
    brands.push(brand.id);
    const r = (over = {}) => row({ brand: name, brandAr: `ماركة ${n}`, brandZh: `品牌${n}`, model: 'M1', modelAr: 'إم1', modelZh: '车型一', ...over });
    return { brand, name, r };
  }
  const versionsOf = async (brandId) => {
    const out = [];
    for (const m of await (await json(null, 'GET', `/fitment/brands/${brandId}/models`)).json())
      for (const y of await (await json(null, 'GET', `/fitment/models/${m.id}/generations`)).json())
        for (const v of await (await json(null, 'GET', `/fitment/generations/${y.id}/versions`)).json()) out.push({ model: m, year: y, version: v });
    return out;
  };

  it('CRITICAL: only an admin can use it: nobody signed in, a supplier and a buyer are refused (preview, import and template)', async () => {
    const file = await makeSheet([row()]);
    for (const token of [null, supplier, buyer]) {
      for (const p of ['preview', 'commit']) expect([401, 403], `${p} ${token ? 'user' : 'anon'}`).toContain((await send(token, p, file)).status);
      expect([401, 403]).toContain((await fetch(`${BACKEND_URL}/fitment/import/template`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })).status);
    }
  });

  it('the template is a real .xlsx with the 19 headers in the same order as the AITO sheet, and a Read me sheet', async () => {
    const res = await fetch(`${BACKEND_URL}/fitment/import/template`, { headers: { Authorization: `Bearer ${admin}` } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toMatch(/Leap_Vehicle_Import_Template\.xlsx/);
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(await res.arrayBuffer()));
    expect(wb.worksheets.map((s) => s.name)).toEqual(['Vehicles', 'Read me']);
    expect(wb.worksheets[0].getRow(1).values.slice(1)).toEqual(HEADERS);
    expect(wb.worksheets[0].rowCount).toBe(1);
    const guide = []; wb.worksheets[1].eachRow((r) => guide.push(String(r.getCell(1).value)));
    expect(guide.join('\n')).toMatch(/must already exist in Vehicle Data/);
    const preview = await send(admin, 'preview', Buffer.from(await (await fetch(`${BACKEND_URL}/fitment/import/template`, { headers: { Authorization: `Bearer ${admin}` } })).arrayBuffer()));
    expect(preview.status).toBe(200); expect(preview.body.nothingToImport).toBe(true);
  });

  it('a file that is not Excel, and no file at all, are refused in plain words', async () => {
    const bad = await send(admin, 'preview', Buffer.from('not a spreadsheet'));
    expect(bad.status).toBe(400); expect(bad.body.error).toMatch(/could not be read as an Excel \(\.xlsx\) file/);
    const none = await send(admin, 'preview', null);
    expect(none.status).toBe(400); expect(none.body.error).toMatch(/No file was sent/);
  });

  it('CRITICAL: a brand that does not exist is CREATED from the file ("No logo yet" when the file has no logo); an existing brand gets its Arabic and Chinese names from the file', async () => {
    const { brand, r } = await newBrand();
    const fresh = `NewImpBrand${stamp}`;
    const file = await makeSheet([r({ brandAr: 'ماركة محدثة', brandZh: '新品牌名' }), r({ brand: fresh, brandAr: 'جديدة', brandZh: '新', version: 'G' })]);
    const preview = await send(admin, 'preview', file);
    expect(preview.body.blocking).toBe(false);
    expect(preview.body.summary).toMatchObject({ newBrands: 1, newBrandsWithoutLogo: 1, brandNamesUpdated: 1, missingBrands: [] });
    const commit = await send(admin, 'commit', file);
    expect(commit.status).toBe(201);
    const all = await (await json(null, 'GET', '/fitment/brands')).json();
    const created = all.find((b) => b.name === fresh);
    brands.push(created.id);                                                       // cleaned up with the others
    expect(created).toMatchObject({ nameAr: 'جديدة', nameZh: '新', photoUrl: null });
    expect(all.find((b) => b.id === brand.id)).toMatchObject({ nameAr: 'ماركة محدثة', nameZh: '新品牌名' });
  });

  it('CRITICAL: all or nothing: a file with one bad row imports NOTHING (the good rows before it are not saved, no picture file is left behind)', async () => {
    const { brand, r } = await newBrand();
    const filesBefore = fs.readdirSync(UPLOADS).length;
    const withBadYear = await makeSheet([r({ picture: [400, 400] }), r({ version: 'B', picture: [400, 400] }), r({ version: 'C', yearAr: 2030 })]);
    const a = await send(admin, 'commit', withBadYear);
    expect(a.status).toBe(400); expect(a.body.summary.rowsWithErrors).toBe(1);
    expect(await versionsOf(brand.id)).toEqual([]);
    expect(await (await json(null, 'GET', `/fitment/brands/${brand.id}/models`)).json()).toEqual([]);
    expect(fs.readdirSync(UPLOADS).length).toBe(filesBefore);                      // and no stray picture files
    const tooSmall = await send(admin, 'commit', await makeSheet([r(), r({ version: 'B', picture: [399, 399] })]));
    expect(tooSmall.status).toBe(400);
    expect(tooSmall.body.rows[1].messages.map((m) => m.text).join(' ')).toMatch(/at least 400px/);
    expect(await versionsOf(brand.id)).toEqual([]);
  });

  it('CRITICAL: two imports of the same new file at the same moment create the versions ONCE (one succeeds, the other finds nothing to import)', async () => {
    const { brand, r } = await newBrand();
    const file = await makeSheet([r({ picture: [400, 400] }), r({ version: 'B' }), r({ version: 'C', year: 2023 })]);
    const results = await Promise.all([send(admin, 'commit', file), send(admin, 'commit', file), send(admin, 'commit', file)]);
    expect(results.map((x) => x.status).sort()).toEqual([201, 400, 400]);
    expect(await versionsOf(brand.id)).toHaveLength(3);
    expect(await (await json(null, 'GET', `/fitment/brands/${brand.id}/models`)).json()).toHaveLength(1);
  });

  const ARC = process.env.LEAP_ARCFOX_XLSX;
  it.runIf(!!ARC && fs.existsSync(ARC || ''))('YOUR REAL ARCFOX SHEET (written in the other XML style that used to be refused): 150 rows, 105 pictures, 45 without, 12 models, 26 years: imported once, a second time adds nothing', async () => {
    const file = fs.readFileSync(ARC);
    const existing = (await (await json(null, 'GET', '/fitment/brands')).json()).find((b) => b.name === 'ARCFOX');
    if (existing) await json(admin, 'DELETE', `/fitment/brands/${existing.id}`);
    const brand = await (await json(admin, 'POST', '/fitment/brands', { name: 'ARCFOX', nameAr: 'أركفوكس', nameZh: '极狐', photoUrl: '/uploads/brand.png' })).json(); brands.push(brand.id);
    const preview = await send(admin, 'preview', file);
    expect(preview.status).toBe(200);
    expect(preview.body.summary).toMatchObject({ rows: 150, rowsWithErrors: 0, picturesFound: 105, newModels: 12, newYears: 26, newVersions: 150, newWithoutPicture: 45 });
    expect((await send(admin, 'commit', file)).status).toBe(201);
    const all = await versionsOf(brand.id);
    expect(all).toHaveLength(150); expect(all.filter((x) => !x.version.photoUrl)).toHaveLength(45);
    expect((await send(admin, 'commit', file)).status).toBe(400);
    expect(await versionsOf(brand.id)).toHaveLength(150);
  }, 120000);

  const REAL = process.env.LEAP_AITO_XLSX;
  it.runIf(!!REAL && fs.existsSync(REAL || ''))('YOUR REAL AITO SHEET: 135 rows, 112 pictures matched to their rows, 23 rows without a picture, 5 models, 12 years: imported once, and a second time adds nothing', async () => {
    const file = fs.readFileSync(REAL);
    const existing = (await (await json(null, 'GET', '/fitment/brands')).json()).find((b) => b.name === 'AITO');
    if (existing) await json(admin, 'DELETE', `/fitment/brands/${existing.id}`);
    const brand = await (await json(admin, 'POST', '/fitment/brands', { name: 'AITO', nameAr: 'أيتو / وينجيه', nameZh: '问界', photoUrl: '/uploads/brand.png' })).json(); brands.push(brand.id);
    const preview = await send(admin, 'preview', file);
    expect(preview.body.summary).toMatchObject({ rows: 135, rowsWithErrors: 0, picturesFound: 112, newModels: 5, newYears: 12, newVersions: 135, newWithoutPicture: 23 });
    expect(preview.body.ready).toBe(true);
    const done = await send(admin, 'commit', file);
    expect(done.status).toBe(201);
    const all = await versionsOf(brand.id);
    expect(all).toHaveLength(135); expect(all.filter((x) => !x.version.photoUrl)).toHaveLength(23);
    expect((await send(admin, 'commit', file)).status).toBe(400);
    expect(await versionsOf(brand.id)).toHaveLength(135);
  }, 120000);
});
