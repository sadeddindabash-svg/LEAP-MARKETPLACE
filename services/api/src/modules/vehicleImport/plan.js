// What to do with every row, decided against the database. ONE function serves both the preview (apply = false: reads only, nothing is written) and the real import
// (apply = true, inside one transaction), so the preview can never promise something the import then does differently.
//
//   brand    must EXIST already (brands need a photo, added by hand in Vehicle Data); a row whose brand does not exist is an error.
//   model    created if missing (English, Arabic and Chinese names).
//   year     created if missing, with NO photo (the sheet carries one picture per version, not per year).
//   version  created if missing (with its picture when the row has one, else "No photo yet"); if it already exists it is SKIPPED, or (mode "update") brought up to date.
//            A version is "the same" when the year, the version name and the engine (English, ignoring capitals and extra spaces) are the same.
const crypto = require('crypto');
const { nameKey } = require('../fitment/vehicleRules');

const newId = (prefix) => `${prefix}_${Date.now()}${crypto.randomBytes(3).toString('hex')}`;
const same = (a, b) => nameKey(a) === nameKey(b);

async function runImport(q, items, mode, { apply = false, saveImage = null, savedUrls = [] } = {}) {
  const counts = { newModels: 0, newYears: 0, newVersions: 0, existingVersions: 0, updatedVersions: 0, picturesToSave: 0, newWithoutPicture: 0, brandNamesUpdated: 0, modelNamesUpdated: 0 };
  const notes = [];
  const missingBrands = new Set();
  const rows = [];
  const brands = new Map(), models = new Map(), years = new Map(), versionsOf = new Map(), orders = new Map(), noted = new Set();

  const nextOrder = async (key, load) => {
    if (!orders.has(key)) orders.set(key, await load());
    const value = orders.get(key) + 10;
    orders.set(key, value);
    return value;
  };
  const note = (key, text) => { if (!noted.has(key)) { noted.add(key); notes.push(text); } };

  for (const item of items) {
    const d = item.data;
    const messages = [...item.messages];
    const summary = { rowNumber: item.rowNumber, brand: d.brand.en, model: d.model.en, year: d.year, version: d.version.en, seats: d.seats, picture: d.picture ? { width: d.picture.width, height: d.picture.height } : null };
    if (!item.ok) { rows.push({ ...summary, status: 'error', messages }); continue; }

    // ---- brand: must exist
    const bkey = nameKey(d.brand.en);
    if (!brands.has(bkey)) {
      const { rows: found } = await q.query('SELECT * FROM vehicle_brands WHERE lower(btrim(name)) = $1', [bkey]);
      brands.set(bkey, found[0] || null);
    }
    const brand = brands.get(bkey);
    if (!brand) {
      missingBrands.add(d.brand.en);
      messages.push({ level: 'error', text: `Brand "${d.brand.en}" does not exist yet. Add it first in Vehicle Data (Brands tab, with its photo), then check the file again.` });
      rows.push({ ...summary, status: 'error', messages });
      continue;
    }
    if (!noted.has(`brand:${brand.id}`)) {
      noted.add(`brand:${brand.id}`);
      const differs = !same(brand.name_ar || '', d.brand.ar) || !same(brand.name_zh || '', d.brand.zh);
      if (differs && mode === 'update') {
        counts.brandNamesUpdated++;
        brand.name_ar = d.brand.ar; brand.name_zh = d.brand.zh;
        if (apply) await q.query('UPDATE vehicle_brands SET name_ar = $1, name_zh = $2 WHERE id = $3', [d.brand.ar, d.brand.zh, brand.id]);
        notes.push(`Brand "${brand.name}": its Arabic and Chinese names will be updated from the file.`);
      } else if (differs) {
        notes.push(`Brand "${brand.name}" already exists and its saved Arabic/Chinese name is not the file's: it was left as it is (choose "Update existing" to change it).`);
      }
    }

    // ---- model: create if missing
    const mkey = `${brand.id}|${nameKey(d.model.en)}`;
    if (!models.has(mkey)) {
      const { rows: found } = await q.query('SELECT * FROM vehicle_models WHERE brand_id = $1 AND lower(btrim(name)) = $2', [brand.id, nameKey(d.model.en)]);
      if (found[0]) models.set(mkey, { id: found[0].id, isNew: false, row: found[0] });
      else {
        const ord = await nextOrder(`models:${brand.id}`, async () => (await q.query('SELECT COALESCE(MAX(sort_order), 0) AS m FROM vehicle_models WHERE brand_id = $1', [brand.id])).rows[0].m);
        const entry = { id: apply ? newId('model') : `new:${mkey}`, isNew: true };
        if (apply) await q.query('INSERT INTO vehicle_models (id, brand_id, name, name_ar, name_zh, photo_url, sort_order) VALUES ($1, $2, $3, $4, $5, NULL, $6)', [entry.id, brand.id, d.model.en, d.model.ar, d.model.zh, ord]);
        counts.newModels++;
        models.set(mkey, entry);
      }
    }
    const model = models.get(mkey);
    if (!model.isNew && !noted.has(`model:${model.id}`)) {
      noted.add(`model:${model.id}`);
      const differs = !same(model.row.name_ar || '', d.model.ar) || !same(model.row.name_zh || '', d.model.zh);
      if (differs && mode === 'update') {
        counts.modelNamesUpdated++;
        if (apply) await q.query('UPDATE vehicle_models SET name_ar = $1, name_zh = $2 WHERE id = $3', [d.model.ar, d.model.zh, model.id]);
        notes.push(`Model "${model.row.name}": its Arabic and Chinese names will be updated from the file.`);
      } else if (differs) {
        notes.push(`Model "${model.row.name}" already exists and its saved Arabic/Chinese name is not the file's: it was left as it is (choose "Update existing" to change it).`);
      }
    }

    // ---- year: create if missing, without a photo
    const ykey = `${model.id}|${d.year}`;
    if (!years.has(ykey)) {
      let found = null;
      if (!model.isNew) found = (await q.query('SELECT * FROM vehicle_generations WHERE model_id = $1 AND year_start = $2 AND year_end = $2', [model.id, d.year])).rows[0] || null;
      if (found) years.set(ykey, { id: found.id, isNew: false });
      else {
        const ord = await nextOrder(`years:${model.id}`, async () => (model.isNew ? 0 : (await q.query('SELECT COALESCE(MAX(sort_order), 0) AS m FROM vehicle_generations WHERE model_id = $1', [model.id])).rows[0].m));
        const entry = { id: apply ? newId('gen') : `new:${ykey}`, isNew: true };
        if (apply) await q.query('INSERT INTO vehicle_generations (id, model_id, name, year_start, year_end, sort_order, photo_url) VALUES ($1, $2, $3, $4, $4, $5, NULL)', [entry.id, model.id, String(d.year), d.year, ord]);
        counts.newYears++;
        years.set(ykey, entry);
      }
    }
    const year = years.get(ykey);

    // ---- version: create, skip or update
    let existing = null;
    if (!year.isNew) {
      if (!versionsOf.has(year.id)) {
        const { rows: found } = await q.query('SELECT * FROM vehicle_versions WHERE generation_id = $1', [year.id]);
        versionsOf.set(year.id, new Map(found.map((r) => [`${nameKey(r.name)}|${nameKey(r.engine)}`, r])));
      }
      existing = versionsOf.get(year.id).get(`${nameKey(d.version.en)}|${nameKey(d.engine.en)}`) || null;
    }
    if (existing) {
      const changed = existing.name !== d.version.en || existing.name_ar !== d.version.ar || existing.name_zh !== d.version.zh
        || existing.engine !== d.engine.en || existing.engine_ar !== d.engine.ar || existing.engine_zh !== d.engine.zh || existing.seats !== d.seats;
      if (mode === 'update' && (changed || d.picture)) {
        let photoUrl = existing.photo_url;
        if (d.picture) { counts.picturesToSave++; if (apply) { const saved = await saveImage(d.picture.buffer, d.picture.mime); photoUrl = saved.url; savedUrls.push(photoUrl); } }
        if (apply) await q.query('UPDATE vehicle_versions SET name = $1, name_ar = $2, name_zh = $3, engine = $4, engine_ar = $5, engine_zh = $6, seats = $7, photo_url = $8 WHERE id = $9',
          [d.version.en, d.version.ar, d.version.zh, d.engine.en, d.engine.ar, d.engine.zh, d.seats, photoUrl, existing.id]);
        counts.updatedVersions++;
        messages.push({ level: 'info', text: d.picture ? 'Already exists: will be updated (and its picture replaced)' : 'Already exists: will be updated' });
        rows.push({ ...summary, status: 'update', messages });
      } else {
        counts.existingVersions++;
        messages.push({ level: 'info', text: mode === 'update' ? 'Already exists and nothing changed' : 'Already exists: skipped' });
        rows.push({ ...summary, status: 'exists', messages: messages.filter((m) => m.level !== 'warning') });
      }
      continue;
    }
    const ord = await nextOrder(`versions:${year.id}`, async () => (year.isNew ? 0 : (await q.query('SELECT COALESCE(MAX(sort_order), 0) AS m FROM vehicle_versions WHERE generation_id = $1', [year.id])).rows[0].m));
    let photoUrl = null;
    if (d.picture) { counts.picturesToSave++; if (apply) { const saved = await saveImage(d.picture.buffer, d.picture.mime); photoUrl = saved.url; savedUrls.push(photoUrl); } }
    else counts.newWithoutPicture++;
    if (apply) await q.query(
      `INSERT INTO vehicle_versions (id, generation_id, name, name_ar, name_zh, engine, engine_ar, engine_zh, seats, photo_url, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [newId('ver'), year.id, d.version.en, d.version.ar, d.version.zh, d.engine.en, d.engine.ar, d.engine.zh, d.seats, photoUrl, ord]);
    counts.newVersions++;
    rows.push({ ...summary, status: 'new', messages });
  }
  return { rows, counts, notes, missingBrands: [...missingBrands], savedUrls };
}

module.exports = { runImport };
