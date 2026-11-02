#!/usr/bin/env node
/**
 * Website: the Sections menu at the top has 6 columns on a computer (it had 4); tablets keep 3 and phones 2.
 *
 *   node scripts/patch-sections-6.js            dry run
 *   node scripts/patch-sections-6.js --write    applies it (each changed file is saved as <file>.before-sections-6 first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"apps/web-storefront/components/SiteHeader.tsx","what":"6 columns in the Sections menu","done":"sm:grid-cols-3 lg:grid-cols-6\"","pairs":[["            triggerClassName=\"flex min-h-12 cursor-pointer items-center gap-1 rounded-lg px-4 text-[15px] font-semibold hover:bg-chalk\"\n            panelClassName=\"absolute inset-x-0 top-full z-30 grid max-h-[70vh] grid-cols-2 gap-1 overflow-auto rounded-xl border border-line bg-white p-3 shadow-lg sm:grid-cols-3 lg:grid-cols-4\"\n          >\n","            triggerClassName=\"flex min-h-12 cursor-pointer items-center gap-1 rounded-lg px-4 text-[15px] font-semibold hover:bg-chalk\"\n            panelClassName=\"absolute inset-x-0 top-full z-30 grid max-h-[70vh] grid-cols-2 gap-1 overflow-auto rounded-xl border border-line bg-white p-3 shadow-lg sm:grid-cols-3 lg:grid-cols-6\"\n          >\n"]]},{"file":"apps/web-storefront/components/SiteHeaderMenu.test.tsx","what":"tests","done":"has six columns on a wide screen","pairs":[["describe(\"the Sections menu\", () => {\n  it(\"has four columns on a wide screen, three on a tablet and two on a phone\", async () => {\n    const { panel } = await header(); const c = panel.className.split(\" \");\n","describe(\"the Sections menu\", () => {\n  it(\"has six columns on a wide screen, three on a tablet and two on a phone\", async () => {\n    const { panel } = await header(); const c = panel.className.split(\" \");\n"],["    const { panel } = await header(); const c = panel.className.split(\" \");\n    for (const k of [\"grid-cols-2\", \"sm:grid-cols-3\", \"lg:grid-cols-4\"]) expect(c).toContain(k);\n  });\n","    const { panel } = await header(); const c = panel.className.split(\" \");\n    for (const k of [\"grid-cols-2\", \"sm:grid-cols-3\", \"lg:grid-cols-6\"]) expect(c).toContain(k);\n    expect(c).not.toContain(\"lg:grid-cols-4\");\n  });\n"]]}],"created":[]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-sections-6`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Refresh the website (Ctrl+F5).');
