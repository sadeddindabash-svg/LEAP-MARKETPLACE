#!/usr/bin/env node
/**
 * Admin dashboard: Catalog moderation (one product and bulk) and the All Products edit form follow the minimum product name lengths set in
 * All Products > Product requirements (English and Arabic), instead of a fixed 25, in the counters and in the server's check.
 * Apply after patch-position-optional.js.
 *
 *   node scripts/patch-admin-name-minimums.js            dry run
 *   node scripts/patch-admin-name-minimums.js --write    applies it (each file is saved as <file>.before-admin-name-minimums first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"apps/admin-dashboard/src/App.jsx","what":"Catalog moderation and All Products edit: the name counters use the minimums from the settings","done":"(min {nameMins.en})","pairs":[["  // Attributes: removed from the moderation review (not used any more).\n","  // Attributes: removed from the moderation review (not used any more).\n  // The minimum name lengths set in All Products > Product requirements (English, Arabic): the reviewed names follow them.\n  const [nameMins, setNameMins] = useState({ en: 15, ar: 15 });\n  useEffect(() => {\n    fetchProductRequirements().then((r) => setNameMins({ en: r.nameMinEn ?? 15, ar: r.nameMinAr ?? 15 })).catch(() => {});\n  }, []);\n"],["nameEn.length > 0 && (nameEn.length < 25 || nameEn.length > 100) ? C.red : C.muted }}>{nameEn.length}/100 (min 25)</span>","nameEn.length > 0 && (nameEn.length < nameMins.en || nameEn.length > 100) ? C.red : C.muted }}>{nameEn.length}/100 (min {nameMins.en})</span>"],["nameAr.length > 0 && (nameAr.length < 25 || nameAr.length > 100) ? C.red : C.muted }}>{nameAr.length}/100 (min 25)</span>","nameAr.length > 0 && (nameAr.length < nameMins.ar || nameAr.length > 100) ? C.red : C.muted }}>{nameAr.length}/100 (min {nameMins.ar})</span>"],["  const [oemNumber, setOemNumber] = useState(\"\");\n","  const [oemNumber, setOemNumber] = useState(\"\");\n  // The minimum name lengths set in All Products > Product requirements (English, Arabic): the reviewed names follow them.\n  const [nameMins, setNameMins] = useState({ en: 15, ar: 15 });\n  useEffect(() => {\n    fetchProductRequirements().then((r) => setNameMins({ en: r.nameMinEn ?? 15, ar: r.nameMinAr ?? 15 })).catch(() => {});\n  }, []);\n"],["color: nameEn.length < 25 || nameEn.length > 100 ? C.red : C.muted }}>{nameEn.length}/100 (min 25)</span>","color: nameEn.length < nameMins.en || nameEn.length > 100 ? C.red : C.muted }}>{nameEn.length}/100 (min {nameMins.en})</span>"],["color: nameAr.length < 25 || nameAr.length > 100 ? C.red : C.muted }}>{nameAr.length}/100 (min 25)</span>","color: nameAr.length < nameMins.ar || nameAr.length > 100 ? C.red : C.muted }}>{nameAr.length}/100 (min {nameMins.ar})</span>"]]},{"file":"services/api/src/modules/catalog/routes.js","what":"moderation (one and bulk) and admin edit check the names against the settings","done":"the name minimums set in All Products (English, Arabic)","pairs":[["const { ALLOWED_POSITIONS, MIN_PRODUCT_PHOTOS, validateNameLength, validateDescriptionLength, validateProductAttributes } = require('../shared/productValidation');","const { ALLOWED_POSITIONS, MIN_PRODUCT_PHOTOS, validateNameLength, validateDescriptionLength, validateProductAttributes, supplierNameMinimums } = require('../shared/productValidation');"],["      const nameLengthErrors = [];\n      const enError = validateNameLength(nameEn, 'nameEn');\n      if (enError) nameLengthErrors.push(enError);\n      const arError = validateNameLength(nameAr, 'nameAr');","      const nameMins = supplierNameMinimums((await db.query('SELECT * FROM product_requirements WHERE id = 1')).rows[0]);      // the name minimums set in All Products (English, Arabic)\n      const nameLengthErrors = [];\n      const enError = validateNameLength(nameEn, 'nameEn', nameMins.en);\n      if (enError) nameLengthErrors.push(enError);\n      const arError = validateNameLength(nameAr, 'nameAr', nameMins.ar);"],["        const nameLengthErrors = [];\n        const enError = validateNameLength(nameEn, 'nameEn');\n        if (enError) nameLengthErrors.push(enError);\n        const arError = validateNameLength(nameAr, 'nameAr');","        const nameMins = supplierNameMinimums((await db.query('SELECT * FROM product_requirements WHERE id = 1')).rows[0]);      // the name minimums set in All Products (English, Arabic)\n        const nameLengthErrors = [];\n        const enError = validateNameLength(nameEn, 'nameEn', nameMins.en);\n        if (enError) nameLengthErrors.push(enError);\n        const arError = validateNameLength(nameAr, 'nameAr', nameMins.ar);"],["    if (nameEn !== undefined) {\n      const nameEnError = validateNameLength(nameEn, 'nameEn');","    const nameMins = supplierNameMinimums((await db.query('SELECT * FROM product_requirements WHERE id = 1')).rows[0]);      // the name minimums set in All Products (English, Arabic)\n    if (nameEn !== undefined) {\n      const nameEnError = validateNameLength(nameEn, 'nameEn', nameMins.en);"],["      const nameArError = validateNameLength(nameAr, 'nameAr');","      const nameArError = validateNameLength(nameAr, 'nameAr', nameMins.ar);"]]},{"file":"services/api/src/modules/shared/productValidation.js","what":"the name check takes the minimum to use","done":"function validateNameLength(name, fieldLabel, min = MIN_NAME_LENGTH)","pairs":[["function validateNameLength(name, fieldLabel) {\n  return validateTextLength(name, fieldLabel, MIN_NAME_LENGTH, MAX_NAME_LENGTH);","// min: the minimum set by the admin for the language (All Products > Product requirements); MIN_NAME_LENGTH when not given.\nfunction validateNameLength(name, fieldLabel, min = MIN_NAME_LENGTH) {\n  return validateTextLength(name, fieldLabel, min, MAX_NAME_LENGTH);"]]}],"created":[{"file":"apps/admin-dashboard/src/nameMinimums.wiring.test.js","what":"the test","text":"import { readFileSync } from \"node:fs\";\nimport { describe, expect, it } from \"vitest\";\n\n// Catalog moderation and the All Products edit form follow the name minimums set in All Products > Product requirements. Reads the source text.\ndescribe(\"Admin name minimums follow the settings\", () => {\n  const app = readFileSync(\"src/App.jsx\", \"utf8\");\n  it(\"no fixed minimum of 25 for the names\", () => {\n    expect(app).not.toContain(\"/100 (min 25)\");\n    expect(app).toContain(\"(min {nameMins.en})\");\n    expect(app).toContain(\"(min {nameMins.ar})\");\n  });\n});\n"}]};
const once = (s, a) => s.split(a).length === 2;
const plan = [];
let problems = 0;
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const c = (x) => (s.includes('\r\n') ? x.replace(/\r?\n/g, '\r\n') : x);
  if (s.includes(c(e.done))) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  let out = s;
  for (const [a0, b0] of e.pairs) { const a = c(a0), b = c(b0); if (!once(out, a)) { out = null; break; } out = out.replace(a, () => b); }
  if (out === null) { console.log(`REFUSED   ${e.file}: its text is not what this patch expects, so nothing was changed. Send this file.`); problems++; continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: out });
}
for (const e of DATA.created) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(path.dirname(p))) { console.log(`MISSING   ${path.dirname(e.file)}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  if (fs.existsSync(p)) {
    const s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    if (s === e.text) { console.log(`already   ${e.file}: ${e.what}`); continue; }
    console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
  }
  plan.push({ file: e.file, what: e.what, before: null, after: e.text });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) {
    const p = path.join(root, c.file);
    if (c.before !== null) fs.writeFileSync(`${p}.before-admin-name-minimums`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Restart the API (scripts\\start-all.cmd), then reload the admin dashboard with Ctrl+F5.');
