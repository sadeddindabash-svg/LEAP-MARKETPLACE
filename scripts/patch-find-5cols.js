#!/usr/bin/env node
/**
 * Find a part > By vehicle: the list of sections, and the list of parts in a section, are 5 columns on a wide screen (were 4).
 * Smaller screens stay 3, 2 or 1 column.
 *
 *   node scripts/patch-find-5cols.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-find-5cols.js --write    applies it (each changed file is saved as <file>.before-find-5cols first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied).
 * Windows (CRLF) line endings are handled. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/components/FindTools.tsx", "what": "Find a part > By vehicle: sections and parts in 5 columns", "done": "md:grid-cols-3 lg:grid-cols-5\">\n            {categories.map", "pairs": [["          <h2 id=\"wizard-h\" className=\"mb-3 text-xl font-bold\">{t(\"wizard_which_section\")}</h2>\n          <ul className=\"grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4\">\n            {categories.map((c) => (\n", "          <h2 id=\"wizard-h\" className=\"mb-3 text-xl font-bold\">{t(\"wizard_which_section\")}</h2>\n          <ul className=\"grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5\">\n            {categories.map((c) => (\n"], ["          ) : (\n            <ul className=\"grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4\">\n              {parts.map((p) => (\n", "          ) : (\n            <ul className=\"grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5\">\n              {parts.map((p) => (\n"]]}, {"file": "apps/web-storefront/components/FindToolsColumns.test.tsx", "what": "the tests: 5 columns", "done": "const FIVE = [", "pairs": [["const listAfter = (heading: string | RegExp) => screen.getByRole(\"heading\", { name: heading }).parentElement!.querySelector(\"ul\") as HTMLUListElement;\nconst FOUR = [\"grid-cols-1\", \"sm:grid-cols-2\", \"md:grid-cols-3\", \"lg:grid-cols-4\"];\n\n", "const listAfter = (heading: string | RegExp) => screen.getByRole(\"heading\", { name: heading }).parentElement!.querySelector(\"ul\") as HTMLUListElement;\nconst FIVE = [\"grid-cols-1\", \"sm:grid-cols-2\", \"md:grid-cols-3\", \"lg:grid-cols-5\"];\n\n"], ["\ndescribe(\"find the right part: four columns\", () => {\n  it(\"the sections are in four columns on a wide screen (three, two or one on smaller ones), each with a photo tile beside its name\", async () => {\n    signedIn(true, myCar); tool();\n", "\ndescribe(\"find the right part: five columns\", () => {\n  it(\"the sections are in five columns on a wide screen (three, two or one on smaller ones), each with a photo tile beside its name\", async () => {\n    signedIn(true, myCar); tool();\n"], ["    const list = listAfter(\"Which section?\");\n    for (const c of FOUR) expect(list.className.split(\" \")).toContain(c);\n    const rows = list.querySelectorAll(\"li > button\"); expect(rows).toHaveLength(2);\n", "    const list = listAfter(\"Which section?\");\n    for (const c of FIVE) expect(list.className.split(\" \")).toContain(c);\n    const rows = list.querySelectorAll(\"li > button\"); expect(rows).toHaveLength(2);\n"], ["  });\n  it(\"the parts are in four columns too, each with a photo tile beside its name\", async () => {\n    signedIn(true, myCar); tool();\n", "  });\n  it(\"the parts are in five columns too, each with a photo tile beside its name\", async () => {\n    signedIn(true, myCar); tool();\n"], ["    const list = listAfter('Which specific part in \"Brake System\"?');\n    for (const c of FOUR) expect(list.className.split(\" \")).toContain(c);\n    expect(list.querySelectorAll(\"li > button\")).toHaveLength(2);\n", "    const list = listAfter('Which specific part in \"Brake System\"?');\n    for (const c of FIVE) expect(list.className.split(\" \")).toContain(c);\n    expect(list.querySelectorAll(\"li > button\")).toHaveLength(2);\n"]]}], "created": []};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-find-5cols`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Ctrl+F5 on the website.');
