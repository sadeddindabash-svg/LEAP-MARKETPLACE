#!/usr/bin/env node
/**
 * Second round of storefront screen fixes: the Sections menu and the "Find the right part" lists in four columns, the "Fits my car" switch and the "My vehicle" card the same height on the
 * products page, and a "Back to top" button on every page. Run it AFTER scripts/patch-ui-fixes.js. It changes these existing files (and nothing else):
 *
 *   apps/web-storefront/components/NavDropdown.tsx   a menu can be placed against a bigger container (a new optional rootClassName)
 *   apps/web-storefront/components/SiteHeader.tsx    the Sections menu: four columns, placed against the whole navigation bar
 *   apps/web-storefront/components/FindTools.tsx     the sections list and the parts list: four columns
 *   apps/web-storefront/app/search/page.tsx, components/VehicleFilter.tsx, components/FitsMyCarToggle.tsx   the two boxes at the same height
 *   apps/web-storefront/app/layout.tsx               the back to top button
 *
 *   node scripts/patch-ui-columns.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-ui-columns.js --write    applies it (each file is saved as <file>.before-ui-columns first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/components/NavDropdown.tsx", "what": "a menu can be placed against a bigger container (rootClassName)", "done": "rootClassName", "pairs": [["export default function NavDropdown({ trigger, label, triggerClassName, panelClassName, children }: { trigger: ReactNode; label?: string; triggerClassName: string; panelClassName: string; children: ReactNode }) {", "export default function NavDropdown({ trigger, label, triggerClassName, panelClassName, rootClassName = \"relative\", children }: { trigger: ReactNode; label?: string; triggerClassName: string; panelClassName: string; rootClassName?: string; children: ReactNode }) {"], ["className=\"group relative\"", "className={`group ${rootClassName}`}"]]}, {"file": "apps/web-storefront/components/SiteHeader.tsx", "what": "the Sections menu in four columns, placed against the whole navigation bar", "done": "lg:grid-cols-4", "pairs": [["<nav aria-label=\"Main\" className=\"border-b border-line bg-white text-ink\">\n        <div className=\"mx-auto flex max-w-7xl flex-wrap items-center gap-1 px-4 sm:px-8\">", "<nav aria-label=\"Main\" className=\"border-b border-line bg-white text-ink\">\n        <div className=\"relative mx-auto flex max-w-7xl flex-wrap items-center gap-1 px-4 sm:px-8\">"], ["<NavDropdown\n            trigger={", "<NavDropdown\n            rootClassName=\"\"\n            trigger={"], ["absolute start-0 top-full z-30 grid max-h-[70vh] w-[min(92vw,600px)] grid-cols-1 gap-1 overflow-auto rounded-xl border border-line bg-white p-3 shadow-lg sm:grid-cols-2", "absolute inset-x-0 top-full z-30 grid max-h-[70vh] grid-cols-2 gap-1 overflow-auto rounded-xl border border-line bg-white p-3 shadow-lg sm:grid-cols-3 lg:grid-cols-4"]]}, {"file": "apps/web-storefront/components/FindTools.tsx", "what": "the sections and the parts in four columns", "done": "lg:grid-cols-4", "pairs": [["          <h2 id=\"wizard-h\" className=\"mb-3 text-xl font-bold\">{t(\"wizard_which_section\")}</h2>\n          <ul className=\"grid gap-3 sm:grid-cols-3\">", "          <h2 id=\"wizard-h\" className=\"mb-3 text-xl font-bold\">{t(\"wizard_which_section\")}</h2>\n          <ul className=\"grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4\">"], ["            <ul className=\"grid gap-3 sm:grid-cols-3\">\n              {parts.map((p) => (", "            <ul className=\"grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4\">\n              {parts.map((p) => ("]]}, {"file": "apps/web-storefront/app/search/page.tsx", "what": "the products page strip: both boxes the same height", "done": "lg:items-stretch", "pairs": [["<div className=\"mb-6 flex flex-col gap-3 lg:flex-row lg:items-start\">", "<div className=\"mb-6 flex flex-col gap-3 lg:flex-row lg:items-stretch\">"]]}, {"file": "apps/web-storefront/components/VehicleFilter.tsx", "what": "the My vehicle card fills the height of its row", "done": "className=\"h-full rounded-lg border border-line bg-white p-4\"", "pairs": [["className=\"rounded-lg border border-line bg-white p-4\"", "className=\"h-full rounded-lg border border-line bg-white p-4\""]]}, {"file": "apps/web-storefront/components/FitsMyCarToggle.tsx", "what": "the Fits my car switch fills the height of its row", "done": "flex h-full w-full items-center", "pairs": [["flex w-full items-center gap-3 rounded-lg border p-3 text-start", "flex h-full w-full items-center gap-3 rounded-lg border p-3 text-start"]]}, {"file": "apps/web-storefront/app/layout.tsx", "what": "the back to top button on every page", "done": "BackToTop", "pairs": [["import SiteFooter from \"@/components/SiteFooter\";", "import BackToTop from \"@/components/BackToTop\";\nimport SiteFooter from \"@/components/SiteFooter\";"], ["<SiteFooter lang={lang} />", "<SiteFooter lang={lang} />\n                  <BackToTop />"]]}], "whole": [], "tests": []};
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
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-ui-columns`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
