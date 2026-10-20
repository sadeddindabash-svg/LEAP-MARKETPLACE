// Reads the uploaded .xlsx: the rows of text of the parts sheet (found by its headers), each cell by header name. There are no pictures in this file (photos come later).
const ExcelJS = require('exceljs');
const { COLUMNS, SHEET_NAME, MAX_ROWS } = require('./columns');
const { normalizeWorkbookPackage } = require('../vehicleImport/normalize');

class ImportError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

/** A cell's value as text or a number: formulas give their result, rich text its text, anything else empty. */
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
const asText = (v) => String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim();

/** The header row: the first row (within the first 10) holding both "Part Code" and "Main Category (English)". */
function findHeaderRow(ws) {
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const names = new Set();
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell) => names.add(asText(cellValue(cell)).toLowerCase()));
    if (names.has(COLUMNS.partCode.header.toLowerCase()) && names.has(COLUMNS.mainEn.header.toLowerCase())) return r;
  }
  return null;
}

async function parseWorkbook(buffer) {
  let wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch (firstError) {
    wb = new ExcelJS.Workbook();
    try {
      const rewritten = await normalizeWorkbookPackage(buffer);          // a valid file written in another XML style: read it again, rewritten in memory
      if (!rewritten) throw firstError;
      await wb.xlsx.load(rewritten);
    } catch (secondError) {
      console.warn(`[catalog-import] cannot read the uploaded file: ${secondError && secondError.message}`);
      throw new ImportError('This file could not be read as an Excel (.xlsx) file. Open it in Excel and save it again as an Excel Workbook (.xlsx), then try again.');
    }
  }
  // the sheet named "Part types" first, then any other sheet that has the headers
  const sheets = [...wb.worksheets].sort((a, b) => (b.name === SHEET_NAME) - (a.name === SHEET_NAME));
  let ws = null, headerRow = null;
  for (const sheet of sheets) { const r = findHeaderRow(sheet); if (r) { ws = sheet; headerRow = r; break; } }
  if (!ws) throw new ImportError(`No sheet with the expected headers was found. The first row of the "${SHEET_NAME}" sheet needs the headers of the template (Main Category Code, Part Code, Sub Category (English) and so on). Download the template to see them.`);

  const byHeader = new Map();
  ws.getRow(headerRow).eachCell({ includeEmpty: false }, (cell, col) => { const t = asText(cellValue(cell)); if (t && !byHeader.has(t.toLowerCase())) byHeader.set(t.toLowerCase(), col); });
  const columns = {}, missing = [];
  for (const [key, def] of Object.entries(COLUMNS)) {
    const col = byHeader.get(def.header.toLowerCase());
    if (col) columns[key] = col; else if (def.required) missing.push(def.header);
  }
  if (missing.length) throw new ImportError(`These columns are missing from the first row: ${missing.join(', ')}. Download the template to see the exact headers.`);

  const rows = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r), values = {};
    let any = false;
    for (const key of Object.keys(COLUMNS)) {
      const v = columns[key] ? cellValue(row.getCell(columns[key])) : '';
      values[key] = v;
      if (v !== '' && asText(v) !== '') any = true;
    }
    if (!any) continue;                                                   // a blank row
    rows.push({ rowNumber: r, values });
    if (rows.length > MAX_ROWS) throw new ImportError(`The file has more than ${MAX_ROWS} rows. Split it into smaller files.`);
  }
  return { sheetName: ws.name, headerRow, rows, issues: [] };
}

module.exports = { parseWorkbook, ImportError, cellValue, asText };
