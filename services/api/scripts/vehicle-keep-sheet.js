#!/usr/bin/env node
/**
 * Makes Vehicle Data hold ONLY the cars that are in your vehicle Excel sheet. Every brand, model, year and version that is not in the sheet is deleted,
 * together with everything that points at it.
 *
 *   node scripts/vehicle-keep-sheet.js "C:\path\to\Leap_All_Brands_Vehicles.xlsx"            PREVIEW: shows what would be deleted, changes NOTHING
 *   node scripts/vehicle-keep-sheet.js "C:\path\to\Leap_All_Brands_Vehicles.xlsx" --apply    deletes it (one transaction, after saving a backup file)
 *
 * Run it from the services/api folder, AFTER the sheet has been imported in Vehicle Data. It uses the backend's database settings (services/api/.env).
 *
 * A car is "in the sheet" exactly the way the importer matches it: same brand name, same model name, a single year (not a range of years), and a version with
 * the same name, engine and seats (English, ignoring capitals and extra spaces). The file is read directly from disk (the pictures inside it are never loaded),
 * so a file of any size works.
 *
 * Deleted with the cars:
 *   - products' fitment to those cars (the PRODUCTS themselves are kept: a product left with no car is listed so you can give it the right one);
 *     a fitment narrowed to some versions, all of which are deleted, is deleted too (otherwise it would suddenly fit every version of the year);
 *   - buyers' saved cars (My Garage) on a deleted year; a saved car whose VERSION is deleted keeps its year and asks the buyer for the version again;
 *   - quote requests on a deleted year, and discount rules on a deleted brand or model;
 *   - the old vehicle list (table "vehicles", from before Vehicle Data) and what points at it.
 * Orders are NOT touched: an order keeps its own copy of the car's names.
 * Brand logos and version photos of deleted entries stay on the server as files: remove them afterwards in Vehicle Data > "Check for unused pictures".
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const db = require('../db/pool');
const { cleanLine, nameKey, parseYear, parseSeats } = require('../src/modules/fitment/vehicleRules');

const HEADERS = { brand: 'Brand', model: 'Model', year: 'Year', version: 'Version', engine: 'Engine', seats: 'Seats' };
const MIN_MATCH = 0.5;      // below this share of the sheet's versions found in the database, --apply refuses (wrong file, or the sheet was not imported yet)

// ---------------------------------------------------------------- reading the .xlsx (a zip of XML files), with no extra library
function readZipIndex(fd, size) {
  const tailLen = Math.min(size, 65557 + 20);
  const tail = Buffer.alloc(tailLen);
  fs.readSync(fd, tail, 0, tailLen, size - tailLen);
  const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('This is not an Excel (.xlsx) file (it is not a zip package).');
  let count = tail.readUInt16LE(eocd + 10), cdSize = tail.readUInt32LE(eocd + 12), cdOffset = tail.readUInt32LE(eocd + 16);
  if (cdOffset === 0xffffffff || count === 0xffff) {                      // ZIP64
    const loc = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x06, 0x07]), eocd);
    if (loc < 0) throw new Error('This Excel file uses a zip format this tool cannot read.');
    const z64At = Number(tail.readBigUInt64LE(loc + 8));
    const z64 = Buffer.alloc(56); fs.readSync(fd, z64, 0, 56, z64At);
    count = Number(z64.readBigUInt64LE(32)); cdSize = Number(z64.readBigUInt64LE(40)); cdOffset = Number(z64.readBigUInt64LE(48));
  }
  const cd = Buffer.alloc(cdSize); fs.readSync(fd, cd, 0, cdSize, cdOffset);
  const entries = new Map();
  for (let p = 0, i = 0; i < count && p < cd.length; i++) {
    if (cd.readUInt32LE(p) !== 0x02014b50) break;
    const method = cd.readUInt16LE(p + 10);
    let csize = cd.readUInt32LE(p + 20), usize = cd.readUInt32LE(p + 24);
    const nlen = cd.readUInt16LE(p + 28), xlen = cd.readUInt16LE(p + 30), clen = cd.readUInt16LE(p + 32);
    let local = cd.readUInt32LE(p + 42);
    const name = cd.toString('utf8', p + 46, p + 46 + nlen).replace(/\\/g, '/');
    for (let x = p + 46 + nlen, end = x + xlen; x + 4 <= end;) {               // ZIP64 sizes / offset
      const id = cd.readUInt16LE(x), len = cd.readUInt16LE(x + 2);
      if (id === 1) { let q = x + 4; if (usize === 0xffffffff) { usize = Number(cd.readBigUInt64LE(q)); q += 8; } if (csize === 0xffffffff) { csize = Number(cd.readBigUInt64LE(q)); q += 8; } if (local === 0xffffffff) local = Number(cd.readBigUInt64LE(q)); }
      x += 4 + len;
    }
    entries.set(name.replace(/^\//, ''), { method, csize, local });
    p += 46 + nlen + xlen + clen;
  }
  return entries;
}
function readZipText(fd, entries, name) {
  const e = entries.get(name) || [...entries.entries()].find(([n]) => n.toLowerCase() === name.toLowerCase())?.[1];
  if (!e) return null;
  const head = Buffer.alloc(30); fs.readSync(fd, head, 0, 30, e.local);
  const start = e.local + 30 + head.readUInt16LE(26) + head.readUInt16LE(28);
  const data = Buffer.alloc(e.csize); fs.readSync(fd, data, 0, e.csize, start);
  const raw = e.method === 0 ? data : zlib.inflateRawSync(data);
  return raw.toString('utf8').replace(/^\uFEFF/, '');
}
const unescapeXml = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, c) => {
  const k = c.toLowerCase();
  if (k[0] === '#') return String.fromCodePoint(k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[k];
});
const textOf = (xml) => { let out = ''; const re = /<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>|<(?:\w+:)?t(?:\s[^>]*)?\/>/g; let m; while ((m = re.exec(xml))) out += m[1] ? unescapeXml(m[1]) : ''; return out; };
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? unescapeXml(m[1]) : null; };
const colNumber = (ref) => { let n = 0; for (const ch of ref.replace(/\d+$/, '').toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n; };

/** Every sheet of the workbook as { name, rows: Map(rowNumber -> Map(col -> value)) }, in workbook order. */
function readWorkbook(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const entries = readZipIndex(fd, fs.fstatSync(fd).size);
    const shared = [];
    const ss = readZipText(fd, entries, 'xl/sharedStrings.xml');
    if (ss) { const re = /<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>|<(?:\w+:)?si\s*\/>/g; let m; while ((m = re.exec(ss))) shared.push(m[1] ? textOf(m[1].replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, '')) : ''); }
    const wbXml = readZipText(fd, entries, 'xl/workbook.xml') || '';
    const relsXml = readZipText(fd, entries, 'xl/_rels/workbook.xml.rels') || '';
    const targets = new Map(); for (const t of relsXml.match(/<(?:\w+:)?Relationship\b[^>]*>/g) || []) targets.set(attr(t, 'Id'), attr(t, 'Target'));
    const sheets = [];
    for (const t of wbXml.match(/<(?:\w+:)?sheet\b[^>]*>/g) || []) {
      const rid = (t.match(/\s[\w]+:id="([^"]*)"/) || [])[1];
      let target = targets.get(rid); if (!target) continue;
      target = target.startsWith('/') ? target.slice(1) : path.posix.normalize(`xl/${target}`);
      const xml = readZipText(fd, entries, target); if (!xml) continue;
      const rows = new Map();
      const rowRe = /<(?:\w+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g; let rm, rowIndex = 0;
      while ((rm = rowRe.exec(xml))) {
        const r = Number(attr(rm[1], 'r')) || rowIndex + 1; rowIndex = r;
        const cells = new Map();
        const cellRe = /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g; let cm, colIndex = 0;
        while ((cm = cellRe.exec(rm[2] || ''))) {
          const ref = attr(cm[1], 'r'); const c = ref ? colNumber(ref) : colIndex + 1; colIndex = c;
          const type = attr(cm[1], 't'), body = cm[2] || '';
          const v = (body.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/) || [])[1];
          let value = '';
          if (type === 's') value = v != null ? (shared[Number(v)] ?? '') : '';
          else if (type === 'inlineStr') value = textOf(body);
          else if (v != null) value = unescapeXml(v);
          if (value !== '') cells.set(c, value);
        }
        if (cells.size) rows.set(r, cells);
      }
      sheets.push({ name: attr(t, 'name'), rows });
    }
    return sheets;
  } finally { fs.closeSync(fd); }
}

