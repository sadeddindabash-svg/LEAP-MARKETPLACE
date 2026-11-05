#!/usr/bin/env node
/**
 * The website's home page on a PHONE (under 768 px; confirmed with the person via mockup). Tablets and computers stay as they are.
 *  - Find parts for your car: less space above it, a smaller box; only Brand shows at first, Model appears once a brand is chosen, Year once a model is;
 *  - the four totals (parts, brands, models, countries): small, in one line;
 *  - "Sections" and "Brands" (shorter titles): every section and every brand in one line that slides sideways, no More tile;
 *  - Newest parts: not shown on a phone;
 *  - every gap between the blocks as small as it can be (8-12 px).
 * English and Arabic.
 *
 *   node scripts/patch-phone-home-tight.js            dry run
 *   node scripts/patch-phone-home-tight.js --write    applies it (each changed file is saved as <file>.before-phone-home-tight first)
 * Then: Ctrl+F5 on the phone's browser.   (No server change, no app change.)
 *
 * A file that is not as this patch expects is NOT changed (the whole patch stops; send that file). Windows (CRLF) line endings are handled.
 * Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created": [], "anchored": [{"file": "apps/web-storefront/app/page.tsx", "what": "home page on a phone: smaller gaps, the totals in one line, Sections and Brands sliding, no Newest parts", "done": "TileRow phoneSlide variant=\"wide\"", "pairs": [["px-4 pt-5 sm:px-8 ${showBanner", "px-4 pt-5 max-md:gap-2.5 max-md:pt-2.5 sm:px-8 ${showBanner", false], ["px-4 pt-5 sm:px-8\" aria-label=\"Leap Auto Parts\"", "px-4 pt-5 max-md:pt-2 sm:px-8\" aria-label=\"Leap Auto Parts\"", false], ["className=\"grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4\"", "className=\"grid grid-cols-2 gap-3 max-md:grid-cols-4 max-md:gap-1.5 sm:gap-4 lg:grid-cols-4\"", false], ["px-4 pt-5 sm:px-8\" aria-labelledby=\"home-sections\"", "px-4 pt-5 max-md:pt-3 sm:px-8\" aria-labelledby=\"home-sections\"", false], ["<h2 id=\"home-sections\" className=\"mb-6 text-3xl font-bold tracking-tight\">{t(lang, \"shop_by_section\")}</h2>", "<h2 id=\"home-sections\" className=\"mb-6 text-3xl font-bold tracking-tight max-md:mb-2 max-md:text-lg\"><span className=\"md:hidden\">{t(lang, \"nav_sections\")}</span><span className=\"max-md:hidden\">{t(lang, \"shop_by_section\")}</span></h2>", false], ["<TileRow variant=\"wide\"", "<TileRow phoneSlide variant=\"wide\"", false], ["px-4 pt-5 sm:px-8\" aria-labelledby=\"home-brands\"", "px-4 pt-5 max-md:pb-4 max-md:pt-3 sm:px-8\" aria-labelledby=\"home-brands\"", false], ["<h2 id=\"home-brands\" className=\"mb-6 text-3xl font-bold tracking-tight\">{t(lang, \"shop_by_brand\")}</h2>", "<h2 id=\"home-brands\" className=\"mb-6 text-3xl font-bold tracking-tight max-md:mb-2 max-md:text-lg\"><span className=\"md:hidden\">{t(lang, \"home_stat_brands\")}</span><span className=\"max-md:hidden\">{t(lang, \"shop_by_brand\")}</span></h2>", false], ["<TileRow variant=\"round\"", "<TileRow phoneSlide variant=\"round\"", false], ["pb-4 pt-5 sm:px-8\" aria-labelledby=\"home-newest\"", "pb-4 pt-5 max-md:hidden sm:px-8\" aria-labelledby=\"home-newest\"", false]]}, {"file": "apps/web-storefront/components/StatTile.tsx", "what": "the four totals: small on a phone", "done": "max-md:h-[50px]", "pairs": [["px-4 sm:px-5\"", "px-4 max-md:h-[50px] max-md:justify-center max-md:rounded-[12px] max-md:px-1 max-md:text-center sm:px-5\"", false], ["className=\"absolute -bottom-4 -end-2 text-navy opacity-[0.17]\"", "className=\"absolute -bottom-4 -end-2 text-navy opacity-[0.17] max-md:hidden\"", false], ["leading-none text-navy tabular-nums sm:text-[34px]\"", "leading-none text-navy tabular-nums max-md:text-[16px] sm:text-[34px]\"", false], ["<span className=\"mt-1 block text-[14px] font-medium text-[#3d3318] sm:text-[15px]\">", "<span className=\"mt-1 block text-[14px] font-medium text-[#3d3318] max-md:mt-0.5 max-md:truncate max-md:text-[10px] max-md:font-semibold sm:text-[15px]\">", false]]}, {"file": "apps/web-storefront/components/HeroPicker.tsx", "what": "Find parts for your car: smaller on a phone, one field at a time", "done": "onChange={setChoice} progressive />", "pairs": [["border-t-signal bg-white p-6\"", "border-t-signal bg-white p-6 max-md:p-3\"", false], ["<h2 className=\"mb-4 text-xl font-bold\">", "<h2 className=\"mb-4 text-xl font-bold max-md:mb-2 max-md:text-base\">", false], ["<VehicleCascade idPrefix=\"hp\" onChange={setChoice} />", "<VehicleCascade idPrefix=\"hp\" onChange={setChoice} progressive />", false], ["mt-4 min-h-13 w-full rounded-[10px]", "mt-4 min-h-13 w-full max-md:mt-2.5 max-md:min-h-11 rounded-[10px]", false]]}, {"file": "apps/web-storefront/components/VehicleCascade.tsx", "what": "the brand / model / year fields: one after the other on a phone (home page only)", "done": "progressive && !brandId", "pairs": [["export default function VehicleCascade({ idPrefix, onChange, withVersions = false }: { idPrefix: string; onChange: (choice: VehicleChoice | null) => void; withVersions?: boolean }) {", "// progressive (the home page's finder): on a phone only Brand shows at first; Model appears once a brand is chosen, Year once a model is (to save space).\nexport default function VehicleCascade({ idPrefix, onChange, withVersions = false, progressive = false }: { idPrefix: string; onChange: (choice: VehicleChoice | null) => void; withVersions?: boolean; progressive?: boolean }) {", false], ["<div className=\"grid gap-3 sm:grid-cols-3\">", "<div className={`grid gap-3 sm:grid-cols-3 ${progressive ? \"max-md:gap-2\" : \"\"}`}>", false], ["<div>\n        <label htmlFor={`${idPrefix}-model`}", "<div className={progressive && !brandId ? \"max-md:hidden\" : undefined}>\n        <label htmlFor={`${idPrefix}-model`}", false], ["<div>\n        <label htmlFor={`${idPrefix}-year`}", "<div className={progressive && !modelId ? \"max-md:hidden\" : undefined}>\n        <label htmlFor={`${idPrefix}-year`}", false]]}, {"file": "apps/web-storefront/components/TileRow.tsx", "what": "a row of tiles that slides sideways on a phone", "done": "const sliding = phoneSlide && phone;", "pairs": [["export default function TileRow({ children, moreLabel, fewerLabel, gridClassName, defaultColumns = 6, variant = \"classic\", maxCollapsed, phoneCollapsed }: { children: ReactNode; moreLabel: string; fewerLabel: string; gridClassName: string; defaultColumns?: number; maxCollapsed?: number; phoneCollapsed?: number; variant?: \"classic\" | \"wide\" | \"round\" }) {", "// phoneSlide (the home page, confirmed with the person): on a phone (under 768 px) every tile is in ONE line that slides sideways, with no More tile.\nexport default function TileRow({ children, moreLabel, fewerLabel, gridClassName, defaultColumns = 6, variant = \"classic\", maxCollapsed, phoneCollapsed, phoneSlide = false }: { children: ReactNode; moreLabel: string; fewerLabel: string; gridClassName: string; defaultColumns?: number; maxCollapsed?: number; phoneCollapsed?: number; phoneSlide?: boolean; variant?: \"classic\" | \"wide\" | \"round\" }) {", false], ["    if (phoneCollapsed === undefined || typeof window === \"undefined\" || typeof window.matchMedia !== \"function\") return;", "    if ((phoneCollapsed === undefined && !phoneSlide) || typeof window === \"undefined\" || typeof window.matchMedia !== \"function\") return;", false], ["  }, [phoneCollapsed]);", "  }, [phoneCollapsed, phoneSlide]);", false], ["  const fits = limit !== undefined ? tiles.length <= limit : tiles.length <= columns;           // everything fits: no \"More\" tile", "  const sliding = phoneSlide && phone;      // a phone: one sliding line, every tile, no More tile\n  const fits = sliding || (limit !== undefined ? tiles.length <= limit : tiles.length <= columns);           // everything fits: no \"More\" tile", false], ["    <ul ref={list} className={gridClassName}>\n      {tiles.map((tile, i) => <li key={i} hidden={i >= shown}>{tile}</li>)}", "    <ul ref={list} className={phoneSlide ? `${gridClassName} max-md:-mx-4 max-md:flex! max-md:snap-x max-md:snap-proximity max-md:scroll-px-4 max-md:gap-2! max-md:overflow-x-auto max-md:px-4 max-md:pb-1 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden` : gridClassName}>\n      {tiles.map((tile, i) => <li key={i} hidden={i >= shown} className={phoneSlide ? \"max-md:w-[76px] max-md:flex-none max-md:snap-start\" : undefined}>{tile}</li>)}", false]]}]};
const plan = [];
let problems = 0;
const once = (s, a) => s.split(a).length === 2;
const read = (file) => { const p = path.join(root, file); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; };
function edit(file, what, done, change) {
  const s = read(file);
  if (s === null) { console.log(`MISSING   ${file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; return; }
  if (s.replace(/\r\n/g, '\n').includes(done)) { console.log(`already   ${file}: ${what}`); return; }
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  const out = change(s.replace(/\r\n/g, '\n'));
  if (typeof out !== 'string') { console.log(`REFUSED   ${file}: ${out && out.why ? out.why : 'its text is not what this patch expects'}, so nothing was changed. Send this file.`); problems++; return; }
  plan.push({ file, what, before: s, after: out.replace(/\n/g, eol) });
}

for (const e of DATA.created) {
  const p = path.join(root, e.file);
  if (e.base64) {      // a picture: written as it is
    const bytes = Buffer.from(e.base64, 'base64');
    if (fs.existsSync(p)) {
      if (fs.readFileSync(p).equals(bytes)) { console.log(`already   ${e.file}: ${e.what}`); continue; }
      console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
    }
    if (!fs.existsSync(path.dirname(p))) { console.log(`MISSING   ${path.dirname(e.file)}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
    plan.push({ file: e.file, what: e.what, before: null, after: bytes });
    continue;
  }
  if (fs.existsSync(p)) {
    if (fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') === e.text) { console.log(`already   ${e.file}: ${e.what}`); continue; }
    console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
  }
  // a new folder (services/api/src/modules/draftPhotos) is made, but only inside one that is already there
  if (!fs.existsSync(path.dirname(path.dirname(p)))) { console.log(`MISSING   ${path.dirname(path.dirname(e.file))}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  plan.push({ file: e.file, what: e.what, before: null, after: e.text });
}
for (const e of DATA.replaced || []) {
  edit(e.file, e.what, e.done, (s) => (e.from.includes(s) ? e.text : { why: 'it is not the version patch-hub-label-design made (run that patch first, or send this file)' }));
}
for (const e of DATA.anchored) {
  // a test file: changed when it is there and as expected, otherwise left as it is (it does not stop the patch)
  if (e.optional) {
    const s = read(e.file);
    if (s === null) { console.log(`skipped   ${e.file}: not found (a test file; nothing to do)`); continue; }
    const n = s.replace(/\r\n/g, '\n');
    if (!n.includes(e.done) && (e.pairs.some(([a, , all]) => all !== 'maybe' && all !== 'alts' && !once(n, a)) || (e.block && (!n.includes(e.block.from) || !n.includes(e.block.to))))) { console.log(`skipped   ${e.file}: not as expected, left as it is (${e.what})`); continue; }
  }
  edit(e.file, e.what, e.done, (s) => {
    let out = s;
    for (const [a, b, all] of e.pairs) {
      if (all === 'alts') { const hit = a.find(([x]) => once(out, x)); if (!hit) return { why: `this part was not found: "${a[a.length - 1][0].split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(hit[0], () => hit[1]); continue; }
      if (all === 'maybe') { if (once(out, a)) out = out.replace(a, () => b); continue; }
      if (all) { if (!out.includes(a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.split(a).join(b); continue; } if (!once(out, a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(a, () => b); }
    if (e.region) {
      const r = e.region; const i = out.indexOf(r.from); const j = i < 0 ? -1 : out.indexOf(r.to, i);
      if (i < 0 || j < 0) return { why: `the part starting "${r.from.trim().slice(0, 60)}" was not found` };
      const seg = out.slice(i, j);
      if (r.must && !seg.includes(r.must)) return { why: `"${r.must}" was not found in the part starting "${r.from.trim().slice(0, 60)}"` };
      const changed = seg.replace(new RegExp(r.find, 'g'), r.repl);
      if (changed === seg) return { why: `nothing to change in the part starting "${r.from.trim().slice(0, 60)}"` };
      out = out.slice(0, i) + changed + out.slice(j);
    }
    if (e.block) {
      const i = out.indexOf(e.block.from); const j = i < 0 ? -1 : out.indexOf(e.block.to, i);
      if (i < 0 || j < 0) return { why: `the part starting "${e.block.from.trim().slice(0, 60)}" was not found` };
      out = out.slice(0, i) + e.block.text + out.slice(e.block.includeTo ? j + e.block.to.length : j);
    }
    return out;
  });
}
if (DATA.mount) edit('services/api/src/index.js', DATA.mount.what, DATA.mount.done, (s) => {
  const m = s.match(/\n([ \t]*)app\.use\('\/payouts', payoutsRoutes\);[^\n]*/);
  if (!m) return { why: "the line app.use('/payouts', payoutsRoutes); was not found" };
  const at = m.index + m[0].length;
  return s.slice(0, at) + `\n${m[1]}${DATA.mount.line}` + s.slice(at);
});
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) {
    const p = path.join(root, c.file);
    if (c.before !== null) fs.writeFileSync(`${p}.before-phone-home-tight`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: Ctrl+F5 on the phone browser.');
