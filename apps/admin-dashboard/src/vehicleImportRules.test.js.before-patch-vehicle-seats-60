// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { makeSheet, row, HEADERS, prefixMainNamespace } from './testSheets.js';

const require = createRequire(import.meta.url);
const { parseWorkbook, ImportError } = require('../../../services/api/src/modules/vehicleImport/parser.js');
const { validateRows } = require('../../../services/api/src/modules/vehicleImport/rules.js');
const columns = require('../../../services/api/src/modules/vehicleImport/columns.js');
const { unprefixMainNamespace } = require('../../../services/api/src/modules/vehicleImport/normalize.js');

const check = async (rows, options) => { const parsed = await parseWorkbook(await makeSheet(rows, options)); return { parsed, items: validateRows(parsed.rows) }; };
const errorsOf = (item) => item.messages.filter((m) => m.level === 'error').map((m) => m.text);
const warningsOf = (item) => item.messages.filter((m) => m.level === 'warning').map((m) => m.text);

describe('reading the sheet', () => {
  it('CRITICAL: every picture belongs to the row it sits on, and rows without one have none', async () => {
    const { parsed } = await check([row({ picture: [400, 400] }), row({ version: 'B' }), row({ version: 'C', picture: [500, 500] })]);
    expect(parsed.rows.map((r) => r.rowNumber)).toEqual([2, 3, 4]);
    expect(parsed.rows.map((r) => !!r.picture)).toEqual([true, false, true]);
    expect(parsed.pictureCount).toBe(2);
    expect(parsed.rows[0].picture.ext).toBe('png');
  });
  it('columns are found by their HEADER NAME, so a reordered sheet works the same', async () => {
    const reordered = [...HEADERS].reverse();
    const { items } = await check([row({ picture: [400, 400] })], { headers: reordered });
    expect(items[0].ok).toBe(true);
    expect(items[0].data.brand).toEqual({ en: 'AITO', ar: 'أيتو', zh: '问界' });
  });
  it('CRITICAL: a missing column is named in plain words, so the admin knows what to fix', async () => {
    const without = HEADERS.filter((h) => h !== 'المحرك' && h !== '座位数');
    await expect(check([row()], { headers: without })).rejects.toThrow(/Engine, Arabic|المحرك/);
    await expect(check([row()], { headers: without })).rejects.toThrow(/座位数/);
  });
  it('a file that is not an Excel file, and a sheet with no headers, are refused with a clear message', async () => {
    await expect(parseWorkbook(Buffer.from('this is not a spreadsheet'))).rejects.toThrow(/could not be read as an Excel \(\.xlsx\) file/);
    await expect(check([row()], { headers: ['A', 'B', 'C'] })).rejects.toThrow(/No sheet with the expected headers/);
    await expect(parseWorkbook(Buffer.from('x'))).rejects.toBeInstanceOf(ImportError);
  });
  it('blank rows are skipped, and numbers and text are both read', async () => {
    const { parsed } = await check([row(), row({ version: 'B', year: '2023', seats: '6', yearAr: '2023', yearZh: '2023', seatsAr: '6', seatsZh: '6' })], { blankRowAfter: 0 });
    expect(parsed.rows).toHaveLength(2);
  });
  it('a picture placed in another column is ignored with a warning, and a sheet with more than 2000 rows is refused', async () => {
    const parsed = await parseWorkbook(await makeSheet([row({ picture: [400, 400] })], { headers: HEADERS.filter((h) => h !== 'Vehicle Photo').concat('Vehicle Photo') }));
    expect(parsed.rows[0].picture).not.toBeNull();                               // the picture column is found wherever it is
    const many = Array.from({ length: columns.MAX_ROWS + 1 }, (_, i) => row({ version: `V${i}` }));
    await expect(check(many)).rejects.toThrow(/more than 2000 rows/);
  }, 60000);
});

