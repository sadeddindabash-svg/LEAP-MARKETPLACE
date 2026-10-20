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
    expect(bad.status).toBe(400); expect(bad.body.error).toMatch(/not a valid \.xlsx/);
    const none = await send(admin, 'preview', null);
    expect(none.status).toBe(400); expect(none.body.error).toMatch(/No file was sent/);
  });

  it('CRITICAL: a brand that does not exist stops the import (every row of it), names the brand, and creates nothing', async () => {
    const { name, r } = await newBrand();
    const ghost = { brand: 'NoSuchBrand', brandAr: 'لا', brandZh: '无' };
    const file = await makeSheet([r(), r({ ...ghost, version: 'G' })]);
    const preview = await send(admin, 'preview', file);
    expect(preview.body.blocking).toBe(true); expect(preview.body.ready).toBe(false);
    expect(preview.body.summary.missingBrands).toEqual(['NoSuchBrand']);
    expect(preview.body.rows.map((x) => x.status)).toEqual(['new', 'error']);
    expect(preview.body.rows[1].messages.map((m) => m.text).join(' ')).toMatch(/Brand "NoSuchBrand" does not exist yet.*Add it first in Vehicle Data/);
    const commit = await send(admin, 'commit', file);
    expect(commit.status).toBe(400);
    expect(commit.body.error).toMatch(/nothing was imported/);
    expect(name).toBeTruthy();
  });

  it('CRITICAL: the preview writes NOTHING, and says what will happen: new models, years and versions, pictures, and the rows without a picture', async () => {
    const { brand, r } = await newBrand();
    const file = await makeSheet([r({ picture: [400, 400] }), r({ version: 'B' }), r({ year: 2023, picture: [400, 400] }), r({ model: 'M2', modelAr: 'إم2', modelZh: '车型二', version: 'C' })]);
    const preview = await send(admin, 'preview', file);
    expect(preview.status).toBe(200);
    expect(preview.body.summary).toMatchObject({ rows: 4, rowsWithErrors: 0, picturesFound: 2, newModels: 2, newYears: 3, newVersions: 4, existingVersions: 0, newWithoutPicture: 2, rowsWithWarnings: 2 });
    expect(preview.body.ready).toBe(true);
    expect(preview.body.rows.map((x) => x.status)).toEqual(['new', 'new', 'new', 'new']);
    expect(preview.body.rows[0].picture).toEqual({ width: 400, height: 400 });
    expect(await versionsOf(brand.id)).toEqual([]);                                // nothing was written
    expect(await (await json(null, 'GET', `/fitment/brands/${brand.id}/models`)).json()).toEqual([]);
  });

  it('CRITICAL: the import creates the models, years (without photo) and versions with all their names, seats, and the pictures (kept as files); rows without a picture have none; it is recorded in the audit log', async () => {
    const { brand, r } = await newBrand();
    const file = await makeSheet([r({ picture: [400, 400] }), r({ version: 'B', versionAr: 'ب', versionZh: '乙', engine: 'Engine B', seats: 6 }), r({ year: 2023, version: 'C', picture: [450, 450] })]);
    const done = await send(admin, 'commit', file, 'skip', 'My Vehicles.xlsx');
    expect(done.status).toBe(201); expect(done.body.imported).toBe(true);
    expect(done.body.summary).toMatchObject({ newModels: 1, newYears: 2, newVersions: 3, picturesFound: 2, newWithoutPicture: 1 });
    const all = await versionsOf(brand.id);
    expect(all).toHaveLength(3);
    expect(all.map((x) => x.year.name).sort()).toEqual(['2022', '2022', '2023']);
    expect(all.every((x) => x.year.photoUrl === null)).toBe(true);                   // years created by the import have no photo
    expect(all[0].model).toMatchObject({ name: 'M1', nameAr: 'إم1', nameZh: '车型一' });
    const a = all.find((x) => x.version.name === 'AWD Flagship').version, b = all.find((x) => x.version.name === 'B').version;
    expect(a).toMatchObject({ nameAr: 'دفع كلي فلاجشيب', nameZh: '全轮驱动 旗舰版', engineZh: '1.5升 增程器', seats: 5 });
    expect(b).toMatchObject({ nameAr: 'ب', nameZh: '乙', engine: 'Engine B', seats: 6, photoUrl: null });
    expect(a.photoUrl).toMatch(/^\/uploads\/[0-9a-f]{32}\.png$/);
    const served = await fetch(`${BACKEND_URL}${a.photoUrl}`);
    expect(served.status).toBe(200); expect(served.headers.get('content-type')).toMatch(/image\/png/);
    const log = await (await json(admin, 'GET', '/admin/audit-log?action=vehicle_import')).json();
    const entries = Array.isArray(log) ? log : (log.entries || log.items || log.rows || log.log || []);
    expect(JSON.stringify(entries[0])).toMatch(/My Vehicles\.xlsx/);
    expect(entries[0].action).toBe('vehicle_import');
  });

  it('CRITICAL: importing the same file again adds nothing (every row "already exists") and is refused as nothing to import; a changed file is SKIPPED by default', async () => {
    const { brand, r } = await newBrand();
    const file = await makeSheet([r({ picture: [400, 400] }), r({ version: 'B' })]);
    expect((await send(admin, 'commit', file)).status).toBe(201);
    const before = JSON.stringify(await versionsOf(brand.id));
    const again = await send(admin, 'commit', file);
    expect(again.status).toBe(400); expect(again.body.error).toMatch(/nothing to import/);
    expect(again.body.summary).toMatchObject({ existingVersions: 2, newVersions: 0 });
    const changed = await makeSheet([r({ versionZh: '改了', seats: 7, picture: [600, 600] }), r({ version: 'B' })]);
    const preview = await send(admin, 'preview', changed);
    expect(preview.body.rows.map((x) => x.status)).toEqual(['exists', 'exists']);
    expect((await send(admin, 'commit', changed)).status).toBe(400);
    expect(JSON.stringify(await versionsOf(brand.id))).toBe(before);                 // nothing changed
  });

  it('CRITICAL: "update existing" changes the versions whose text, seats or picture differ, replaces the picture, and leaves the others alone', async () => {
    const { brand, r } = await newBrand();
    expect((await send(admin, 'commit', await makeSheet([r({ picture: [400, 400] }), r({ version: 'B' })]))).status).toBe(201);
    const first = (await versionsOf(brand.id)).find((x) => x.version.name === 'AWD Flagship').version;
    const changed = await makeSheet([r({ versionZh: '改了', seats: 7, picture: [600, 600] }), r({ version: 'B' }), r({ version: 'C' })]);
    const preview = await send(admin, 'preview', changed, 'update');
    expect(preview.body.rows.map((x) => x.status)).toEqual(['update', 'exists', 'new']);
    expect(preview.body.summary).toMatchObject({ updatedVersions: 1, existingVersions: 1, newVersions: 1 });
    const done = await send(admin, 'commit', changed, 'update');
    expect(done.status).toBe(201);
    const all = await versionsOf(brand.id);
    const updated = all.find((x) => x.version.name === 'AWD Flagship').version;
    expect(updated).toMatchObject({ id: first.id, nameZh: '改了', seats: 7 });
    expect(updated.photoUrl).not.toBe(first.photoUrl);                             // the picture was replaced
    expect(all.find((x) => x.version.name === 'B').version.nameZh).toBe('全轮驱动 旗舰版');
    expect(all.map((x) => x.version.name).sort()).toEqual(['AWD Flagship', 'B', 'C']);
  });

  it('a new version is added to a model and a year that already exist (made by hand): the model and year are reused, not duplicated', async () => {
    const { brand, r } = await newBrand();
    const model = await (await json(admin, 'POST', `/fitment/brands/${brand.id}/models`, { name: 'M1', nameAr: 'إم1', nameZh: '车型一' })).json();
    const gen = await (await json(admin, 'POST', `/fitment/models/${model.id}/generations`, { year: 2022, photoUrl: '/uploads/y.png' })).json();
    const done = await send(admin, 'commit', await makeSheet([r({ version: 'Late' })]));
    expect(done.status).toBe(201);
    expect(done.body.summary).toMatchObject({ newModels: 0, newYears: 0, newVersions: 1 });
    expect(await (await json(null, 'GET', `/fitment/brands/${brand.id}/models`)).json()).toHaveLength(1);
    const years = await (await json(null, 'GET', `/fitment/models/${model.id}/generations`)).json();
    expect(years).toHaveLength(1); expect(years[0].photoUrl).toBe('/uploads/y.png');   // its own photo untouched
    expect((await (await json(null, 'GET', `/fitment/generations/${gen.id}/versions`)).json()).map((v) => v.name)).toEqual(['Late']);
  });

  it('CRITICAL: all or nothing: a file with one bad row imports NOTHING (the good rows before it are not saved, no picture file is left behind)', async () => {
    const { brand, r } = await newBrand();
    const filesBefore = fs.readdirSync(UPLOADS).length;
    const withBadYear = await makeSheet([r({ picture: [400, 400] }), r({ version: 'B', picture: [400, 400] }), r({ version: 'C', yearAr: 2030 })]);
    const a = await send(admin, 'commit', withBadYear);
    expect(a.status).toBe(400); expect(a.body.summary.rowsWithErrors).toBe(1);
    const withGhostBrand = await makeSheet([r({ picture: [400, 400] }), r({ version: 'B', picture: [400, 400] }), r({ brand: 'GhostBrand', brandAr: 'ش', brandZh: '鬼', version: 'C', picture: [400, 400] })]);
    const b = await send(admin, 'commit', withGhostBrand);                         // the ghost brand is only found while importing, after pictures were already kept
    expect(b.status).toBe(400); expect(b.body.summary.missingBrands).toEqual(['GhostBrand']);
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
