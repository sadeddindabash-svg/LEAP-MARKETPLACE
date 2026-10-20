#!/usr/bin/env node
/**
 * Plugs the new "Import from Excel" and "Edit details" tabs into the existing Categories page of the admin dashboard. It changes ONE file, apps/admin-dashboard/src/App.jsx, in two places:
 *   1. one import line:                     import CategoriesTabs from "./CategoriesTabs";
 *   2. the Categories page keeps its code, but is renamed CategoriesPageMain; a 3-line CategoriesPage now wraps it with the tabs (everything that used CategoriesPage still does).
 *
 *   node scripts/patch-catalog-admin-screens.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-catalog-admin-screens.js --write    applies it (App.jsx is saved as App.jsx.before-catalog-screens first)
 *
 * It refuses to change a file whose text is not exactly what it expects (so it can never half-apply), and says "already applied" when it was done before.
 */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'apps', 'admin-dashboard', 'src', 'App.jsx');
const write = process.argv.includes('--write');
if (!fs.existsSync(file)) { console.log('MISSING   apps/admin-dashboard/src/App.jsx: not found. Run this from the project root.'); process.exit(1); }
let s = fs.readFileSync(file, 'utf8');
if (s.includes('CategoriesTabs')) { console.log('already   App.jsx: the tabs are plugged in (nothing to do)'); process.exit(0); }

const IMPORT_ANCHOR = 'import VehicleImportPanel from "./VehicleImportPanel";';
const PAGE_ANCHOR = 'function CategoriesPage({ onSessionExpired }) {';
const count = (a) => s.split(a).length - 1;
if (count(IMPORT_ANCHOR) !== 1 || count(PAGE_ANCHOR) !== 1) {
  console.log(`REFUSED   App.jsx: its text is not what this patch expects (import line found ${count(IMPORT_ANCHOR)}x, page found ${count(PAGE_ANCHOR)}x; each must be exactly once). Nothing was changed. Send this file to the Leap team.`);
  process.exit(1);
}
s = s.replace(IMPORT_ANCHOR, `${IMPORT_ANCHOR}\nimport CategoriesTabs from "./CategoriesTabs";`);
s = s.replace(PAGE_ANCHOR, `function CategoriesPage({ onSessionExpired }) {
  return <CategoriesTabs main={<CategoriesPageMain onSessionExpired={onSessionExpired} />} onSessionExpired={onSessionExpired} />;
}
function CategoriesPageMain({ onSessionExpired }) {`);
if (write) { fs.writeFileSync(`${file}.before-catalog-screens`, fs.readFileSync(file)); fs.writeFileSync(file, s); console.log('patched   App.jsx: the Categories page now has the Import from Excel and Edit details tabs (backup: App.jsx.before-catalog-screens)'); }
else console.log('would     App.jsx: add the tabs to the Categories page\n\nDry run only. Add --write to apply.');
