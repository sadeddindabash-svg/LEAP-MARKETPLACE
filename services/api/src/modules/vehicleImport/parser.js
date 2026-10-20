// Reads the uploaded .xlsx: the rows of text, and each PICTURE with the row it sits on (a picture belongs to the row where its top-left corner is, in the picture column).
const ExcelJS = require('exceljs');
const { cleanLine } = require('../fitment/vehicleRules');
const { FIELDS, PHOTO_HEADER, LANGS, MAX_ROWS } = require('./columns');
const { normalizeWorkbookPackage } = require('./normalize');

class ImportError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

/** A cell's value as plain text or a number: formulas give their result, rich text its text, anything else empty. */
function cellValue(cell) {
  let v = cell ? cell.value : null;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if ('result' in v) v = v.result;
    else if ('text' in v) v = v.text;
    else return '';
  }
  if (v === null || v === undefined) return '';
  return typeof v === 'number' ? v : String(v);
}
const asText = (v) => cleanLine(v);

/** Finds the header row: the first row (within the first 10) that has both a "Brand" and a "Model" header. */
function findHeaderRow(ws) {
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const names = new Set();
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell) => names.add(asText(cellValue(cell)).toLowerCase()));
    if (names.has('brand') && names.has('model')) return r;
  }
  return null;
}

async function parseWorkbook(buffer) {
  let wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch (firstError) {
    // A valid file written in another XML style (see normalize.js) fails here with a vague error: read it again, rewritten in memory into Excel's style.
    let reason = firstError;
    wb = new ExcelJS.Workbook();
    try {
      const rewritten = await normalizeWorkbookPackage(buffer);
      if (!rewritten) throw firstError;
      await wb.xlsx.load(rewritten);
    } catch (secondError) {
      reason = secondError;
      // the real reason goes to the server's log, so a file that still cannot be read can be diagnosed
      console.warn(`[vehicle-import] cannot read the uploaded file: ${reason && reason.message}`);
      throw new ImportError('This file could not be read as an Excel (.xlsx) file. Open it in Excel and save it again as an Excel Workbook (.xlsx), then try again. (If it keeps failing, send the file to the Leap team: it may be damaged or written by a tool this importer does not support.)');
    }
  }
  let ws = null, headerRow = null;
  for (const sheet of wb.worksheets) { const r = findHeaderRow(sheet); if (r) { ws = sheet; headerRow = r; break; } }
  if (!ws) throw new ImportError('No sheet with the expected headers was found. The first row needs the headers of the template (Brand, Model, Year, Version, Engine, Seats, Vehicle Photo, then the Arabic and Chinese columns). Download the template to see them.');

  // header name -> column number
  const byHeader = new Map();
  ws.getRow(headerRow).eachCell({ includeEmpty: false }, (cell, col) => { const t = asText(cellValue(cell)); if (t && !byHeader.has(t.toLowerCase())) byHeader.set(t.toLowerCase(), col); });
  const columns = {};
  const missing = [];
  for (const f of FIELDS) {
    columns[f.key] = {};
    for (const [lang, langName] of LANGS) {
      const col = byHeader.get(f.headers[lang].toLowerCase());
      if (col) columns[f.key][lang] = col; else missing.push(`${f.headers[lang]} (${f.label}, ${langName})`);
    }
  }
  if (missing.length) throw new ImportError(`These columns are missing from the first row: ${missing.join(', ')}. Download the template to see the exact headers.`);
  const photoCol = byHeader.get(PHOTO_HEADER.toLowerCase()) || null;

  // pictures: by the row of their top-left corner
  const pictures = new Map();           // row number -> [{ col, buffer, ext }]
  let pictureCount = 0;
  for (const img of ws.getImages()) {
    const media = wb.getImage(img.imageId);
    if (!media || !media.buffer) continue;
    const row = Math.floor(img.range.tl.nativeRow) + 1, col = Math.floor(img.range.tl.nativeCol) + 1;
    if (!pictures.has(row)) pictures.set(row, []);
    pictures.get(row).push({ col, buffer: media.buffer, ext: media.extension });
    pictureCount++;
  }

  const rows = [];
  const issues = [];
  const lastRow = Math.max(ws.rowCount, ...pictures.keys(), headerRow);
  for (let r = headerRow + 1; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const values = {};
    let anyText = false;
    for (const f of FIELDS) {
      values[f.key] = {};
      for (const [lang] of LANGS) {
        const v = cellValue(row.getCell(columns[f.key][lang]));
        values[f.key][lang] = v;
        if (v !== '' && asText(v) !== '') anyText = true;
      }
    }
    const here = pictures.get(r) || [];
    if (!anyText && here.length === 0) continue;                                    // a blank row
    const inPhotoColumn = here.filter((p) => !photoCol || p.col === photoCol);
    const stray = here.length - inPhotoColumn.length;
    if (stray > 0) issues.push({ level: 'warning', row: r, text: `Row ${r}: ${stray} picture(s) are not in the "${PHOTO_HEADER}" column and were ignored.` });
    rows.push({ rowNumber: r, values, picture: inPhotoColumn[0] || null, pictureCount: inPhotoColumn.length });
    if (rows.length > MAX_ROWS) throw new ImportError(`The file has more than ${MAX_ROWS} rows. Split it into smaller files.`);
  }
  if (!photoCol && pictureCount > 0) issues.push({ level: 'warning', text: `There is no "${PHOTO_HEADER}" column, so no pictures are imported.` });
  return { sheetName: ws.name, headerRow, rows, issues, pictureCount };
}

module.exports = { parseWorkbook, ImportError, cellValue };