/** The sheet's cars: the distinct brand / model / year / version keys of every version row, keyed exactly like the importer does. */
function sheetCars(file) {
  const sheets = readWorkbook(file);
  for (const sheet of sheets) {
    const rowNums = [...sheet.rows.keys()].sort((a, b) => a - b);
    for (const hr of rowNums.slice(0, 10)) {
      const byHeader = new Map();
      for (const [c, v] of sheet.rows.get(hr)) { const k = cleanLine(v).toLowerCase(); if (k && !byHeader.has(k)) byHeader.set(k, c); }
      if (!byHeader.has('brand') || !byHeader.has('model')) continue;
      const col = {};
      for (const [key, h] of Object.entries(HEADERS)) { col[key] = byHeader.get(h.toLowerCase()); if (!col[key]) throw new Error(`The sheet "${sheet.name}" has no "${h}" column in its header row.`); }
      const versions = new Set(), brands = new Set(), models = new Set(), years = new Set();
      let rows = 0, notVersions = 0, unreadable = 0;
      for (const r of rowNums) {
        if (r <= hr) continue;
        const cells = sheet.rows.get(r); const get = (k) => cleanLine(cells.get(col[k]) ?? '');
        const d = { brand: get('brand'), model: get('model'), version: get('version'), engine: get('engine'), year: parseYear(get('year')), seats: parseSeats(get('seats')) };
        if (!d.brand && !d.model && !d.version && !d.engine && !get('seats') && !get('year')) continue;
        rows++;
        if (!d.version && !d.engine && !get('seats')) { notVersions++; continue; }
        if (!d.brand || !d.model || !d.year || !d.version || !d.engine || d.seats == null) { unreadable++; continue; }
        const b = nameKey(d.brand), m = `${b}|${nameKey(d.model)}`, y = `${m}|${d.year}`;
        brands.add(b); models.add(m); years.add(y); versions.add(`${y}|${nameKey(d.version)}|${nameKey(d.engine)}|${d.seats}`);
      }
      return { sheet: sheet.name, rows, notVersions, unreadable, brands, models, years, versions };
    }
  }
  throw new Error('No sheet in this file has a header row with "Brand" and "Model" (within its first 10 rows). Is this the vehicle data sheet?');
}

