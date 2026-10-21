// The downloadable template: the same layout as the AITO sheet (English block, the picture, the Arabic block, the Chinese block), an empty "Vehicles" sheet to fill in
// and a "Read me" sheet with the rules and one example row.
const ExcelJS = require('exceljs');
const { FIELDS, TEMPLATE_HEADERS, PHOTO_HEADER, MAX_ROWS } = require('./columns');

async function buildTemplate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Leap Auto Parts';
  const ws = wb.addWorksheet('Vehicles', { views: [{ state: 'frozen', ySplit: 1 }] });
  const fills = { en: 'FF0B3146', photo: 'FFF9B317', ar: 'FF1F6F5C', zh: 'FF8A2C2C' };
  const blockOf = (i) => (i < FIELDS.length ? 'en' : i === FIELDS.length ? 'photo' : i < FIELDS.length * 2 + 1 ? 'ar' : 'zh');
  ws.columns = TEMPLATE_HEADERS.map((h, i) => ({ header: h, key: `c${i}`, width: ['Engine', 'المحرك', '发动机'].includes(h) ? 46 : h === PHOTO_HEADER ? 18 : ['Version', 'الفئة', '版本'].includes(h) ? 30 : 14 }));
  ws.getRow(1).eachCell((cell, col) => {
    const block = blockOf(col - 1);
    cell.font = { name: 'Arial', bold: true, color: { argb: block === 'photo' ? 'FF0B3146' : 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fills[block] } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  ws.getRow(1).height = 24;
  for (const key of ['year', 'seats']) {
    const f = FIELDS.findIndex((x) => x.key === key);
    for (const col of [f + 1, FIELDS.length + 2 + f, FIELDS.length * 2 + 2 + f]) ws.getColumn(col).numFmt = '0';
  }

  const guide = wb.addWorksheet('Read me');
  guide.getColumn(1).width = 110;
  const lines = [
    ['Vehicle import template', true],
    ['', false],
    ['How to fill the "Vehicles" sheet', true],
    ['• One row = one version of a vehicle in one year (for example AITO M5, 2022, "AWD Flagship"). The first row (the headers) must stay as it is.', false],
    ['• Fill all three language blocks: English (columns A to F), Arabic and Chinese. Brand, Model, Version and Engine are needed in all three languages. Year and Seats are numbers and must be the SAME in the three blocks.', false],
    ['• The brand must already exist in Vehicle Data (Brands tab) with its photo: the import does not create brands. Models and years are created for you. Years created by the import have no photo.', false],
    ['• Year: four digits, 1950 up to next year. Seats: a whole number from 1 to 12.', false],
    [`• Picture (column "${PHOTO_HEADER}"): place ONE picture over the cell of its row (Insert > Pictures > Place over cells), PNG, JPEG or WebP, at least 400 x 400 px. A row without a picture is fine: the version is saved marked "No photo yet" and you add the photo later in Vehicle Data.`, false],
    ['• Two rows with the same brand, model, year, version name, engine and seats are the same version: a file may not have it twice. A version that already exists in the system is skipped (or updated, if you choose "Update existing").', false],
    [`• Up to ${MAX_ROWS} rows per file. The file is checked first and NOTHING is saved until you press Import; then everything is saved together or nothing is.`, false],
    ['', false],
    ['Example row', true],
    ['Brand: AITO | Model: M5 | Year: 2022 | Version: AWD Flagship | Engine: 1.5T petrol range extender + electric drive (365 kW) | Seats: 5', false],
    ['الماركة: أيتو / وينجيه | الموديل: إم5 | السنة: 2022 | الفئة: دفع كلي فلاجشيب | المحرك: 1.5 لتر / تيربو / بنزين / موسع مدى مع دفع كهربائي / 365 كيلوواط | عدد المقاعد: 5', false],
    ['品牌: 问界 | 车型: 问界M5 | 年份: 2022 | 版本: 全轮驱动 旗舰版 | 发动机: 1.5升 / 涡轮增压 / 汽油 / 增程器与电驱动 / 365千瓦 | 座位数: 5', false],
  ];
  lines.forEach(([text, bold], i) => {
    const cell = guide.getCell(i + 1, 1);
    cell.value = text;
    cell.font = { name: 'Arial', bold, size: bold && i === 0 ? 14 : 11 };
    cell.alignment = { wrapText: true, vertical: 'top' };
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { buildTemplate };