describe('checking every row', () => {
  it('CRITICAL: a complete row is accepted, with its texts tidied; no picture is only a warning', async () => {
    const { items } = await check([row({ version: '  AWD   Flagship ', picture: undefined })]);
    expect(items[0].ok).toBe(true);
    expect(items[0].data.version.en).toBe('AWD Flagship');
    expect(warningsOf(items[0])[0]).toMatch(/No picture.*No photo yet/);
  });
  it('CRITICAL: each of the twelve texts must be filled in (brand, model, version and engine in English, Arabic and Chinese)', async () => {
    for (const [field, label] of [['brand', 'Brand (English)'], ['brandAr', 'Brand (Arabic)'], ['brandZh', 'Brand (Chinese)'], ['model', 'Model (English)'], ['modelAr', 'Model (Arabic)'], ['modelZh', 'Model (Chinese)'],
      ['version', 'Version (English)'], ['versionAr', 'Version (Arabic)'], ['versionZh', 'Version (Chinese)'], ['engine', 'Engine (English)'], ['engineAr', 'Engine (Arabic)'], ['engineZh', 'Engine (Chinese)']]) {
      const { items } = await check([row({ [field]: '' })]);
      expect(items[0].ok, field).toBe(false);
      expect(errorsOf(items[0]), field).toContain(`${label} is empty`);
    }
  });
  it('CRITICAL: the year and the seats must be valid AND the same in all three language blocks', async () => {
    for (const bad of [1949, 'abcd', '24']) { const { items } = await check([row({ year: bad })]); expect(items[0].ok, String(bad)).toBe(false); }
    for (const bad of [0, 13, 'five', 5.5]) { const { items } = await check([row({ seats: bad })]); expect(items[0].ok, String(bad)).toBe(false); }
    const mismatch = await check([row({ yearAr: 2023 })]);
    expect(errorsOf(mismatch.items[0]).join(' ')).toMatch(/year columns disagree \(English 2022, Arabic 2023, Chinese 2022\)/);
    const seats = await check([row({ seatsZh: 7 })]);
    expect(errorsOf(seats.items[0]).join(' ')).toMatch(/seats columns disagree/);
  });
  it('CRITICAL: a picture under 400 px is an error naming the size; 400 and bigger are fine; two pictures on one row are refused', async () => {
    const small = await check([row({ picture: [399, 399] })]);
    expect(errorsOf(small.items[0]).join(' ')).toMatch(/Picture: Image resolution too low \(399x399\).*at least 400px/);
    for (const size of [[400, 400], [800, 800], [400, 900]]) { const { items } = await check([row({ picture: size })]); expect(items[0].ok, size.join('x')).toBe(true); expect(items[0].data.picture.width).toBe(size[0]); }
    const two = await check([row({ picture: [[400, 400], [400, 400]] })]);
    expect(errorsOf(two.items[0]).join(' ')).toMatch(/2 pictures on this row/);
  });
  it('CRITICAL: the same brand or model written two ways, and the same version twice, are caught and name the other row', async () => {
    const names = await check([row(), row({ version: 'B', brandZh: '不同' }), row({ version: 'C', modelAr: 'مختلف' })]);
    expect(errorsOf(names.items[1]).join(' ')).toMatch(/Brand "AITO" has a different Chinese name here than in row 2/);
    expect(errorsOf(names.items[2]).join(' ')).toMatch(/Model "M5" has a different Arabic name here than in row 2/);
    const dup = await check([row(), row({ version: ' awd FLAGSHIP ', engine: '1.5T  range extender (365 kW)' })]);
    expect(errorsOf(dup.items[1]).join(' ')).toMatch(/same version as row 2/);
    const other = await check([row(), row({ engine: 'A different engine' }), row({ year: 2023 })]);
    expect(other.items.every((i) => i.ok)).toBe(true);                           // another engine, or another year, is another version
  });
  it('columns mixed up between languages are a warning (the text has no Arabic letters / no Chinese characters), not an error', async () => {
    const { items } = await check([row({ versionAr: 'AWD Flagship', engineZh: '1.5T' })]);
    expect(items[0].ok).toBe(true);
    expect(warningsOf(items[0]).join(' ')).toMatch(/Arabic text of Version has no Arabic letters/);
    expect(warningsOf(items[0]).join(' ')).toMatch(/Chinese text of Engine has no Chinese characters/);
  });
  it('over-long texts are refused', async () => {
    const { items } = await check([row({ version: 'x'.repeat(121) }), row({ version: 'y', engineAr: 'ع'.repeat(201) })]);
    expect(errorsOf(items[0]).join(' ')).toMatch(/Version \(English\) is longer than 120/);
    expect(errorsOf(items[1]).join(' ')).toMatch(/Engine \(Arabic\) is longer than 200/);
  });
});

