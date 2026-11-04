#!/usr/bin/env node
/**
 * Website, the account menu's pages: 12 px between every block on EVERY page, My account and My tier included (those two are laid out with their own
 * 24 px gaps, which are replaced). Under the title box, between sections and between cards: 12 px. Inside a card or a form nothing changes.
 * Includes patch-menu-spacing-12 (running that one first or not makes no difference). Needs patch-menu-spacing.
 *
 *   node scripts/patch-menu-spacing-12b.js            dry run
 *   node scripts/patch-menu-spacing-12b.js --write    applies it (the file is saved as <file>.before-menu-spacing-12b first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/components/AccountShell.tsx", "what": "12 px between every block on every account page, My account and My tier included", "done": "{ row-gap: 0 !important; }", "alts": [[["// One spacing on every page of the menu, whatever the page itself says: 20 px under the title box (above), 16 px between the page's sections, 12 px between\n", "// One spacing on every page of the menu, whatever the page itself says: 12 px everywhere (under the title box, between the page's sections, between\n"], ["~ :not(:empty, h1, [data-page-lead], :has(> h1):not(:has(> :not(h1, [data-page-lead])))) { margin-top: 16px !important; }", "~ :not(:empty, h1, [data-page-lead], :has(> h1):not(:has(> :not(h1, [data-page-lead])))) { margin-top: 12px !important; }"], [".account-body > * { padding-top: 20px !important; }", ".account-body > * { padding-top: 12px !important; }"], [":is(.account-body > :not(.account-frame), .account-frame > *) > * { margin-block: 0 !important; }\n", ":is(.account-body > :not(.account-frame), .account-frame > *) { row-gap: 0 !important; }\n:is(.account-body > :not(.account-frame), .account-frame > *) > * { margin-block: 0 !important; }\n"], ["// the cards of a list. A block that shows nothing (an empty message line, a title row the title box replaces) takes no space. Inside a card nothing changes.\n", "// the cards of a list. A block that shows nothing (an empty message line, a title row the title box replaces) takes no space, and a page's own gaps (My account,\n// My tier) are replaced by this spacing. Inside a card nothing changes.\n"]], [[":is(.account-body > :not(.account-frame), .account-frame > *) > * { margin-block: 0 !important; }\n", ":is(.account-body > :not(.account-frame), .account-frame > *) { row-gap: 0 !important; }\n:is(.account-body > :not(.account-frame), .account-frame > *) > * { margin-block: 0 !important; }\n"], ["// the cards of a list. A block that shows nothing (an empty message line, a title row the title box replaces) takes no space. Inside a card nothing changes.\n", "// the cards of a list. A block that shows nothing (an empty message line, a title row the title box replaces) takes no space, and a page's own gaps (My account,\n// My tier) are replaced by this spacing. Inside a card nothing changes.\n"]]]}], "created": []};
const once = (s, a) => s.split(a).length === 2;
const plan = [];
let problems = 0;
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const c = (x) => (s.includes('\r\n') ? x.replace(/\r?\n/g, '\r\n') : x);
  if (s.includes(c(e.done))) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  // with or without patch-menu-spacing-12 already applied: either way it ends with 12 px everywhere
  let out = null;
  for (const set of e.alts || [e.pairs]) {
    let o = s;
    for (const [a0, b0] of set) { const a = c(a0), b = c(b0); if (!once(o, a)) { o = null; break; } o = o.replace(a, () => b); }
    if (o !== null) { out = o; break; }
  }
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-menu-spacing-12b`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Ctrl+F5 on the website.');
