#!/usr/bin/env node
/**
 * Photos for the four tiles of the home page (Parts, Brands, Models, Countries): the admin portal gets a "Home page pictures" card (choose a picture, crop it to a square, replace or remove it),
 * the server keeps the four pictures, and the storefront shows them (72 px tiles; a slot with no picture keeps its icon). Run it AFTER scripts/patch-ui-columns.js. It changes these existing files
 * (and nothing else):
 *
 *   services/api/src/modules/platform-settings/routes.js   mounts the new /platform-settings/home-pictures routes
 *   apps/web-storefront/lib/api.ts, app/page.tsx           the helper and the home page tiles
 *   apps/web-storefront/app/pages-i18n.test.tsx            the existing home page test learns the new call
 *   apps/admin-dashboard/src/App.jsx                       the new card, next to "Home page announcements"
 *
 *   node scripts/patch-home-pictures.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-home-pictures.js --write    applies it (each file is saved as <file>.before-home-pictures first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "services/api/src/modules/platform-settings/routes.js", "what": "mount the four home page pictures: /platform-settings/home-pictures", "done": "homePictures", "pairs": [["const router = express.Router();", "const router = express.Router();\n\n// The four pictures beside Parts / Brands / Models / Countries on the home page (see homePictures.js).\nrouter.use('/home-pictures', require('./homePictures'));"]]}, {"file": "apps/web-storefront/lib/api.ts", "what": "fetchHomePictures(): the pictures of the four home page tiles", "done": "fetchHomePictures", "pairs": [["/** The four real totals of the home page (counted by the server). */", "/** The pictures the admin chose for the four home page tiles (an address, or null: the tile then shows its icon). */\nexport interface HomePictures { parts: string | null; brands: string | null; models: string | null; countries: string | null }\nexport async function fetchHomePictures(): Promise<HomePictures | null> {\n  const data = await apiGet<{ pictures: HomePictures }>(\"/platform-settings/home-pictures\");\n  return data?.pictures ?? null;\n}\n\n/** The four real totals of the home page (counted by the server). */"]]}, {"file": "apps/web-storefront/app/page.tsx", "what": "the four tiles show the admin's pictures (72 px), or their icon", "done": "fetchHomePictures", "pairs": [["import { fetchAnnouncements, fetchCategories, fetchProducts, fetchSiteStats, fetchVehicleBrands } from \"@/lib/api\";", "import { fetchAnnouncements, fetchCategories, fetchHomePictures, fetchProducts, fetchSiteStats, fetchVehicleBrands } from \"@/lib/api\";"], ["const [categories, products, brands, announcements, totals] = await Promise.all([fetchCategories(), fetchProducts({ sort: \"newest\", lang }), fetchVehicleBrands(), fetchAnnouncements(), fetchSiteStats()]);", "const [categories, products, brands, announcements, totals, pictures] = await Promise.all([fetchCategories(), fetchProducts({ sort: \"newest\", lang }), fetchVehicleBrands(), fetchAnnouncements(), fetchSiteStats(), fetchHomePictures()]);"], ["{ icon: \"parts\", n: totals.parts, label: t(lang, \"home_stat_parts\") }, { icon: \"brands\", n: totals.brands, label: t(lang, \"home_stat_brands\") },", "{ icon: \"parts\", n: totals.parts, picture: pictures?.parts ?? null, label: t(lang, \"home_stat_parts\") }, { icon: \"brands\", n: totals.brands, picture: pictures?.brands ?? null, label: t(lang, \"home_stat_brands\") },"], ["{ icon: \"models\", n: totals.models, label: t(lang, \"home_stat_models\") }, { icon: \"countries\", n: totals.countries, label: t(lang, \"home_stat_countries\") },", "{ icon: \"models\", n: totals.models, picture: pictures?.models ?? null, label: t(lang, \"home_stat_models\") }, { icon: \"countries\", n: totals.countries, picture: pictures?.countries ?? null, label: t(lang, \"home_stat_countries\") },"], ["                <span className=\"grid size-14 flex-none place-items-center rounded-xl bg-[#e6edf2] text-[#8696a2]\">\n                  <svg aria-hidden=\"true\" width=\"28\" height=\"28\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.6\" strokeLinecap=\"round\" strokeLinejoin=\"round\">{STAT_ICONS[s.icon].map((d) => <path key={d} d={d} />)}</svg>\n                </span>", "                {s.picture ? (\n                  <PhotoBox src={s.picture} className=\"size-[72px]\" sizes=\"72px\" />\n                ) : (\n                  <span className=\"grid size-[72px] flex-none place-items-center rounded-xl bg-[#e6edf2] text-[#8696a2]\">\n                    <svg aria-hidden=\"true\" width=\"32\" height=\"32\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.6\" strokeLinecap=\"round\" strokeLinejoin=\"round\">{STAT_ICONS[s.icon].map((d) => <path key={d} d={d} />)}</svg>\n                  </span>\n                )}"]]}, {"file": "apps/web-storefront/app/pages-i18n.test.tsx", "what": "the existing home page test learns the new call", "done": "fetchHomePictures", "pairs": [["  fetchSiteStats: vi.fn(async () => ({ parts: 1284, brands: 48, models: 312, countries: 39 })),\n", "  fetchSiteStats: vi.fn(async () => ({ parts: 1284, brands: 48, models: 312, countries: 39 })),\n  fetchHomePictures: vi.fn(async () => ({ parts: null, brands: null, models: null, countries: null })),\n"]]}, {"file": "apps/admin-dashboard/src/App.jsx", "what": "the Home page pictures card, next to Home page announcements", "done": "HomePicturesSection", "pairs": [["import { FONT_IMPORT, C, disp, body, mono } from \"./theme\";", "import { FONT_IMPORT, C, disp, body, mono } from \"./theme\";\nimport HomePicturesSection from \"./HomePicturesSection\";"], ["          <AnnouncementsSection onSessionExpired={onSessionExpired} />\n        </div>", "          <AnnouncementsSection onSessionExpired={onSessionExpired} />\n          <HomePicturesSection onSessionExpired={onSessionExpired} />\n        </div>"]]}], "whole": [], "tests": []};
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
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-home-pictures`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
