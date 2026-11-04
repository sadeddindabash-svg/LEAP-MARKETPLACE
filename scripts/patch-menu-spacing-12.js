#!/usr/bin/env node
/**
 * Website, the account menu's pages: the same 12 px between every block on every page: under the title box, between the page's sections, and between
 * the cards of a list (before: 20 / 16 / 12). Inside a card or a form nothing changes. Needs patch-menu-spacing first.
 *
 *   node scripts/patch-menu-spacing-12.js            dry run
 *   node scripts/patch-menu-spacing-12.js --write    applies it (the file is saved as <file>.before-menu-spacing-12 first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/components/AccountShell.tsx", "what": "12 px between every block on the account menu pages (under the title box, between sections, between cards)", "done": ".account-body > * { padding-top: 12px !important; }", "pairs": [["// One spacing on every page of the menu, whatever the page itself says: 20 px under the title box (above), 16 px between the page's sections, 12 px between\n", "// One spacing on every page of the menu, whatever the page itself says: 12 px everywhere (under the title box, between the page's sections, between\n"], ["~ :not(:empty, h1, [data-page-lead], :has(> h1):not(:has(> :not(h1, [data-page-lead])))) { margin-top: 16px !important; }", "~ :not(:empty, h1, [data-page-lead], :has(> h1):not(:has(> :not(h1, [data-page-lead])))) { margin-top: 12px !important; }"], [".account-body > * { padding-top: 20px !important; }", ".account-body > * { padding-top: 12px !important; }"]]}], "created": []};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-menu-spacing-12`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Ctrl+F5 on the website.');
