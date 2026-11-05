#!/usr/bin/env node
/**
 * Storefront on a phone (and a tablet: under 1024 px, where the menu is not at the side): the My account menu opens OVER the page (confirmed with the
 * person via mockup). Every account page starts with one slim bar (the page it is on, and a gold "☰ Menu"); the menu slides in over the dimmed page,
 * the page it is on marked as now, the number of unread notifications kept; choosing a page, ✕, Escape or tapping outside closes it. Arabic: from the right.
 * Computers keep the menu at the side as now.
 *
 *   node scripts/patch-phone-account-menu.js            dry run
 *   node scripts/patch-phone-account-menu.js --write    applies it (each changed file is saved as <file>.before-phone-account-menu first)
 * Then: Ctrl+F5 on the phone (the storefront picks the change up by itself; restart it if not). No server change.
 *
 * A file that is not as this patch expects is NOT changed (the whole patch stops). Windows (CRLF) line endings are handled. Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created":[],"anchored":[{"file":"apps/web-storefront/components/AccountShell.tsx","what":"phone and tablet: the My account menu opens over the page (☰ Menu)","done":"data-testid=\"account-menu-button\"","pairs":[["import { useT } from \"./LangProvider\";\n","import { useLang, useT } from \"./LangProvider\";\n"],["  const unread = useUnread(!!user && inAccountMenu(here), here);\n","  const unread = useUnread(!!user && inAccountMenu(here), here);\n  const lang = useLang();\n  // a phone or a tablet (under 1024 px): the menu opens OVER the page from \"☰ Menu\", and closes on a page, ✕, Escape or a tap outside\n  const [open, setOpen] = useState(false);\n  useEffect(() => { setOpen(false); }, [here]);\n  useEffect(() => {\n    if (!open) return;\n    const onKey = (e: KeyboardEvent) => { if (e.key === \"Escape\") setOpen(false); };\n    const before = document.body.style.overflow;\n    document.body.style.overflow = \"hidden\";      // the page behind does not scroll while the menu is open\n    window.addEventListener(\"keydown\", onKey);\n    return () => { window.removeEventListener(\"keydown\", onKey); document.body.style.overflow = before; };\n  }, [open]);\n"],["  const marked = menuPageOf(here);","  const markedItem = ITEMS.find(([href]) => href === menuPageOf(here));\n  const marked = menuPageOf(here);"],["      <nav aria-label={t(\"account_sidebar\")} className=\"px-4 pt-6 lg:sticky lg:top-[calc(var(--header-h,0px)+1rem)] lg:w-[256px] lg:shrink-0 lg:self-start lg:pe-0 lg:ps-4 lg:pt-10\">","      {open && <button type=\"button\" aria-label={t(\"cancel\")} data-testid=\"account-menu-backdrop\" onClick={() => setOpen(false)} className=\"fixed inset-0 z-[55] bg-[#07202f]/45 lg:hidden\" />}\n      <nav id=\"account-menu\" aria-label={t(\"account_sidebar\")} className={`max-lg:fixed max-lg:inset-y-0 max-lg:start-0 max-lg:z-[60] max-lg:w-[min(85vw,320px)] max-lg:overflow-y-auto max-lg:bg-white max-lg:px-3 max-lg:pb-6 max-lg:pt-4 max-lg:shadow-[0_0_30px_rgba(7,32,47,0.3)] max-lg:transition-[transform,visibility] max-lg:duration-200 ${open ? \"\" : \"max-lg:invisible max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full\"} lg:sticky lg:top-[calc(var(--header-h,0px)+1rem)] lg:w-[256px] lg:shrink-0 lg:self-start lg:pe-0 lg:ps-4 lg:pt-10`}>"],["        <ul className=\"grid gap-1 rounded-[14px] border border-line bg-white p-2\">\n","        <div className=\"mb-2 flex items-center justify-between px-2 lg:hidden\">\n          <span className=\"text-lg font-extrabold text-ink\">{t(\"account_hub_title\")}</span>\n          <button type=\"button\" aria-label={t(\"cancel\")} onClick={() => setOpen(false)} className=\"grid size-10 place-items-center rounded-full text-[#6b7a86] hover:bg-chalk\"><svg aria-hidden=\"true\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\" strokeLinecap=\"round\"><path d=\"M6 6l12 12M18 6L6 18\" /></svg></button>\n        </div>\n        <ul className=\"grid gap-1 rounded-[14px] border border-line bg-white p-2 max-lg:border-0 max-lg:p-0\">\n"],["      <div className={`account-page min-w-0 flex-1${item && item[0] === TIER ? \"\" : \" account-themed\"}`}>\n","      <div className={`account-page min-w-0 flex-1${item && item[0] === TIER ? \"\" : \" account-themed\"}`}>\n        {/* a phone or a tablet: one slim bar (the page it is on, and ☰ Menu) instead of the whole list above the page */}\n        <div className=\"px-4 pt-3 sm:px-8 lg:hidden\">\n          <button type=\"button\" aria-expanded={open} aria-controls=\"account-menu\" data-testid=\"account-menu-button\" onClick={() => setOpen(true)} className=\"flex min-h-12 w-full items-center gap-2.5 rounded-[12px] border border-line bg-white px-3 text-start\">\n            <span aria-hidden=\"true\" className=\"grid size-7 flex-none place-items-center rounded-[8px] bg-gradient-to-br from-navy to-[#173f57] text-signal\"><Icon href={markedItem ? markedItem[0] : \"/account\"} size={16} /></span>\n            <span className=\"min-w-0 flex-1 truncate text-[15px] font-extrabold text-ink\">{t(markedItem ? markedItem[1] : \"account_hub_title\")}</span>\n            <span className=\"flex flex-none items-center gap-1.5 rounded-[9px] bg-signal px-2.5 py-1.5 text-[13px] font-extrabold text-navy\">\n              <svg aria-hidden=\"true\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2.2\" strokeLinecap=\"round\"><path d=\"M4 7h16M4 12h16M4 17h16\" /></svg>{lang === \"ar\" ? \"القائمة\" : \"Menu\"}\n              {unread > 0 && <span aria-hidden=\"true\" className=\"flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-navy px-1 text-[10.5px] text-white\">{unread > 99 ? \"99+\" : unread}</span>}\n            </span>\n          </button>\n        </div>\n"],["          <div className=\"px-4 pt-6 sm:px-8 lg:pt-10\">\n","          <div className=\"px-4 pt-3 sm:px-8 lg:pt-10\">\n",true]]}]};
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
    if (!n.includes(e.done) && (e.pairs.some(([a]) => !once(n, a)) || (e.block && (!n.includes(e.block.from) || !n.includes(e.block.to))))) { console.log(`skipped   ${e.file}: not as expected, left as it is (${e.what})`); continue; }
  }
  edit(e.file, e.what, e.done, (s) => {
    let out = s;
    for (const [a, b, all] of e.pairs) { if (all) { if (!out.includes(a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.split(a).join(b); continue; } if (!once(out, a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(a, () => b); }
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-hub-portal-redesign`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: Ctrl+F5 on the phone.');
