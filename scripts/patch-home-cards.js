#!/usr/bin/env node
/**
 * Storefront home page and product cards, as decided: "Shop by section" as wide tiles with an angled photo (4 per row); "Shop by brand" as round photos (6 per row); the four totals at the top as gold tiles with a big faint icon;
 * and on EVERY product card: a green "In stock" / red "Out of stock" box, an add-to-cart icon button, the brand logo in the photo's corner, and the discount (a tag on the photo and the old price struck through).
 * Run it AFTER scripts/patch-product-parity.js (the discount uses its lib/discount.ts and the old price in lib/api.ts).
 *
 *   node scripts/patch-home-cards.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-home-cards.js --write    applies it (each changed file is saved as <file>.before-home-cards first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/app/page.tsx", "what": "the home page: gold totals, wide section tiles with an angled photo, round brand photos", "done": "StatTile", "pairs": [["import PhotoBox from \"@/components/PhotoBox\";\n", ""], ["import Link from \"@/components/LocLink\";\n", ""], ["import TileRow from \"@/components/TileRow\";\n", "import TileRow from \"@/components/TileRow\";\nimport StatTile from \"@/components/StatTile\";\nimport SectionTile from \"@/components/SectionTile\";\nimport BrandTile from \"@/components/BrandTile\";\n"], ["const tileClass = \"flex h-full flex-col items-center gap-2.5 rounded-[14px] border border-line bg-white p-5 text-center transition-colors hover:border-signal\";\n", ""], ["          <ul className=\"grid grid-cols-2 gap-4 lg:grid-cols-4\">\n            {stats.map((s) => (\n              <li key={s.icon} className=\"flex items-center gap-4 rounded-[14px] border border-line bg-white px-5 py-4\">\n                {s.picture ? (\n                  <PhotoBox src={s.picture} className=\"size-[72px]\" sizes=\"72px\" />\n                ) : (\n                  <span className=\"grid size-[72px] flex-none place-items-center rounded-xl bg-[#e6edf2] text-[#8696a2]\">\n                    <svg aria-hidden=\"true\" width=\"32\" height=\"32\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.6\" strokeLinecap=\"round\" strokeLinejoin=\"round\">{STAT_ICONS[s.icon].map((d) => <path key={d} d={d} />)}</svg>\n                  </span>\n                )}\n                <span className=\"min-w-0\"><b className=\"block text-3xl font-extrabold leading-none text-navy\">{number(s.n)}</b><span className=\"mt-1 block text-[15px] text-muted\">{s.label}</span></span>\n              </li>\n            ))}\n          </ul>\n", "          <ul className=\"grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4\">\n            {stats.map((s) => <StatTile key={s.icon} n={number(s.n)} label={s.label} paths={STAT_ICONS[s.icon]} picture={s.picture} />)}\n          </ul>\n"], ["          <TileRow gridClassName=\"grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6\" moreLabel={t(lang, \"more_sections\")} fewerLabel={t(lang, \"show_fewer\")}>\n            {categories.map((c) => (\n              <Link key={c.id} href={`/search?category=${encodeURIComponent(c.id)}`} className={tileClass}>\n                <PhotoBox src={c.photoUrl} className=\"size-16\" sizes=\"64px\" />\n                <span className=\"line-clamp-2 w-full min-w-0 text-base font-bold [overflow-wrap:anywhere]\">{pickName(lang, c.nameEn, c.nameAr)}</span>\n              </Link>\n            ))}\n          </TileRow>\n", "          <TileRow variant=\"wide\" defaultColumns={4} gridClassName=\"grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4\" moreLabel={t(lang, \"more_sections\")} fewerLabel={t(lang, \"show_fewer\")}>\n            {categories.map((c) => <SectionTile key={c.id} href={`/search?category=${encodeURIComponent(c.id)}`} name={pickName(lang, c.nameEn, c.nameAr)} photo={c.photoUrl} />)}\n          </TileRow>\n"], ["          <TileRow gridClassName=\"grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6\" moreLabel={t(lang, \"more_brands\")} fewerLabel={t(lang, \"show_fewer\")}>\n            {brands.map((b) => (\n              <Link key={b.id} href={`/search?q=${encodeURIComponent(b.name)}`} className={tileClass}>\n                <PhotoBox src={b.photoUrl} className=\"size-16\" sizes=\"64px\" />\n                <span className=\"line-clamp-2 w-full min-w-0 text-base font-bold [overflow-wrap:anywhere]\">{pickName(lang, b.name, b.nameAr)}</span>\n              </Link>\n            ))}\n          </TileRow>\n", "          <TileRow variant=\"round\" defaultColumns={6} gridClassName=\"grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 sm:gap-x-4 lg:grid-cols-6\" moreLabel={t(lang, \"more_brands\")} fewerLabel={t(lang, \"show_fewer\")}>\n            {brands.map((b) => <BrandTile key={b.id} href={`/search?q=${encodeURIComponent(b.name)}`} name={pickName(lang, b.name, b.nameAr)} photo={b.photoUrl} />)}\n          </TileRow>\n"]]}, {"file": "apps/web-storefront/lib/api.ts", "what": "the product type carries the brand's logo", "done": "The vehicle brand's logo", "pairs": [["  originalPrice?: number | null;\n}\n\nexport interface ProductDetail extends ProductSummary {", "  originalPrice?: number | null;\n  /** The vehicle brand's logo (the brand of the car the part fits), when the brand has one: shown in the corner of a product card's photo. */\n  brandLogoUrl?: string | null;\n}\n\nexport interface ProductDetail extends ProductSummary {"]]}, {"file": "apps/web-storefront/components/CartProvider.tsx", "what": "an optional cart accessor, for buttons inside lists (they stay disabled instead of crashing when there is no cart)", "done": "useOptionalCart", "pairs": [["export function useCart(): CartContextValue {\n  const ctx = useContext(CartContext);\n  if (!ctx) throw new Error(\"useCart must be used within a CartProvider\");\n  return ctx;\n}", "export function useCart(): CartContextValue {\n  const ctx = useContext(CartContext);\n  if (!ctx) throw new Error(\"useCart must be used within a CartProvider\");\n  return ctx;\n}\n\n/** The cart, or null when there is no CartProvider above (the page always has one; this is for a button inside a list, which must never take the whole list down). */\nexport function useOptionalCart(): CartContextValue | null {\n  return useContext(CartContext);\n}"]]}], "whole": [{"file": "apps/web-storefront/components/TileRow.tsx", "what": "the More tile of a tile row can match wide tiles and round photos", "sha": "f3de0181e328d5f32cc299663236e5445ba692f8049721591a80323a60a7a261"}, {"file": "apps/web-storefront/components/ProductCard.tsx", "what": "the product card: green/red stock box, add-to-cart icon, brand logo and discount", "sha": "377bae00de9e676b5e1d81078ab4aa4f10cbf89756e632a12f19c6690a5fb674"}], "tests": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'home-cards-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'home-cards-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-home-cards`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
