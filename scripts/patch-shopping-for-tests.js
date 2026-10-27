#!/usr/bin/env node
/**
 * OPTIONAL companion of patch-shopping-for.js: replaces the four old tests of the thin "Shopping for" bar in components/stage1b-providers.test.tsx (they describe the behaviour that was changed on purpose) with tests of the new container.
 * It is separate so that a difference in a test file can never stop the feature itself. Run it AFTER patch-shopping-for.js.
 *
 *   node scripts/patch-shopping-for-tests.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-shopping-for-tests.js --write    applies it (the changed file is saved as <file>.before-shopping-for-tests first)
 *
 * A file that is not exactly what the patch expects is NOT changed. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/components/stage1b-providers.test.tsx", "what": "the old tests of the thin Shopping for bar are replaced by tests of the new container", "done": "the Shopping for container", "pairs": [["describe(\"the Shopping for bar\", () => {\n  const bar = (lang: \"en\" | \"ar\" = \"en\") => render(<LangProvider lang={lang}><GarageProvider><VehicleBar /></GarageProvider></LangProvider>);\n\n  it(\"shows nothing to a visitor who is not signed in\", () => {\n    bar();\n    expect(screen.queryByText(\"Shopping for\")).not.toBeInTheDocument();\n    expect(screen.queryByText(/Add your car/)).not.toBeInTheDocument();\n  });\n\n  it(\"CRITICAL: shows the default car, linking to its parts, and Change opens the garage; in Arabic the Arabic name and /ar links\", async () => {\n    signIn(\"u1\");\n    bar();\n    expect(await screen.findByText(\"BYD Seal DM-i · 2024\")).toBeInTheDocument();\n    expect(screen.getByRole(\"link\", { name: \"BYD Seal DM-i · 2024\" }).getAttribute(\"href\")).toBe(\"/search?generationId=g1&year=2024\");\n    expect(screen.getByRole(\"link\", { name: \"Change\" }).getAttribute(\"href\")).toBe(\"/garage\");\n  });\n\n  it(\"in Arabic it speaks Arabic and every link keeps /ar\", async () => {\n    signIn(\"u1\");\n    bar(\"ar\");\n    expect(await screen.findByText(\"بي واي دي Seal DM-i · 2024\")).toBeInTheDocument();\n    expect(screen.getByText(\"التسوق لسيارة\")).toBeInTheDocument();\n    expect(screen.getByRole(\"link\", { name: \"تغيير\" }).getAttribute(\"href\")).toBe(\"/ar/garage\");\n  });\n\n  it(\"a signed-in buyer with no saved car is invited to add one\", async () => {\n    signIn(\"u1\");\n    m.garage.current = [];\n    bar();\n    expect(await screen.findByRole(\"link\", { name: \"Add your car to see the parts that fit it\" })).toBeInTheDocument();\n  });\n});\n\n", "describe(\"the Shopping for container\", () => {\n  const bar = (lang: \"en\" | \"ar\" = \"en\") => render(<LangProvider lang={lang}><GarageProvider><VehicleBar where=\"menu\" /></GarageProvider></LangProvider>);\n\n  it(\"shows \\\"Add a vehicle\\\" to a visitor who is not signed in (as the mobile app does), opening My garage\", () => {\n    bar();\n    expect(screen.getByRole(\"link\", { name: \"Shopping for: Add a vehicle\" }).getAttribute(\"href\")).toBe(\"/garage\");\n  });\n\n  it(\"CRITICAL: shows the default car, and the WHOLE container opens the garage (no separate Change link); in Arabic the Arabic name and /ar links\", async () => {\n    signIn(\"u1\");\n    bar();\n    expect(await screen.findByText(\"BYD Seal DM-i · 2024\")).toBeInTheDocument();\n    expect(screen.getByRole(\"link\", { name: \"Shopping for: BYD Seal DM-i · 2024\" }).getAttribute(\"href\")).toBe(\"/garage\");\n    expect(screen.queryByRole(\"link\", { name: \"Change\" })).not.toBeInTheDocument();\n  });\n\n  it(\"in Arabic it speaks Arabic and every link keeps /ar\", async () => {\n    signIn(\"u1\");\n    bar(\"ar\");\n    expect(await screen.findByText(\"بي واي دي Seal DM-i · 2024\")).toBeInTheDocument();\n    expect(screen.getByText(\"التسوق لسيارة\")).toBeInTheDocument();\n    expect(screen.getByRole(\"link\", { name: /التسوق لسيارة/ }).getAttribute(\"href\")).toBe(\"/ar/garage\");\n  });\n\n  it(\"a signed-in buyer with no saved car is invited to add one\", async () => {\n    signIn(\"u1\");\n    m.garage.current = [];\n    bar();\n    expect(await screen.findByRole(\"link\", { name: \"Shopping for: Add a vehicle\" })).toBeInTheDocument();\n  });\n});\n\n"]]}], "whole": [], "tests": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'shopping-for-tests-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'shopping-for-tests-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-shopping-for-tests`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
