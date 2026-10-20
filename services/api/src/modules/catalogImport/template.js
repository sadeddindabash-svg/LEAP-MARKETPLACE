// The blank template: the headers of the "Part types" sheet, two example rows (a part with positions, and a pack-size variant) and a short Read me.
const ExcelJS = require('exceljs');
const { COLUMNS, SHEET_NAME, TEMPLATE_HEADERS, POSITIONS } = require('./columns');

async function buildTemplate() {
  const wb = new ExcelJS.Workbook();
  const read = wb.addWorksheet('Read me');
  for (const line of [
    'Parts catalog import template', '',
    'One row per part, on the sheet "Part types". The first row holds the headers: keep them as they are (their order does not matter).',
    'Main Category: ONE word. Sub Category: 1 to 3 words. The part name is the sub-category, plus a Variant (a pack size or type) when there is one, and has at most 5 words.',
    `Allowed Positions: any of ${POSITIONS.join(', ')}, separated by ; . A part with a Variant can only be Universal.`,
    'Length, Width, Height (cm) and Weight (kg) are the PACKED size and weight. Size Basis starts with Estimate or Measured.',
    'Codes: the Main Category Code is 2 to 5 letters (BRK); the Part Code starts with it (BRK-001) and is never reused.',
    'Nothing is saved until you press Import; the check shows every problem with its row number.']) read.addRow([line]);
  read.getColumn(1).width = 140; read.getRow(1).font = { bold: true, size: 14 };
  const ws = wb.addWorksheet(SHEET_NAME);
  ws.addRow(TEMPLATE_HEADERS); ws.getRow(1).font = { bold: true };
  const row = (o) => Object.keys(COLUMNS).map((k) => (o[k] === undefined ? '' : o[k]));
  ws.addRow(row({ mainCode: 'BRK', mainEn: 'Brakes', mainAr: 'الفرامل', mainZh: '制动', partCode: 'BRK-001', subEn: 'Brake Pad Set', subAr: 'طقم تيل فرامل', subZh: '刹车片套装', positions: 'Front; Rear', placeEn: 'Wheel (brake)', length: 25, width: 15, height: 10, weight: 0.9, applies: 'All vehicles', basis: 'Estimate' }));
  ws.addRow(row({ mainCode: 'FLD', mainEn: 'Fluids', mainAr: 'السوائل', mainZh: '油液', partCode: 'FLD-002', subEn: 'Engine Oil', subAr: 'زيت محرك', subZh: '发动机机油', varEn: '4 L', varAr: '4 لتر', varZh: '4升', positions: 'Universal', length: 20, width: 12, height: 28, weight: 3.7, basis: 'Estimate' }));
  ws.columns.forEach((c) => { c.width = 22; });
  return wb.xlsx.writeBuffer();
}
module.exports = { buildTemplate };
