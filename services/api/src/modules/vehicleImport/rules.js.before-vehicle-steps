// The checks on every row of the sheet, with no database: what each row must contain, that the three languages agree, that the same brand or model is not named two
// ways, that no version appears twice, and that every picture is acceptable. Returns, for each row, whether it is usable and a list of plain-words messages.
const { cleanLine, nameKey, parseYear, parseSeats, MAX_NAME_LENGTH } = require('../fitment/vehicleRules');
const { inspectImage, MIN_CATALOG_DIMENSION_PX } = require('../uploads/imageRules');
const { FIELDS, LANGS } = require('./columns');

const TEXT_FIELDS = FIELDS.filter((f) => f.max);
const ARABIC = /[\u0600-\u06FF]/;
const CJK = /[\u3400-\u9fff]/;

function mimeOf(ext) { return ext === 'png' ? 'image/png' : ext === 'jpeg' || ext === 'jpg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : null; }

/** rows: the parser's rows. Returns [{ rowNumber, ok, data, messages }] in the same order. */
function validateRows(rows, { minPx = MIN_CATALOG_DIMENSION_PX } = {}) {
  const items = rows.map((row) => {
    const messages = [];
    const err = (text) => messages.push({ level: 'error', text });
    const warn = (text) => messages.push({ level: 'warning', text });
    const data = { brand: {}, model: {}, version: {}, engine: {}, year: null, seats: null, picture: null };

    for (const f of TEXT_FIELDS) {
      for (const [lang, langName] of LANGS) {
        const text = cleanLine(row.values[f.key][lang]);
        if (text === '') err(`${f.label} (${langName}) is empty`);
        else if (text.length > f.max) err(`${f.label} (${langName}) is longer than ${f.max} characters`);
        data[f.key][lang] = text;
      }
    }
    for (const key of ['year', 'seats']) {
      const label = FIELDS.find((f) => f.key === key).label;
      const parse = key === 'year' ? parseYear : parseSeats;
      const parsed = {};
      for (const [lang, langName] of LANGS) {
        const raw = row.values[key][lang];
        if (raw === '' || cleanLine(raw) === '') { err(`${label} (${langName}) is empty`); continue; }
        parsed[lang] = parse(raw);
        if (parsed[lang] === null) err(key === 'year' ? `${label} (${langName}) "${cleanLine(raw)}" is not a valid year (four digits, 1950 to next year)` : `${label} (${langName}) "${cleanLine(raw)}" is not a whole number from 1 to 12`);
      }
      if (parsed.en != null && ((parsed.ar != null && parsed.ar !== parsed.en) || (parsed.zh != null && parsed.zh !== parsed.en))) {
        err(`The ${label.toLowerCase()} columns disagree (English ${parsed.en}${parsed.ar != null ? `, Arabic ${parsed.ar}` : ''}${parsed.zh != null ? `, Chinese ${parsed.zh}` : ''})`);
      }
      data[key] = parsed.en ?? null;
    }

    // columns put in the wrong language block are a typical spreadsheet slip: a warning, not an error
    const noArabic = TEXT_FIELDS.filter((f) => data[f.key].ar && !ARABIC.test(data[f.key].ar)).map((f) => f.label);
    const noChinese = TEXT_FIELDS.filter((f) => data[f.key].zh && !CJK.test(data[f.key].zh)).map((f) => f.label);
    if (noArabic.length) warn(`The Arabic text of ${noArabic.join(', ')} has no Arabic letters (columns mixed up?)`);
    if (noChinese.length) warn(`The Chinese text of ${noChinese.join(', ')} has no Chinese characters (columns mixed up?)`);

    // the picture
    if (row.pictureCount > 1) err(`There are ${row.pictureCount} pictures on this row: use one`);
    else if (row.picture) {
      const mime = mimeOf(row.picture.ext);
      const checked = mime ? inspectImage(row.picture.buffer, minPx) : { ok: false, error: `A ${row.picture.ext} picture is not supported (use PNG, JPEG or WebP)` };
      if (!checked.ok) err(`Picture: ${checked.error}`);
      else data.picture = { buffer: row.picture.buffer, mime: checked.mime, width: checked.width, height: checked.height };
    } else {
      warn('No picture: the version will be saved marked "No photo yet" (add the photo later by hand)');
    }
    return { rowNumber: row.rowNumber, ok: !messages.some((m) => m.level === 'error'), data, messages };
  });

  // the same brand or model must be written the same way in every row, and no version may appear twice
  const brands = new Map(), models = new Map(), versions = new Map();
  for (const item of items) {
    const d = item.data;
    if (!d.brand.en || !d.model.en) continue;
    const err = (text) => { item.messages.push({ level: 'error', text }); item.ok = false; };
    const bkey = nameKey(d.brand.en);
    const b = brands.get(bkey);
    if (!b) brands.set(bkey, { row: item.rowNumber, ar: d.brand.ar, zh: d.brand.zh });
    else {
      if (d.brand.ar && b.ar && nameKey(d.brand.ar) !== nameKey(b.ar)) err(`Brand "${d.brand.en}" has a different Arabic name here than in row ${b.row} ("${d.brand.ar}" and "${b.ar}")`);
      if (d.brand.zh && b.zh && nameKey(d.brand.zh) !== nameKey(b.zh)) err(`Brand "${d.brand.en}" has a different Chinese name here than in row ${b.row} ("${d.brand.zh}" and "${b.zh}")`);
    }
    const mkey = `${bkey}|${nameKey(d.model.en)}`;
    const m = models.get(mkey);
    if (!m) models.set(mkey, { row: item.rowNumber, ar: d.model.ar, zh: d.model.zh });
    else {
      if (d.model.ar && m.ar && nameKey(d.model.ar) !== nameKey(m.ar)) err(`Model "${d.model.en}" has a different Arabic name here than in row ${m.row} ("${d.model.ar}" and "${m.ar}")`);
      if (d.model.zh && m.zh && nameKey(d.model.zh) !== nameKey(m.zh)) err(`Model "${d.model.en}" has a different Chinese name here than in row ${m.row} ("${d.model.zh}" and "${m.zh}")`);
    }
    if (d.year && d.version.en && d.engine.en) {
      const vkey = `${mkey}|${d.year}|${nameKey(d.version.en)}|${nameKey(d.engine.en)}|${d.seats ?? ''}`;
      if (versions.has(vkey)) err(`This is the same version as row ${versions.get(vkey)} (same brand, model, year, version name, engine and seats)`);
      else versions.set(vkey, item.rowNumber);
    }
  }
  return items;
}

module.exports = { validateRows, MAX_NAME_LENGTH };
