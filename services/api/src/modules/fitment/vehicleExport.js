// The vehicle data as an Excel file, in the layout of the "Leap_GEELY" sheet: one row per version, the English, Arabic and Chinese
// columns side by side, and the vehicle photo IN its cell (clicking the photo opens it full size).
// One brand (brandId) or all brands. Used by GET /fitment/export (admin, Vehicle data page).
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { imageSize } = require('image-size');

const UPLOAD_DIR = path.join(__dirname, '../../../uploads');
const HEADERS = [
  'Brand', 'Model', 'Year', 'Version', 'Engine', 'Seats',
  'الماركة', 'الموديل', 'السنة', 'الفئة', 'المحرك', 'عدد المقاعد',
  '品牌', '车型', '年份', '版本', '发动机', '座位数',
  'Vehicle Photo',
];
const WIDTHS = [12.2, 25.6, 7.8, 33.3, 21.1, 7.2, 13.3, 25.6, 7.8, 33.3, 21.1, 7.2, 13.3, 25.6, 7.8, 33.3, 21.1, 7.2, 45.6];
const FONTS = ['Arial', 'DejaVu Sans', 'Noto Sans CJK SC'];   // English, Arabic, Chinese columns (as in the form)
const PHOTO_COL = 19;                                         // S
const ROW_HEIGHT_PT = 82.5;
const PHOTO_BOX = { width: 300, height: 100 };                // px, fits inside the photo cell

/** "2021", or "2020–2022" for a year range; "" when the version has no year. */
function yearText(start, end) {
  if (start == null) return '';
  return end == null || Number(end) === Number(start) ? Number(start) : `${start}–${end}`;
}

/** A sheet name Excel accepts (at most 31 characters, none of : \ / ? * [ ]). */
function sheetName(brand) {
  return (brand ? `${brand.toUpperCase()} Models` : 'All Models').replace(/[:\\/?*[\]]/g, ' ').slice(0, 31);
}

/** The picture's bytes: a local /uploads/ file, or a cloud URL. null when it cannot be read. */
async function loadPhoto(url) {
  try {
    if (url.startsWith('/uploads/')) {
      const p = path.join(UPLOAD_DIR, path.basename(url));
      return fs.existsSync(p) ? fs.readFileSync(p) : null;
    }
    if (/^https?:\/\//i.test(url)) {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    }
  } catch { /* unreadable: the cell gets a link instead */ }
  return null;
}

/** Excel can show PNG and JPEG pictures (not WebP). */
function excelImageType(buf) {
  if (!buf || buf.length < 4) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpeg';
  return null;
}

function fitInBox(w, h) {
  const s = Math.min(PHOTO_BOX.width / w, PHOTO_BOX.height / h, 1);
  return { width: Math.round(w * s), height: Math.round(h * s) };
}

/** The rows: every version of every year of every model of the brand (a model or year with no version yet still gets one row). */
async function loadRows(db, brandId) {
  const { rows } = await db.query(
    `SELECT b.name AS b_en, b.name_ar AS b_ar, b.name_zh AS b_zh,
            m.name AS m_en, m.name_ar AS m_ar, m.name_zh AS m_zh,
            g.year_start, g.year_end, g.photo_url AS g_photo,
            v.name AS v_en, v.name_ar AS v_ar, v.name_zh AS v_zh,
            v.engine AS e_en, v.engine_ar AS e_ar, v.engine_zh AS e_zh, v.seats, v.photo_url AS v_photo
     FROM vehicle_brands b
     LEFT JOIN vehicle_models m ON m.brand_id = b.id
     LEFT JOIN vehicle_generations g ON g.model_id = m.id
     LEFT JOIN vehicle_versions v ON v.generation_id = g.id
     WHERE ($1::text IS NULL OR b.id::text = $1::text)
     ORDER BY b.sort_order, b.name, m.sort_order, m.name, g.year_start DESC NULLS LAST, g.sort_order, v.sort_order, v.name`,
    [brandId || null]
  );
  return rows;
}

/**
 * Builds the workbook. brandId: one brand, or null for all. baseUrl: the server's own address, for the photo links (http://host:4000).
 * Returns { buffer, fileName, rowCount, brandName }; null when brandId names no brand.
 */
async function buildVehicleWorkbook(db, { brandId = null, baseUrl = '' } = {}) {
  const rows = await loadRows(db, brandId);
  if (brandId && rows.length === 0) return null;
  const brandName = brandId ? rows[0].b_en : null;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Leap';
  const ws = wb.addWorksheet(sheetName(brandName), { views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }] });
  ws.columns = WIDTHS.map((width) => ({ width }));

  const header = ws.addRow(HEADERS);
  header.height = 31.5;
  header.eachCell((cell, col) => {
    cell.font = { name: col <= 18 ? FONTS[Math.floor((col - 1) / 6)] : 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  const photos = new Map();   // url -> { id, size } | null (each picture is loaded and stored once)
  for (const r of rows) {
    const year = yearText(r.year_start, r.year_end);
    const seats = r.seats == null ? '' : r.seats;
    const row = ws.addRow([
      r.b_en || '', r.m_en || '', year, r.v_en || '', r.e_en || '', seats,
      r.b_ar || '', r.m_ar || '', year, r.v_ar || '', r.e_ar || '', seats,
      r.b_zh || '', r.m_zh || '', year, r.v_zh || '', r.e_zh || '', seats,
      '',
    ]);
    row.height = ROW_HEIGHT_PT;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = { name: col <= 18 ? FONTS[Math.floor((col - 1) / 6)] : 'Arial', size: 11 };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });

    const url = r.v_photo || r.g_photo;   // the version's photo, else its year's
    const cell = row.getCell(PHOTO_COL);
    if (!url) { cell.value = 'No photo'; continue; }
    const fullUrl = /^https?:\/\//i.test(url) ? url : `${baseUrl}${url}`;
    if (!photos.has(url)) {
      const buf = await loadPhoto(url);
      const type = excelImageType(buf);
      let entry = null;
      if (type) {
        try { const s = imageSize(buf); entry = { id: wb.addImage({ buffer: buf, extension: type }), size: fitInBox(s.width, s.height) }; } catch { entry = null; }
      }
      photos.set(url, entry);
    }
    const pic = photos.get(url);
    if (pic) {
      ws.addImage(pic.id, { tl: { col: PHOTO_COL - 1 + 0.05, row: row.number - 1 + 0.05 }, ext: pic.size, editAs: 'oneCell', hyperlinks: { hyperlink: fullUrl, tooltip: 'Open the full photo' } });
    } else {
      cell.value = { text: 'Open photo', hyperlink: fullUrl };   // WebP or unreadable: a link instead
      cell.font = { name: 'Arial', size: 11, color: { argb: 'FF0563C1' }, underline: true };
    }
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: HEADERS.length } };

  const safe = (brandName || 'All_Brands').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Brand';
  const fileName = `Leap_${brandName ? safe.toUpperCase() : 'All_Brands'}_Vehicles.xlsx`;
  return { buffer: await wb.xlsx.writeBuffer(), fileName, rowCount: rows.length, brandName };
}

module.exports = { buildVehicleWorkbook, yearText, sheetName };
