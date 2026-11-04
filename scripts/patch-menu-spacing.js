#!/usr/bin/env node
/**
 * Website, the account menu's pages: one spacing on all of them instead of each page's own (8 to 32 px): 20 px under the title box, 16 px between the
 * page's sections, 12 px between the cards of a list (orders, addresses, wishlist, notifications, saved searches...). Set once in the menu's layout, so a
 * page added to the menu later gets it too; inside a card or a form nothing changes. Arabic the same, mirrored.
 *
 *   node scripts/patch-menu-spacing.js            dry run
 *   node scripts/patch-menu-spacing.js --write    applies it (each changed file is saved as <file>.before-menu-spacing first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/components/AccountShell.tsx", "what": "one spacing on every page of the account menu (20 px under the title box, 16 px between sections, 12 px between cards)", "done": "const SPACING_CSS = `", "pairs": [["const PAGE_PLACE_CSS = `", "// One spacing on every page of the menu, whatever the page itself says: 20 px under the title box (above), 16 px between the page's sections, 12 px between\n// the cards of a list. A block that shows nothing (an empty message line, a title row the title box replaces) takes no space. Inside a card nothing changes.\nconst SPACING_CSS = `:is(.account-body > :not(.account-frame), .account-frame > *) > * { margin-block: 0 !important; }\n:is(.account-body > :not(.account-frame), .account-frame > *) > :not(:empty, h1, [data-page-lead], :has(> h1):not(:has(> :not(h1, [data-page-lead])))) ~ :not(:empty, h1, [data-page-lead], :has(> h1):not(:has(> :not(h1, [data-page-lead])))) { margin-top: 16px !important; }\n:is(.account-body > :not(.account-frame), .account-frame > *) > :has(> h1):not(:has(> :not(h1, [data-page-lead]))) { display: none !important; }\n.account-body :is(ul, ol).grid { gap: 12px !important; }\n.account-body :is(ul, ol)[class*=\"space-y-\"] > * { margin-block: 0 !important; }\n.account-body :is(ul, ol)[class*=\"space-y-\"] > * + * { margin-top: 12px !important; }`;\n\nconst PAGE_PLACE_CSS = `"], [".account-body > * { padding-top: 20px !important; }`;\n", ".account-body > * { padding-top: 20px !important; }\n${SPACING_CSS}`;\n"], ["{ownFrame ? <div className=\"mx-auto max-w-4xl px-4 py-10 sm:px-8\">{children}</div> : children}", "{ownFrame ? <div className=\"account-frame mx-auto max-w-4xl px-4 py-10 sm:px-8\">{children}</div> : children}"]]}, {"file": "apps/web-storefront/components/AccountShell.test.tsx", "what": "tests", "done": "one spacing on every page of the menu", "pairs": [["    v.unmount();\n  });\n  it(\"the menu sits at the start side", "    // one spacing on every page of the menu: 16 px between its sections, 12 px between the cards of a list; a block showing nothing takes no space\n    expect(document.querySelector(\"style\")!.textContent).toContain(\"~ :not(:empty, h1, [data-page-lead]\");\n    expect(document.querySelector(\"style\")!.textContent).toContain(\".account-body :is(ul, ol).grid { gap: 12px !important; }\");\n    v.unmount();\n  });\n  it(\"the menu sits at the start side"]]}], "created": []};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-menu-spacing`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Ctrl+F5 on the website.');
