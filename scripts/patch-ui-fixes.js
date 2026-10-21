#!/usr/bin/env node
/**
 * Storefront and server changes asked for after the part-and-car work: real home page totals, one row of sections and brands with "More", newest parts that load as you scroll,
 * a products page without the left column and with four columns, the sections menu and the find-a-part lists with photos, and the garage's two columns aligned at the top.
 * Run it AFTER scripts/patch-product-cars.js. It changes these existing files (and nothing else):
 *
 *   services/api/src/modules/catalog/routes.js    GET /catalog/stats (the four real totals)
 *   apps/web-storefront/lib/api.ts, lib/i18n.ts   the new helper and the new words (English and Arabic)
 *   apps/web-storefront/app/page.tsx              the new home page (whole file)
 *   apps/web-storefront/app/search/page.tsx       the new products page (whole file)
 *   apps/web-storefront/components/SiteHeader.tsx, VehicleFilter.tsx, FindTools.tsx, app/garage/page.tsx
 *   (and any test file listed below whose expectations changed with the screens)
 *
 *   node scripts/patch-ui-fixes.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-ui-fixes.js --write    applies it (each file is saved as <file>.before-ui-fixes first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "services/api/src/modules/catalog/routes.js", "what": "the real totals of the home page: GET /catalog/stats", "done": "loadSiteStats", "pairs": [["const { loadBuyerFit } = require('../orderVehicles/productCars');", "const { loadBuyerFit } = require('../orderVehicles/productCars');\nconst { loadSiteStats } = require('../siteStats/stats');"], ["const router = express.Router();", "const router = express.Router();\n\n// The four real totals of the storefront's home page (parts, brands, models, countries): counted by the server, public, and kept for a minute.\nrouter.get('/stats', async (req, res, next) => {\n  try {\n    res.set('Cache-Control', 'public, max-age=60');\n    res.json(await loadSiteStats(db));\n  } catch (err) {\n    next(err);\n  }\n});"]]}, {"file": "apps/web-storefront/lib/api.ts", "what": "fetchSiteStats()", "done": "fetchSiteStats", "pairs": [["export async function fetchProductById(", "/** The four real totals of the home page (counted by the server). */\nexport interface SiteStats { parts: number; brands: number; models: number; countries: number }\nexport async function fetchSiteStats(): Promise<SiteStats | null> {\n  return apiGet<SiteStats>(\"/catalog/stats\");\n}\n\nexport async function fetchProductById("]]}, {"file": "apps/web-storefront/lib/i18n.ts", "what": "the new words (English and Arabic)", "done": "home_stat_parts", "pairs": [["  confirmed_fit_for: \"Confirmed fit: {car}\",", "  confirmed_fit_for: \"Confirmed fit: {car}\",\n  home_stat_parts: \"Parts\",\n  home_stat_brands: \"Brands\",\n  home_stat_models: \"Models\",\n  home_stat_countries: \"Countries\",\n  more_sections: \"More sections\",\n  more_brands: \"More brands\",\n  show_fewer: \"Show fewer\",\n  section_filter: \"Section: {section}\","], ["  confirmed_fit_for: \"توافق مؤكد: {car}\",", "  confirmed_fit_for: \"توافق مؤكد: {car}\",\n  home_stat_parts: \"القطع\",\n  home_stat_brands: \"الماركات\",\n  home_stat_models: \"الطرازات\",\n  home_stat_countries: \"الدول\",\n  more_sections: \"المزيد من الأقسام\",\n  more_brands: \"المزيد من الماركات\",\n  show_fewer: \"عرض أقل\",\n  section_filter: \"القسم: {section}\","]]}, {"file": "apps/web-storefront/components/SiteHeader.tsx", "what": "each section in the menu with its photo beside it", "done": "PhotoBox", "pairs": [["import NavDropdown from \"./NavDropdown\";", "import NavDropdown from \"./NavDropdown\";\nimport PhotoBox from \"./PhotoBox\";"], ["w-[min(92vw,640px)] grid-cols-2 gap-1", "w-[min(92vw,600px)] grid-cols-1 gap-1"], ["shadow-lg sm:grid-cols-3", "shadow-lg sm:grid-cols-2"], ["<Link key={c.id} href={`/search?category=${encodeURIComponent(c.id)}`} className=\"rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-chalk\">{pickName(lang, c.nameEn, c.nameAr)}</Link>", "<Link key={c.id} href={`/search?category=${encodeURIComponent(c.id)}`} className=\"flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium hover:bg-chalk\"><PhotoBox src={c.photoUrl} className=\"size-10\" sizes=\"40px\" /><span className=\"min-w-0 [overflow-wrap:anywhere]\">{pickName(lang, c.nameEn, c.nameAr)}</span></Link>"]]}, {"file": "apps/web-storefront/components/VehicleFilter.tsx", "what": "the vehicle choices in a row (it now sits in a strip)", "done": "sm:grid-cols-2 lg:grid-cols-4", "pairs": [["<div className=\"space-y-2\">", "<div className=\"grid gap-2 sm:grid-cols-2 lg:grid-cols-4\">"]]}, {"file": "apps/web-storefront/app/garage/page.tsx", "what": "the cars and the Add a car box start at the same top edge", "done": "lg:items-start", "pairs": [["    <div className=\"mx-auto max-w-5xl px-4 py-10 sm:px-8\">\n      <h1 className=\"text-3xl font-bold tracking-tight text-navy\">{t(\"garage_title\")}</h1>", "    <div className=\"mx-auto max-w-5xl px-4 py-10 sm:px-8\">\n      <div className=\"flex flex-wrap items-baseline gap-x-3\"><h1 className=\"text-3xl font-bold tracking-tight text-navy\">{t(\"garage_title\")}</h1>{garage.vehicles.length > 0 && <span className=\"text-xl font-normal text-muted\">· {t(\"garage_your_cars\")} {t(\"garage_count_of\", { n: garage.vehicles.length, max: MAX_GARAGE_VEHICLES })}</span>}</div>"], ["<h2 id=\"g-cars\" className=\"mb-4 text-xl font-bold text-navy\">", "<h2 id=\"g-cars\" className=\"sr-only\">"], ["<div className=\"grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]\">", "<div className=\"grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start\">"]]}, {"file": "apps/web-storefront/components/FindTools.tsx", "what": "the photo beside each section and each part", "done": "PhotoBox", "pairs": [["import { useLang, useT } from \"./LangProvider\";", "import { useLang, useT } from \"./LangProvider\";\nimport PhotoBox from \"./PhotoBox\";"], ["<li key={c.id}><button type=\"button\" onClick={() => chooseSection(c)} className=\"flex min-h-16 w-full items-center rounded-xl border-[1.5px] border-line bg-white px-4 text-start font-bold hover:border-navy\">{pickName(lang, c.nameEn, c.nameAr)}</button></li>", "<li key={c.id}><button type=\"button\" onClick={() => chooseSection(c)} className=\"flex min-h-20 w-full items-center gap-3 rounded-xl border-[1.5px] border-line bg-white px-3 text-start font-bold hover:border-navy\"><PhotoBox src={c.photoUrl} className=\"size-14\" sizes=\"56px\" /><span className=\"min-w-0 [overflow-wrap:anywhere]\">{pickName(lang, c.nameEn, c.nameAr)}</span></button></li>"], ["                  <button type=\"button\" onClick={() => router.push(searchHref({ category: section.id, part: p.nameEn }, car))} className=\"flex min-h-16 w-full items-center rounded-xl border-[1.5px] border-line bg-white px-4 text-start font-bold hover:border-navy\">\n                    {pickName(lang, p.nameEn, p.nameAr)}\n                  </button>", "                  <button type=\"button\" onClick={() => router.push(searchHref({ category: section.id, part: p.nameEn }, car))} className=\"flex min-h-20 w-full items-center gap-3 rounded-xl border-[1.5px] border-line bg-white px-3 text-start font-bold hover:border-navy\">\n                    <PhotoBox src={p.photoUrl} className=\"size-14\" sizes=\"56px\" /><span className=\"min-w-0 [overflow-wrap:anywhere]\">{pickName(lang, p.nameEn, p.nameAr)}</span>\n                  </button>"]]}], "whole": [{"file": "apps/web-storefront/app/page.tsx", "what": "the new home page (real totals, one row of sections and brands, newest parts that load as you scroll)", "sha": "ccd1902ab43732b0d4fd1c61533775c8f1de3bc5ac5d4c76e6b332a9a64def02"}, {"file": "apps/web-storefront/app/search/page.tsx", "what": "the new products page (no left column, the vehicle in a strip, four columns)", "sha": "2646f47d22e52c4d1a08c27871fe0fc387072af5313f96bc8516702f12f84557"}], "tests": [{"file": "apps/web-storefront/app/pages-i18n.test.tsx", "what": "the home page tests, for the new home page (the real totals, no See all links, More tiles)", "sha": "d192ff4a4c4b29438b9cf314f8242912c12f99ec8cd8c0207a0bcbac5797ef2d"}]};
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const once = (s, a) => s.split(a).length === 2;

const plan = [];
let problems = 0;
const refuse = (file, why) => { console.log(`REFUSED   ${file}: ${why}`); problems++; };
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  if (s.includes(e.done)) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  let out = s;
  for (const [a, b] of e.pairs) { if (!once(out, a)) { out = null; break; } out = out.replace(a, () => b); }
  if (out === null) { refuse(e.file, 'its text is not what this patch expects, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: out });
}
for (const e of DATA.whole) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'ui-fixes', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'ui-fixes', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-ui-fixes`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
