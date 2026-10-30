#!/usr/bin/env node
/**
 * Admin dashboard, Overview: "Units sold by category" shows the real categories' names (from the Categories page) instead of a fixed
 * list of 6 old names; the 6 that sell most, then the rest together as "Other", each its own colour. Apply after patch-reject-reasons.js.
 *
 *   node scripts/patch-units-by-category.js            dry run
 *   node scripts/patch-units-by-category.js --write    applies it (App.jsx is saved as App.jsx.before-units-by-category first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"apps/admin-dashboard/src/App.jsx","what":"Overview: Units sold by category shows the real category names (top 6, then Other)","done":"const [categoryNames, setCategoryNames] = useState({});","pairs":[["  const [errorMessage, setErrorMessage] = useState(null);\n\n  useEffect(() => {\n    fetchOverview(getStoredToken())","  const [errorMessage, setErrorMessage] = useState(null);\n  // The real categories (Categories page), so \"Units sold by category\" shows their names, not their ids.\n  const [categoryNames, setCategoryNames] = useState({});\n  useEffect(() => {\n    fetchCategories().then((list) => setCategoryNames(Object.fromEntries((Array.isArray(list) ? list : []).map((c) => [c.id, c.nameEn || c.nameZh || c.id])))).catch(() => {});\n  }, []);\n\n  useEffect(() => {\n    fetchOverview(getStoredToken())"],["  const categorySplit = data.unitsByCategory.map((c, i) => ({\n    name: CATEGORY_LABELS[c.category] || c.category,\n    value: totalUnits > 0 ? Math.round((c.units / totalUnits) * 100) : 0,\n    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],\n  }));","  // Units sold by category: the real category names, the 6 that sell most, then the rest together as \"Other\" (each its own colour).\n  const byUnits = [...data.unitsByCategory].filter((c) => c.units > 0).sort((a, b) => b.units - a.units);\n  const topCategories = byUnits.slice(0, 6);\n  const otherUnits = byUnits.slice(6).reduce((sum, c) => sum + c.units, 0);\n  const categorySplit = [\n    ...topCategories.map((c) => ({ name: categoryNames[c.category] || CATEGORY_LABELS[c.category] || c.category || \"Uncategorised\", units: c.units })),\n    ...(otherUnits > 0 ? [{ name: `Other (${byUnits.length - 6})`, units: otherUnits }] : []),\n  ].map((c, i) => ({\n    ...c,\n    value: totalUnits > 0 ? Math.round((c.units / totalUnits) * 100) : 0,\n    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],\n  }));"],["const CATEGORY_COLORS = [C.signal, C.torque, C.gauge, C.amber, \"#9AA1AC\", \"#6E7681\"];","const CATEGORY_COLORS = [C.signal, C.torque, C.gauge, C.amber, \"#7B5EA7\", \"#2A9D8F\", \"#9AA1AC\"];      // 6 categories and \"Other\", each its own colour"]]}],"created":[{"file":"apps/admin-dashboard/src/unitsByCategory.wiring.test.js","what":"the test","text":"import { readFileSync } from \"node:fs\";\nimport { describe, expect, it } from \"vitest\";\n\n// Overview: \"Units sold by category\" shows the real categories' names, the top 6 and \"Other\". Reads the source text.\ndescribe(\"Units sold by category\", () => {\n  const app = readFileSync(\"src/App.jsx\", \"utf8\");\n  it(\"names from the real categories\", () => {\n    expect(app).toContain(\"name: categoryNames[c.category] || CATEGORY_LABELS[c.category] || c.category\");\n  });\n  it(\"the top 6, then Other\", () => {\n    expect(app).toContain(\"byUnits.slice(0, 6)\");\n    expect(app).toContain(\"name: `Other (${byUnits.length - 6})`\");\n  });\n});\n"}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-units-by-category`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Reload the admin dashboard with Ctrl+F5.');
