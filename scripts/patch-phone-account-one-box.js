#!/usr/bin/env node
/**
 * Storefront on a phone (and a tablet, under 1024 px): ONE box at the top of each My account page (confirmed with the person via mockup): the icon in
 * its gold ring, the page title and the gold "☰ Menu" button at the end (with the number of unread notifications). The separate slim bar above it is
 * gone; a page with no title box (an order, a return) keeps the slim bar with ☰ Menu. Arabic: mirrored. Computers are unchanged.
 * Run patch-phone-account-menu.js and patch-phone-account-title-box.js first (this builds on them).
 *
 *   node scripts/patch-phone-account-one-box.js            dry run
 *   node scripts/patch-phone-account-one-box.js --write    applies it (the file is saved as <file>.before-phone-account-one-box first)
 * Then: Ctrl+F5 on the phone. No server change.
 *
 * A file that is not as this patch expects is NOT changed (the whole patch stops). Windows (CRLF) line endings are handled. Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created": [], "anchored": [{"file": "apps/web-storefront/components/AccountShell.tsx", "what": "phone: one box at the top of each account page, \u2630 Menu at its end", "done": "const menuButton = (", "pairs": [["  const marked = menuPageOf(here);", "  const marked = menuPageOf(here);\n  // \u2630 Menu (a phone or a tablet): at the end of the page's title box; on a page with no title box (an order, a return) in its own slim bar\n  const menuButton = (\n    <button type=\"button\" aria-expanded={open} aria-controls=\"account-menu\" data-testid=\"account-menu-button\" onClick={() => setOpen(true)} className=\"flex flex-none items-center gap-1.5 rounded-[9px] bg-signal px-2.5 py-1.5 text-[13px] font-extrabold text-navy lg:hidden\">\n      <svg aria-hidden=\"true\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2.2\" strokeLinecap=\"round\"><path d=\"M4 7h16M4 12h16M4 17h16\" /></svg>{lang === \"ar\" ? \"\u0627\u0644\u0642\u0627\u0626\u0645\u0629\" : \"Menu\"}\n      {unread > 0 && <span aria-hidden=\"true\" className=\"flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-navy px-1 text-[10.5px] text-white\">{unread > 99 ? \"99+\" : unread}</span>}\n    </button>\n  );"], ["              <div id=\"account-header-actions\" className=\"flex flex-wrap items-center gap-2 empty:hidden\" />\n            </header>", "              <div id=\"account-header-actions\" className=\"flex flex-wrap items-center gap-2 empty:hidden\" />\n              {menuButton}\n            </header>"], ["              {item[0] === \"/garage\" && <GarageMeter />}\n            </header>\n          </div>\n        )}\n        <div className={item", "              {item[0] === \"/garage\" && <GarageMeter />}\n              {menuButton}\n            </header>\n          </div>\n        )}\n        <div className={item"], ["px-6 py-5 text-white max-md:gap-x-3 max-md:rounded-[14px] max-md:px-3.5 max-md:py-2 sm:px-7\"", "px-6 py-5 text-white max-md:flex-nowrap max-md:gap-x-3 max-md:rounded-[14px] max-md:px-3.5 max-md:py-2 sm:px-7\""], ["bg-white px-6 py-5 max-md:rounded-[14px] max-md:px-4 max-md:py-2.5 sm:px-7\"", "bg-white px-6 py-5 max-md:flex-nowrap max-md:rounded-[14px] max-md:px-4 max-md:py-2.5 sm:px-7\""]], "block": {"from": "        {/* a phone or a tablet: one slim bar (the page it is on, and \u2630 Menu) instead of the whole list above the page */}\n", "to": "        {item && item[0] !== TIER && (\n", "text": "        {/* a phone or a tablet, on a page with no title box (an order, a return): one slim bar, the page it belongs to and \u2630 Menu */}\n        {!item && (\n          <div className=\"px-4 pt-3 sm:px-8 lg:hidden\">\n            <div className=\"flex min-h-12 w-full items-center gap-2.5 rounded-[12px] border border-line bg-white px-3\">\n              <span aria-hidden=\"true\" className=\"grid size-7 flex-none place-items-center rounded-[8px] bg-gradient-to-br from-navy to-[#173f57] text-signal\"><Icon href={markedItem ? markedItem[0] : \"/account\"} size={16} /></span>\n              <span className=\"min-w-0 flex-1 truncate text-[15px] font-extrabold text-ink\">{t(markedItem ? markedItem[1] : \"account_hub_title\")}</span>\n              {menuButton}\n            </div>\n          </div>\n        )}\n"}}]};
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
