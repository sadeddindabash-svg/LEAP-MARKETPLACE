// The layout of the parts catalog sheet: the "Part types" sheet of Leap_Parts_Catalog.xlsx. Columns are found by their HEADER NAME, not by position, so a reordered or
// extended sheet still works; the first row (within the first 10) holds the headers.
const SHEET_NAME = 'Part types';
const MAX_ROWS = 3000;
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;

// the positions a product can have: the same list as the supplier side (supplier/productValidation.js)
const POSITIONS = ['Front', 'Rear', 'Left', 'Right', 'Front-Left', 'Front-Right', 'Rear-Left', 'Rear-Right', 'Universal'];

// key -> { header, required, max }
const COLUMNS = {
  mainCode: { header: 'Main Category Code', required: true },
  mainEn: { header: 'Main Category (English)', required: true, max: 60 },
  mainAr: { header: 'Main Category (Arabic)', required: true, max: 120 },
  mainZh: { header: 'Main Category (Chinese)', required: true, max: 120 },
  partCode: { header: 'Part Code', required: true },
  subEn: { header: 'Sub Category (English)', required: true, max: 120 },
  subAr: { header: 'Sub Category (Arabic)', required: true, max: 160 },
  subZh: { header: 'Sub Category (Chinese)', required: true, max: 160 },
  varEn: { header: 'Variant (English)', max: 60 },
  varAr: { header: 'Variant (Arabic)', max: 80 },
  varZh: { header: 'Variant (Chinese)', max: 80 },
  positions: { header: 'Allowed Positions', required: true },
  placeEn: { header: 'Placement (English)', max: 80 },
  placeAr: { header: 'Placement (Arabic)', max: 120 },
  placeZh: { header: 'Placement (Chinese)', max: 120 },
  length: { header: 'Length (cm)', required: true },
  width: { header: 'Width (cm)', required: true },
  height: { header: 'Height (cm)', required: true },
  weight: { header: 'Weight (kg)', required: true },
  applies: { header: 'Applies To', max: 80 },
  special: { header: 'Special Shipping', max: 300 },
  basis: { header: 'Size Basis', required: true },
  kwEn: { header: 'Search Keywords (English)', max: 500 },
  kwAr: { header: 'Search Keywords (Arabic)', max: 500 },
  kwZh: { header: 'Search Keywords (Chinese)', max: 500 },
};
const TEMPLATE_HEADERS = Object.values(COLUMNS).map((c) => c.header);

module.exports = { SHEET_NAME, MAX_ROWS, MAX_UPLOAD_BYTES, POSITIONS, COLUMNS, TEMPLATE_HEADERS };
