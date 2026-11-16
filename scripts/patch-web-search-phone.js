#!/usr/bin/env node
/**
 * Website on a phone, the search page (confirmed with the person via mockup); a tablet and a PC stay as they are:
 *  - at the top: "Parts Fit with my Car" (when there is a garage car);
 *  - box 1, Your car: only Brand; Model shows once a brand is chosen, Year once a model is chosen;
 *  - box 2: only Section; Part shows once a section is chosen;
 *  - box 3: Price, Delivery and Sort on one line (the label small above the value);
 *  - no second search box (the one at the top stays), no "Browse all parts" title, no "9 parts found" line; every gap 8 px.
 *
 *   node scripts/patch-web-search-phone.js            dry run
 *   node scripts/patch-web-search-phone.js --write    applies it (each changed file is saved as <file>.before-patch-web-search-phone first)
 * Then: website: Ctrl+F5
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/web-storefront/app/search/page.tsx", "what": "website search page on a phone: no second search box, no title or count, 8 px gaps", "done": "px-2 pb-8 pt-2 sm:px-6 sm:py-10", "pairs": [["    <div>\n      <h1 className=\"text-2xl font-extrabold", "    <div className=\"max-sm:hidden\">          {/* on a phone the title and the number of parts are not shown (the filters and the chips say what is shown) */}\n      <h1 className=\"text-2xl font-extrabold", false], ["<div className=\"mx-auto max-w-7xl px-6 py-10\">\n      <form action={localizePath(lang, \"/search\")} className=\"mb-8\">", "<div className=\"mx-auto max-w-7xl px-2 pb-8 pt-2 sm:px-6 sm:py-10\">\n      {/* on a phone there is no second search box: the one at the top of the page is enough */}\n      <form action={localizePath(lang, \"/search\")} className=\"mb-8 max-sm:hidden\">", false], ["<Suspense fallback={<div className=\"mb-6\">{heading}</div>}>", "<Suspense fallback={<div className=\"mb-2 sm:mb-6\">{heading}</div>}>", false], ["gridClassName=\"grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4\"", "gridClassName=\"grid grid-cols-2 gap-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4\"", false]]}, {"file": "apps/web-storefront/components/SearchFilters.tsx", "what": "website search filters on a phone: three boxes (car, section and part, price delivery sort), each next step shown only once the one before is chosen", "done": "{stack ? \"max-sm:hidden\" : \"\"}", "pairs": [["function Drop({ id, label, value, active, open, setOpen, disabled, alignEnd, children }: {\n  id: string; label: string; value: string; active: boolean; open: string | null; setOpen: (v: string | null) => void; disabled?: boolean; alignEnd?: boolean; children: React.ReactNode;\n}) {\n  const isOpen = open === id;\n  return (\n    <div className=\"relative\" data-drop={id}>\n      <button type=\"button\" aria-haspopup=\"true\" aria-expanded={isOpen} disabled={disabled} onClick={() => setOpen(isOpen ? null : id)}\n        className={`${pill} ${active ? \"border-navy bg-[#f4f8fb] text-ink\" : \"border-[#c5d0d8] bg-white text-ink\"} disabled:cursor-not-allowed disabled:opacity-50`}>\n        <span className=\"font-medium text-muted\">{label}:</span><span className=\"max-w-[12rem] truncate\">{value}</span>\n        <svg aria-hidden=\"true\" width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" className={`text-muted transition-transform ${isOpen ? \"rotate-180\" : \"\"}`}>", "// On a phone: phoneHidden hides a step until the one before it is chosen; stack puts the label small above the value, so three fit on one line.\n// Every panel opens under its box, as wide as the box (the box is the one positioned on a phone), so it never runs off the screen.\nfunction Drop({ id, label, value, active, open, setOpen, disabled, alignEnd, phoneHidden, stack, children }: {\n  id: string; label: string; value: string; active: boolean; open: string | null; setOpen: (v: string | null) => void; disabled?: boolean; alignEnd?: boolean; phoneHidden?: boolean; stack?: boolean; children: React.ReactNode;\n}) {\n  const isOpen = open === id;\n  return (\n    <div className={`relative max-sm:static ${stack ? \"min-w-0\" : \"\"} ${phoneHidden ? \"max-sm:hidden\" : \"\"}`} data-drop={id}>\n      <button type=\"button\" aria-haspopup=\"true\" aria-expanded={isOpen} disabled={disabled} onClick={() => setOpen(isOpen ? null : id)}\n        className={`${pill} ${stack ? \"max-sm:grid max-sm:w-full max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-1 max-sm:gap-y-0 max-sm:px-2 max-sm:py-1 max-sm:text-start max-sm:leading-tight\" : \"\"} ${active ? \"border-navy bg-[#f4f8fb] text-ink\" : \"border-[#c5d0d8] bg-white text-ink\"} disabled:cursor-not-allowed disabled:opacity-50`}>\n        <span className={`font-medium text-muted ${stack ? \"max-sm:col-start-1 max-sm:text-[11px]\" : \"\"}`}>{label}<span className={stack ? \"max-sm:hidden\" : \"\"}>:</span></span><span className={`max-w-[12rem] truncate ${stack ? \"max-sm:col-start-1 max-sm:max-w-full\" : \"\"}`}>{value}</span>\n        <svg aria-hidden=\"true\" width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" className={`text-muted transition-transform ${stack ? \"max-sm:col-start-2 max-sm:row-span-2 max-sm:row-start-1 max-sm:self-center\" : \"\"} ${isOpen ? \"rotate-180\" : \"\"}`}>", false], ["{isOpen && <div role=\"dialog\" aria-label={label} className={`${pop} ${alignEnd ? \"start-auto end-0\" : \"\"}`}>{children}</div>}", "{isOpen && <div role=\"dialog\" aria-label={label} className={`${pop} ${alignEnd ? \"sm:start-auto sm:end-0\" : \"\"} max-sm:inset-x-0 max-sm:w-auto`}>{children}</div>}", false], ["    <div ref={root} className=\"mb-6\">\n      <div className=\"mb-4 flex flex-wrap items-end justify-between gap-4\">\n        <div className=\"min-w-0\">{heading}</div>\n        <div className=\"empty:hidden min-w-64\"><FitsMyCarToggle /></div>\n      </div>\n\n      <div className=\"rounded-xl border border-line bg-white\">", "    <div ref={root} className=\"mb-2 sm:mb-6\">\n      {/* On a phone the title is not shown: only \"Parts Fit with my Car\" (when there is a garage car), at the very top. */}\n      <div className=\"flex flex-wrap items-end justify-between gap-4 sm:mb-4\">\n        <div className=\"min-w-0 max-sm:hidden\">{heading}</div>\n        <div className=\"empty:hidden max-sm:mb-2 max-sm:w-full sm:min-w-64\"><FitsMyCarToggle /></div>\n      </div>\n\n      {/* On a tablet or a PC one box of two lines; on a phone three boxes, 8 px apart: the car, then section and part, then price, delivery and sort. */}\n      <div className=\"max-sm:grid max-sm:gap-2 sm:rounded-xl sm:border sm:border-line sm:bg-white\">", false], ["className=\"flex flex-wrap items-center gap-2 border-b border-line p-2.5\">\n        <span className=\"px-1 text-sm font-bold text-navy\">{t(\"sf_your_car\")}</span>", "className=\"relative flex flex-wrap items-center gap-2 border-line p-2 max-sm:rounded-xl max-sm:border max-sm:bg-white sm:border-b sm:p-2.5\">\n        <span className=\"px-1 text-sm font-bold text-navy max-sm:w-full\">{t(\"sf_your_car\")}</span>", false], ["active={!!carModel} open={open} setOpen={setOpen} disabled={!carBrand}>", "active={!!carModel} open={open} setOpen={setOpen} disabled={!carBrand} phoneHidden={!carBrand}>", false], ["active={!!yearParam} open={open} setOpen={setOpen} disabled={!carModel}>", "active={!!yearParam} open={open} setOpen={setOpen} disabled={!carModel} phoneHidden={!carModel}>", false], ["<div role=\"group\" aria-label={t(\"sf_filters\")} className=\"flex flex-wrap items-center gap-2 p-2.5\">\n        <Drop id=\"section\"", "<div role=\"group\" aria-label={t(\"sf_filters\")} className=\"max-sm:contents sm:flex sm:flex-wrap sm:items-center sm:gap-2 sm:p-2.5\">\n        <div className=\"max-sm:relative max-sm:flex max-sm:flex-wrap max-sm:gap-2 max-sm:rounded-xl max-sm:border max-sm:border-line max-sm:bg-white max-sm:p-2 sm:contents\">\n        <Drop id=\"section\"", false], ["active={!!part} open={open} setOpen={setOpen} disabled={!category}>", "active={!!part} open={open} setOpen={setOpen} disabled={!category} phoneHidden={!category}>", false], ["        </Drop>\n        <Drop id=\"price\" label={t(\"sf_price\")} value={priceText ?? t(\"sf_any_price\")} active={!!priceText} open={open} setOpen={setOpen}>", "        </Drop>\n        </div>\n        <div className=\"max-sm:relative max-sm:grid max-sm:grid-cols-3 max-sm:gap-1.5 max-sm:rounded-xl max-sm:border max-sm:border-line max-sm:bg-white max-sm:p-2 sm:contents\">\n        <Drop id=\"price\" label={t(\"sf_price\")} value={priceText ?? t(\"sf_any_price\")} active={!!priceText} open={open} setOpen={setOpen} stack>", false], ["active={!!deliveryText} open={open} setOpen={setOpen}>", "active={!!deliveryText} open={open} setOpen={setOpen} stack>", false], ["        <div className=\"ms-auto\">\n          <Drop id=\"sort\" label={t(\"sf_sort\")} value={t(sortKey)} active={!!extra.sort} open={open} setOpen={setOpen} alignEnd>", "        <div className=\"min-w-0 sm:ms-auto\">\n          <Drop id=\"sort\" label={t(\"sf_sort\")} value={t(sortKey)} active={!!extra.sort} open={open} setOpen={setOpen} alignEnd stack>", false], ["          </Drop>\n        </div>\n      </div>\n      </div>\n\n      <div className=\"mt-3 flex flex-wrap items-center gap-2\">", "          </Drop>\n        </div>\n        </div>\n      </div>\n      </div>\n\n      <div className=\"mt-2 flex flex-wrap items-center gap-2 sm:mt-3\">", false]]}]};
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
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
  edit(e.file, e.what, e.done, (s) => (e.from.includes(s) ? e.text : { why: 'it is not the version this patch expects (send this file)' }));
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-web-search-phone`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: website: Ctrl+F5');
