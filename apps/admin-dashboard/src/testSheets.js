// Test support: builds a small .xlsx in the import's layout (English block, the picture column, Arabic block, Chinese block), with real pictures placed over the cells.
import ExcelJS from 'exceljs';
import { makePng } from './testImages.js';

export const HEADERS = ['Brand', 'Model', 'Year', 'Version', 'Engine', 'Seats', 'Vehicle Photo', 'الماركة', 'الموديل', 'السنة', 'الفئة', 'المحرك', 'عدد المقاعد', '品牌', '车型', '年份', '版本', '发动机', '座位数'];

/** A complete, valid row (every language filled in); `over` changes any of its parts. */
export function row(over = {}) {
  const r = { brand: 'AITO', brandAr: 'أيتو', brandZh: '问界', model: 'M5', modelAr: 'إم5', modelZh: '问界M5', year: 2022, version: 'AWD Flagship', versionAr: 'دفع كلي فلاجشيب', versionZh: '全轮驱动 旗舰版',
    engine: '1.5T range extender (365 kW)', engineAr: '1.5 لتر موسع مدى', engineZh: '1.5升 增程器', seats: 5, yearAr: undefined, yearZh: undefined, seatsAr: undefined, seatsZh: undefined, picture: undefined, ...over };
  return r;
}

/**
 * rows: objects from row(); `picture`: undefined (none), a size [w, h] (a picture of that size), or an array of sizes (several pictures on the row).
 * options.headers: replace the header row (to test a missing or reordered column); options.sheetName.
 */
export async function makeSheet(rows, { headers = HEADERS, sheetName = 'Vehicles', blankRowAfter = null } = {}) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(headers);
  const cells = (r) => ({
    Brand: r.brand, Model: r.model, Year: r.year, Version: r.version, Engine: r.engine, Seats: r.seats, 'Vehicle Photo': null,
    'الماركة': r.brandAr, 'الموديل': r.modelAr, 'السنة': r.yearAr ?? r.year, 'الفئة': r.versionAr, 'المحرك': r.engineAr, 'عدد المقاعد': r.seatsAr ?? r.seats,
    '品牌': r.brandZh, '车型': r.modelZh, '年份': r.yearZh ?? r.year, '版本': r.versionZh, '发动机': r.engineZh, '座位数': r.seatsZh ?? r.seats,
  });
  rows.forEach((r, i) => {
    const values = cells(r);
    ws.addRow(headers.map((h) => values[h] ?? null));
    const sizes = r.picture === undefined ? [] : Array.isArray(r.picture[0]) ? r.picture : [r.picture];
    const photoCol = headers.indexOf('Vehicle Photo');
    sizes.forEach(([w, h]) => {
      const id = wb.addImage({ buffer: makePng(w, h), extension: 'png' });
      ws.addImage(id, { tl: { col: photoCol + 0.2, row: i + 1.05 }, ext: { width: 120, height: 120 } });
    });
    if (blankRowAfter === i) ws.addRow([]);
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