// ---------------------------------------------------------------- the database
const plural = (n, one, many) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
const ids = (rows) => rows.map((r) => r.id);
const closeDb = () => Promise.resolve().then(() => db.getPool().end()).catch(() => {});

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const force = args.includes('--force');
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) { console.log('Usage: node scripts/vehicle-keep-sheet.js "C:\\path\\to\\your-vehicle-sheet.xlsx" [--apply]'); process.exit(1); }
  if (!fs.existsSync(file)) { console.log(`File not found: ${file}`); process.exit(1); }

  console.log(`Reading ${path.basename(file)} (${(fs.statSync(file).size / 1048576).toFixed(1)} MB)...`);
  const sheet = sheetCars(file);
  console.log(`  sheet "${sheet.sheet}": ${plural(sheet.rows, 'row', 'rows')} -> ${plural(sheet.versions.size, 'version', 'versions')} of ${plural(sheet.models.size, 'model', 'models')} in ${plural(sheet.brands.size, 'brand', 'brands')}`
    + (sheet.notVersions ? `; ${plural(sheet.notVersions, 'row is not a version row', 'rows are not version rows')}` : '')
    + (sheet.unreadable ? `; ${plural(sheet.unreadable, 'row has', 'rows have')} a missing name, year or seats (not counted)` : ''));

  const q = (sql, params) => db.query(sql, params).then((r) => r.rows);
  const [brands, models, gens, versions] = await Promise.all([
    q('SELECT id, name FROM vehicle_brands'), q('SELECT id, brand_id, name FROM vehicle_models'),
    q('SELECT id, model_id, name, year_start, year_end FROM vehicle_generations'), q('SELECT id, generation_id, name, engine, seats FROM vehicle_versions'),
  ]);
  const brandKey = new Map(brands.map((b) => [b.id, nameKey(b.name)]));
  const modelKey = new Map(models.map((m) => [m.id, `${brandKey.get(m.brand_id)}|${nameKey(m.name)}`]));
  const genKey = new Map(gens.map((g) => [g.id, g.year_start != null && g.year_start === g.year_end ? `${modelKey.get(g.model_id)}|${g.year_start}` : null]));

  const keepVersions = new Set(versions.filter((v) => genKey.get(v.generation_id) && sheet.versions.has(`${genKey.get(v.generation_id)}|${nameKey(v.name)}|${nameKey(v.engine)}|${v.seats}`)).map((v) => v.id));
  const keepGens = new Set(versions.filter((v) => keepVersions.has(v.id)).map((v) => v.generation_id));
  const keepModels = new Set(gens.filter((g) => keepGens.has(g.id)).map((g) => g.model_id));
  const keepBrands = new Set(models.filter((m) => keepModels.has(m.id)).map((m) => m.brand_id));
  const del = {
    versions: versions.filter((v) => !keepVersions.has(v.id)), gens: gens.filter((g) => !keepGens.has(g.id)),
    models: models.filter((m) => !keepModels.has(m.id)), brands: brands.filter((b) => !keepBrands.has(b.id)),
  };
  const dv = ids(del.versions), dg = ids(del.gens), dm = ids(del.models), db_ = ids(del.brands);
  const matched = keepVersions.size, share = sheet.versions.size ? matched / sheet.versions.size : 0;

  // what points at them
  const fitment = await q(`
    SELECT e.id, e.product_id FROM product_fitment_entries e
    WHERE e.generation_id = ANY($1::text[])
       OR e.engine_id IN (SELECT id FROM vehicle_engines WHERE generation_id = ANY($1::text[]))
       OR e.transmission_id IN (SELECT id FROM vehicle_transmissions WHERE generation_id = ANY($1::text[]))
       OR (EXISTS (SELECT 1 FROM product_fitment_entry_versions x WHERE x.entry_id = e.id)
           AND NOT EXISTS (SELECT 1 FROM product_fitment_entry_versions x WHERE x.entry_id = e.id AND NOT (x.version_id = ANY($2::text[]))))`, [dg, dv]);
  const fitmentIds = fitment.map((f) => f.id);
  const narrowedLinks = (await q(`SELECT count(*)::int AS n FROM product_fitment_entry_versions WHERE version_id = ANY($1::text[]) AND NOT (entry_id = ANY($2::int[]))`, [dv, fitmentIds]))[0].n;
  const productsLeftBare = await q(`
    SELECT p.id, p.name FROM products p
    WHERE p.id = ANY($1::text[]) AND NOT EXISTS (SELECT 1 FROM product_fitment_entries e WHERE e.product_id = p.id AND NOT (e.id = ANY($2::int[])))
    ORDER BY p.name`, [[...new Set(fitment.map((f) => f.product_id))], fitmentIds]);
  const garageYears = (await q('SELECT count(*)::int AS n FROM user_saved_generations WHERE generation_id = ANY($1::text[])', [dg]))[0].n;
  const garageVersions = (await q('SELECT count(*)::int AS n FROM user_saved_generations WHERE version_id = ANY($1::text[]) AND NOT (generation_id = ANY($2::text[]))', [dv, dg]))[0].n;
  const quotes = (await q('SELECT count(*)::int AS n FROM quote_requests WHERE generation_id = ANY($1::text[])', [dg]))[0].n;
  const discounts = (await q('SELECT count(*)::int AS n FROM discount_rules WHERE brand_id = ANY($1::text[]) OR model_id = ANY($2::text[])', [db_, dm]))[0].n;
  const oldList = (await q('SELECT count(*)::int AS n FROM vehicles'))[0].n;
  const emptyModels = models.filter((m) => !gens.some((g) => g.model_id === m.id)).length;
  const modelsWithoutVersions = models.filter((m) => !versions.some((v) => gens.some((g) => g.id === v.generation_id && g.model_id === m.id))).length;

  console.log('');
  console.log(`Vehicle Data now: ${plural(brands.length, 'brand', 'brands')}, ${plural(models.length, 'model', 'models')} (${plural(modelsWithoutVersions, 'has', 'have')} no versions), ${plural(gens.length, 'year', 'years')}, ${plural(versions.length, 'version', 'versions')}.`);
  console.log(`Found in the sheet: ${plural(matched, 'version', 'versions')} of the sheet's ${sheet.versions.size.toLocaleString('en-US')} (${Math.round(share * 100)}%).`);
  console.log('');
  console.log('KEPT (in the sheet):');
  console.log(`  ${plural(keepBrands.size, 'brand', 'brands')}, ${plural(keepModels.size, 'model', 'models')}, ${plural(keepGens.size, 'year', 'years')}, ${plural(keepVersions.size, 'version', 'versions')}`);
  console.log('DELETED (not in the sheet):');
  console.log(`  ${plural(del.brands.length, 'brand', 'brands')}, ${plural(del.models.length, 'model', 'models')}, ${plural(del.gens.length, 'year', 'years')}, ${plural(del.versions.length, 'version', 'versions')}`);
  console.log(`  ${plural(fitment.length, 'product fitment', 'product fitments')} to those cars${narrowedLinks ? ` (and ${plural(narrowedLinks, 'deleted version is', 'deleted versions are')} taken out of narrowed fitments that keep other versions)` : ''}`);
  console.log(`  ${plural(garageYears, "buyer's saved car", "buyers' saved cars")} (My Garage)${garageVersions ? `; ${plural(garageVersions, 'more saved car keeps', 'more saved cars keep')} its year but loses its version (the buyer picks it again)` : ''}`);
  console.log(`  ${plural(quotes, 'quote request', 'quote requests')}, ${plural(discounts, 'discount rule', 'discount rules')}`);
  if (oldList) console.log(`  the old vehicle list (from before Vehicle Data): ${plural(oldList, 'entry', 'entries')}, with its product links and saved cars`);
  if (productsLeftBare.length) {
    console.log('');
    console.log(`${plural(productsLeftBare.length, 'product is', 'products are')} KEPT but left with no car (give them the right car afterwards):`);
    for (const p of productsLeftBare.slice(0, 30)) console.log(`  - ${p.name}  (${p.id})`);
    if (productsLeftBare.length > 30) console.log(`  ... and ${productsLeftBare.length - 30} more (all listed in the backup file)`);
  }
  const deletedNames = (rows, nameOf) => [...new Set(rows.map(nameOf))].sort();
  const brandName = new Map(brands.map((b) => [b.id, b.name])), modelName = new Map(models.map((m) => [m.id, `${brandName.get(m.brand_id)} ${m.name}`]));
  if (del.models.length) {
    const list = deletedNames(del.models, (m) => modelName.get(m.id));
    console.log('');
    console.log(`Models deleted (${list.length}): ${list.slice(0, 40).join(', ')}${list.length > 40 ? `, ... and ${list.length - 40} more` : ''}`);
  }
  if (emptyModels) { /* counted in "models deleted" above */ }

  if (!apply) {
    console.log('');
    console.log('PREVIEW ONLY: nothing was changed. To do it, run the same command with --apply at the end.');
    await closeDb(); return;
  }
  if (share < MIN_MATCH && !force) {
    console.log('');
    console.log(`STOPPED: only ${Math.round(share * 100)}% of the sheet's versions are in Vehicle Data. Import this sheet in Vehicle Data first (or check it is the right file).`);
    console.log('Nothing was changed. (If you are sure, add --force.)');
    process.exitCode = 2; await closeDb(); return;
  }
  if (!dv.length && !dg.length && !dm.length && !db_.length && !oldList) { console.log('\nNothing to delete: Vehicle Data already holds only the sheet.'); await closeDb(); return; }

  // backup of everything that is deleted
  const dump = async (sql, params) => q(sql, params);
  const backup = {
    madeAt: new Date().toISOString(), file: path.basename(file),
    vehicle_brands: await dump('SELECT * FROM vehicle_brands WHERE id = ANY($1::text[])', [db_]),
    vehicle_models: await dump('SELECT * FROM vehicle_models WHERE id = ANY($1::text[])', [dm]),
    vehicle_generations: await dump('SELECT * FROM vehicle_generations WHERE id = ANY($1::text[])', [dg]),
    vehicle_versions: await dump('SELECT * FROM vehicle_versions WHERE id = ANY($1::text[])', [dv]),
    vehicle_engines: await dump('SELECT * FROM vehicle_engines WHERE generation_id = ANY($1::text[])', [dg]),
    vehicle_transmissions: await dump('SELECT * FROM vehicle_transmissions WHERE generation_id = ANY($1::text[])', [dg]),
    product_fitment_entries: await dump('SELECT * FROM product_fitment_entries WHERE id = ANY($1::int[])', [fitmentIds]),
    product_fitment_entry_versions: await dump('SELECT * FROM product_fitment_entry_versions WHERE entry_id = ANY($1::int[]) OR version_id = ANY($2::text[])', [fitmentIds, dv]),
    user_saved_generations: await dump('SELECT * FROM user_saved_generations WHERE generation_id = ANY($1::text[]) OR version_id = ANY($2::text[])', [dg, dv]),
    quote_requests: await dump('SELECT * FROM quote_requests WHERE generation_id = ANY($1::text[])', [dg]),
    quote_request_items: await dump('SELECT i.* FROM quote_request_items i JOIN quote_requests r ON r.id = i.request_id WHERE r.generation_id = ANY($1::text[])', [dg]),
    discount_rules: await dump('SELECT * FROM discount_rules WHERE brand_id = ANY($1::text[]) OR model_id = ANY($2::text[])', [db_, dm]),
    vehicles: await dump('SELECT * FROM vehicles'),
    product_fitment: await dump('SELECT * FROM product_fitment'),
    user_saved_vehicles: await dump('SELECT * FROM user_saved_vehicles'),
    productsLeftWithNoCar: productsLeftBare,
  };
  const dir = path.join(__dirname, '..', 'backups'); fs.mkdirSync(dir, { recursive: true });
  const backupFile = path.join(dir, `vehicle-keep-sheet-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 1));
  console.log('');
  console.log(`Backup of everything deleted: ${backupFile}`);

  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    const run = (sql, params) => client.query(sql, params);
    await run('DELETE FROM product_fitment_entries WHERE id = ANY($1::int[])', [fitmentIds]);
    await run('DELETE FROM quote_requests WHERE generation_id = ANY($1::text[])', [dg]);
    await run('DELETE FROM discount_rules WHERE brand_id = ANY($1::text[]) OR model_id = ANY($2::text[])', [db_, dm]);
    await run('DELETE FROM user_saved_generations WHERE generation_id = ANY($1::text[])', [dg]);
    await run('UPDATE user_saved_generations SET version_id = NULL WHERE version_id = ANY($1::text[])', [dv]);
    await run('DELETE FROM product_fitment_entry_versions WHERE version_id = ANY($1::text[])', [dv]);
    await run('DELETE FROM vehicle_versions WHERE id = ANY($1::text[])', [dv]);
    await run('DELETE FROM vehicle_generations WHERE id = ANY($1::text[])', [dg]);            // its engines and transmissions go with it
    await run('DELETE FROM vehicle_models WHERE id = ANY($1::text[])', [dm]);
    await run('DELETE FROM vehicle_brands WHERE id = ANY($1::text[])', [db_]);
    await run('DELETE FROM vehicles');                                                           // the old list: its product links and saved cars go with it
    await run('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally { client.release(); }

  const left = (await q(`SELECT (SELECT count(*) FROM vehicle_brands)::int AS b, (SELECT count(*) FROM vehicle_models)::int AS m, (SELECT count(*) FROM vehicle_generations)::int AS g, (SELECT count(*) FROM vehicle_versions)::int AS v,
    (SELECT count(*) FROM vehicle_models m WHERE NOT EXISTS (SELECT 1 FROM vehicle_generations g JOIN vehicle_versions v ON v.generation_id = g.id WHERE g.model_id = m.id))::int AS empty`))[0];
  console.log('');
  console.log(`DONE. Vehicle Data now: ${plural(left.b, 'brand', 'brands')}, ${plural(left.m, 'model', 'models')}, ${plural(left.g, 'year', 'years')}, ${plural(left.v, 'version', 'versions')}; models without versions: ${left.empty}.`);
  console.log('Next: in Vehicle Data, use "Check for unused pictures" to delete the pictures of the deleted entries from the server.');
  await closeDb();
}

if (require.main === module) {
  main().catch(async (err) => { console.error(`\nFAILED, nothing was changed: ${err.message}`); process.exitCode = 1; try { await closeDb(); } catch {} });
}
module.exports = { readWorkbook, sheetCars };
