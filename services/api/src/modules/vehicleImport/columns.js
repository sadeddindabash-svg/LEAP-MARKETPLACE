// The layout of the Excel sheet for importing vehicle data: the same as the AITO sheet. Three blocks of columns (English, Arabic, Chinese) and the picture column.
// Columns are found by their HEADER NAME, not by position, so a reordered or extended sheet still works; the first row holds the headers.
const FIELDS = [
  { key: 'brand', label: 'Brand', max: 120, headers: { en: 'Brand', ar: 'الماركة', zh: '品牌' } },
  { key: 'model', label: 'Model', max: 120, headers: { en: 'Model', ar: 'الموديل', zh: '车型' } },
  { key: 'year', label: 'Year', headers: { en: 'Year', ar: 'السنة', zh: '年份' } },
  { key: 'version', label: 'Version', max: 120, headers: { en: 'Version', ar: 'الفئة', zh: '版本' } },
  { key: 'engine', label: 'Engine', max: 200, headers: { en: 'Engine', ar: 'المحرك', zh: '发动机' } },
  { key: 'seats', label: 'Seats', headers: { en: 'Seats', ar: 'عدد المقاعد', zh: '座位数' } },
];
const PHOTO_HEADER = 'Vehicle Photo';
const LANGS = [['en', 'English'], ['ar', 'Arabic'], ['zh', 'Chinese']];
const MAX_ROWS = 2000;
const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;

/** The order the template uses (the same as the AITO sheet): English block, the picture, Arabic block, Chinese block. */
const TEMPLATE_HEADERS = [
  ...FIELDS.map((f) => f.headers.en), PHOTO_HEADER,
  ...FIELDS.map((f) => f.headers.ar),
  ...FIELDS.map((f) => f.headers.zh),
];

module.exports = { FIELDS, PHOTO_HEADER, LANGS, MAX_ROWS, MAX_UPLOAD_BYTES, TEMPLATE_HEADERS };
