#!/usr/bin/env node
/**
 * Website, the account menu's pages (option C): every page starts right next to the menu (32 px from it) instead of in the middle of the space beside it, and
 * all of them have the same width (the widest page's, My garage), so their edges line up as the buyer moves through the menu. Mirrored in Arabic. On a
 * phone nothing changes. Needs patch-account-menu first.
 *
 *   node scripts/patch-account-menu-gap.js            dry run
 *   node scripts/patch-account-menu-gap.js --write    applies it (each changed file is saved as <file>.before-account-menu-gap first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"apps/web-storefront/components/AccountShell.tsx","what":"pages next to the menu, one width","done":".account-page > * { margin-inline-start: 0 !important;","pairs":[["];\n\n","];\n\n// Beside the menu every page starts 32 px from it (its own side padding) and has the same width (the widest of them, My garage: 1024 px, so no page gets narrower), so their edges line up\n// as the buyer moves through the menu. The pages themselves are not changed: this only places them. On a phone the pages are as they are.\nconst PAGE_PLACE_CSS = `@media (min-width: 1024px) { .account-page > * { margin-inline-start: 0 !important; margin-inline-end: auto !important; max-width: 64rem !important; } }`;\n\n"],["    <div className=\"lg:flex lg:items-start\">\n      <nav aria-label={t(\"account_sidebar\")} className=\"px-4 pt-6 lg:sticky lg:top-4 lg:w-[256px] lg:shrink-0 lg:self-start lg:pe-0 lg:ps-4 lg:pt-10\">\n","    <div className=\"lg:flex lg:items-start\">\n      <style>{PAGE_PLACE_CSS}</style>\n      <nav aria-label={t(\"account_sidebar\")} className=\"px-4 pt-6 lg:sticky lg:top-4 lg:w-[256px] lg:shrink-0 lg:self-start lg:pe-0 lg:ps-4 lg:pt-10\">\n"],["      </nav>\n      <div className=\"min-w-0 flex-1\">{ownFrame ? <div className=\"mx-auto max-w-4xl px-4 py-10 sm:px-8\">{children}</div> : children}</div>\n    </div>\n","      </nav>\n      <div className=\"account-page min-w-0 flex-1\">{ownFrame ? <div className=\"mx-auto max-w-4xl px-4 py-10 sm:px-8\">{children}</div> : children}</div>\n    </div>\n"]]},{"file":"apps/web-storefront/components/AccountShell.test.tsx","what":"tests","done":"every page beside the menu starts next to it","pairs":[["    expect(screen.getByText(\"the page\").parentElement!.className).toContain(\"flex-1\");\n    v.unmount();\n","    expect(screen.getByText(\"the page\").parentElement!.className).toContain(\"flex-1\");\n    // every page beside the menu starts next to it, at one width (the widest page's), so their edges line up\n    expect(screen.getByText(\"the page\").parentElement!.className).toContain(\"account-page\");\n    expect(document.querySelector(\"style\")!.textContent).toMatch(/\\.account-page > \\* \\{ margin-inline-start: 0 !important;.*max-width: 64rem !important;/);\n    v.unmount();\n"]]}],"created":[]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-account-menu-gap`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Refresh the website (Ctrl+F5).');