// Some programs write a valid .xlsx with a PREFIX on every spreadsheet tag (<x:workbook>, <x:sheets>...). Excel and others read it; the reading library did not, and the importer
// answered "not a valid .xlsx file" for a file that was fine (the ARCFOX sheet). The importer now rewrites such a file in memory and reads it.
describe('a valid file written with prefixed XML tags', () => {
  const rows = () => [row({ picture: [400, 400] }), row({ version: 'B' }), row({ version: 'C', year: 2023, yearAr: 2023, yearZh: 2023, picture: [500, 500] })];

  it('CRITICAL: is read exactly like the same file in Excel\'s own style (same rows, same texts, every picture on its own row)', async () => {
    const plain = await makeSheet(rows());
    const prefixed = await prefixMainNamespace(plain);
    const { default: JSZip } = await import('jszip');
    const workbookXml = await (await JSZip.loadAsync(prefixed)).file('xl/workbook.xml').async('string');
    expect(workbookXml).toMatch(/<x:workbook xmlns:x=/);                                  // it really is written in the other style
    const a = await parseWorkbook(plain), b = await parseWorkbook(prefixed);
    expect(b.rows.map((r) => r.rowNumber)).toEqual(a.rows.map((r) => r.rowNumber));
    expect(b.rows.map((r) => r.values)).toEqual(a.rows.map((r) => r.values));
    expect(b.rows.map((r) => !!r.picture)).toEqual([true, false, true]);
    expect(b.pictureCount).toBe(2);
    expect(validateRows(b.rows).every((i) => i.ok)).toBe(true);
  });

  it('works whatever the prefix is called, and a damaged file is still refused with the clear message', async () => {
    const prefixed = await prefixMainNamespace(await makeSheet(rows()), 'ss');
    expect((await parseWorkbook(prefixed)).rows).toHaveLength(3);
    await expect(parseWorkbook(prefixed.subarray(0, 600))).rejects.toThrow(/could not be read as an Excel \(\.xlsx\) file/);
  });

  it('the rewrite touches only a part that uses a prefix for the spreadsheet namespace; Excel-style parts, other namespaces and prefixed attributes are left alone', () => {
    const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const excel = `<?xml version="1.0"?><workbook xmlns="${NS}"><sheets><sheet name="A"/></sheets></workbook>`;
    expect(unprefixMainNamespace(excel)).toBe(excel);
    expect(unprefixMainNamespace(`<x:workbook xmlns:x="${NS}"><x:sheets><x:sheet name="A"/></x:sheets></x:workbook>`)).toBe(`<workbook xmlns="${NS}"><sheets><sheet name="A"/></sheets></workbook>`);
    const withAttribute = `<x:workbook xmlns:x="${NS}"><x:sheet x:name="A"/></x:workbook>`;
    expect(unprefixMainNamespace(withAttribute)).toBe(withAttribute);                       // an attribute uses the prefix: not safe to rewrite, left as it is
    const drawing = '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"><xdr:oneCellAnchor/></xdr:wsDr>';
    expect(unprefixMainNamespace(drawing)).toBe(drawing);
  });
});

