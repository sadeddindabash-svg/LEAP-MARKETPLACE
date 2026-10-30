// The vehicle data Excel export (src/modules/fitment/vehicleExport.js): the layout of the import sheet, read back with exceljs.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ExcelJS = require('exceljs');
const { buildVehicleWorkbook, yearText, sheetName } = require('../src/modules/fitment/vehicleExport');

function png(w, h) {   // a real, tiny PNG
  const crc = (buf) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } c = 0xffffffff; for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

test('the year is one year, or a range', () => {
  assert.strictEqual(yearText(2021, 2021), 2021);
  assert.strictEqual(yearText(2023, null), 2023);
  assert.strictEqual(yearText(2020, 2022), '2020–2022');
  assert.strictEqual(yearText(null, null), '');
});

test('the sheet name is one Excel accepts', () => {
  assert.strictEqual(sheetName('Geely'), 'GEELY Models');
  assert.strictEqual(sheetName(null), 'All Models');
  assert.ok(!/[:\\/?*[\]]/.test(sheetName('Mercedes-Benz/AMG [X]')));
});

test('one brand: the form layout, the three languages, the photo in its cell', async () => {
  const uploads = path.join(__dirname, '../uploads');
  fs.mkdirSync(uploads, { recursive: true });
  const pic = path.join(uploads, '__export_test__.png');
  fs.writeFileSync(pic, png(80, 45));
  try {
    const rows = [
      { b_en: 'Geely', b_ar: 'جيلي', b_zh: '吉利', m_en: 'Atlas Pro', m_ar: 'أطلس برو', m_zh: '吉利博越 PRO', year_start: 2021, year_end: 2021, v_en: 'Luxury AWD', v_ar: 'لكجري دفع كلي', v_zh: '豪华型', e_en: '1.5T', e_ar: '1.5 لتر', e_zh: '1.5升', seats: 5, v_photo: '/uploads/__export_test__.png', g_photo: null },
      { b_en: 'Geely', m_en: 'Azkarra', year_start: 2020, year_end: 2022, v_en: 'Premium', seats: 7, v_photo: '/uploads/__export_test__.png' },
      { b_en: 'Geely', m_en: 'Coolray', year_start: 2023, v_en: 'Sport', v_photo: '/uploads/__not_there__.png' },
      { b_en: 'Geely', m_en: 'Okavango', year_start: null, v_photo: null, g_photo: null },
    ];
    let asked;
    const db = { query: async (sql, params) => { asked = params; return { rows }; } };
    const out = await buildVehicleWorkbook(db, { brandId: 'b1', baseUrl: 'http://localhost:4000' });
    assert.deepStrictEqual(asked, ['b1']);
    assert.strictEqual(out.fileName, 'Leap_GEELY_Vehicles.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(out.buffer);
    const ws = wb.getWorksheet('GEELY Models');
    assert.ok(ws, 'the sheet is called "GEELY Models"');
    assert.deepStrictEqual(ws.getRow(1).values.slice(1), ['Brand', 'Model', 'Year', 'Version', 'Engine', 'Seats', 'الماركة', 'الموديل', 'السنة', 'الفئة', 'المحرك', 'عدد المقاعد', '品牌', '车型', '年份', '版本', '发动机', '座位数', 'Vehicle Photo']);
    const r2 = ws.getRow(2).values.slice(1);
    assert.deepStrictEqual(r2.slice(0, 18), ['Geely', 'Atlas Pro', 2021, 'Luxury AWD', '1.5T', 5, 'جيلي', 'أطلس برو', 2021, 'لكجري دفع كلي', '1.5 لتر', 5, '吉利', '吉利博越 PRO', 2021, '豪华型', '1.5升', 5]);
    assert.strictEqual(ws.getCell('C3').value, '2020–2022');
    const images = ws.getImages();
    assert.strictEqual(images.length, 2, 'the two rows with a readable photo get it in the cell');
    assert.strictEqual(new Set(images.map((i) => i.imageId)).size, 1, 'the same photo is stored once');
    assert.strictEqual(Math.floor(images[0].range.tl.nativeCol), 18, 'in the Vehicle Photo column');
    assert.strictEqual(ws.getCell('S4').value.hyperlink, 'http://localhost:4000/uploads/__not_there__.png', 'an unreadable photo becomes a link');
    assert.strictEqual(ws.getCell('S5').value, 'No photo');
  } finally {
    fs.rmSync(pic, { force: true });
  }
});

test('a brand that does not exist gives nothing (the route answers 404)', async () => {
  const out = await buildVehicleWorkbook({ query: async () => ({ rows: [] }) }, { brandId: 'nope' });
  assert.strictEqual(out, null);
});

test('all brands: one file for everything', async () => {
  let asked;
  const out = await buildVehicleWorkbook({ query: async (sql, p) => { asked = p; return { rows: [{ b_en: 'Geely', m_en: 'Atlas' }, { b_en: 'Toyota', m_en: 'Camry' }] }; } }, {});
  assert.deepStrictEqual(asked, [null]);
  assert.strictEqual(out.fileName, 'Leap_All_Brands_Vehicles.xlsx');
  assert.strictEqual(out.rowCount, 2);
});
