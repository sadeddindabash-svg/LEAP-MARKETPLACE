#!/usr/bin/env node
/**
 * SUPPLIER PORTAL, Add product: after the year, a new OPTIONAL "Versions" step: "All versions" (the default) or "Only some versions" (tick the versions the part fits). The form sends fitment.versionIds only for "Only some versions".
 * Needs src/VersionsStep.jsx from the same package and the server package (patch-fit-versions.js, migration 114). Bulk upload is unchanged (every version).
 *
 *   node scripts/patch-fit-versions-supplier.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-fit-versions-supplier.js --write    applies it (each changed file is saved as <file>.before-fit-versions-supplier first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/supplier-portal/src/App.jsx", "what": "Add product: an optional Versions step after the year, and the choice is sent with the fitment", "done": "VersionsStep", "pairs": [["import VehiclePicker from \"./VehiclePicker\";", "import VehiclePicker from \"./VehiclePicker\";\nimport VersionsStep from \"./VersionsStep\";"], ["  const { selectedGenerationId, selectedYear } = cascade;\n  // A PART (the sub-category)", "  const { selectedGenerationId, selectedYear } = cascade;\n  const [versionChoice, setVersionChoice] = useState({ mode: \"all\", ids: [] });      // the optional Versions step: every version (default) or only some\n  // A PART (the sub-category)"], ["    else if (!selectedYear) missing.push(lang === \"zh\" ? \"年份\" : \"year\");\n    if (requirements.photosRequired && photos.length !== requirements.minPhotos) missing.push(lang === \"zh\" ? `${requirements.minPhotos} 张照片` : `exactly ${requirements.minPhotos} photos`);", "    else if (!selectedYear) missing.push(lang === \"zh\" ? \"年份\" : \"year\");\n    if (versionChoice.mode === \"some\" && versionChoice.ids.length === 0) missing.push(lang === \"zh\" ? \"至少一个车型版本（或选择全部版本）\" : \"at least one version (or choose All versions)\");\n    if (requirements.photosRequired && photos.length !== requirements.minPhotos) missing.push(lang === \"zh\" ? `${requirements.minPhotos} 张照片` : `exactly ${requirements.minPhotos} photos`);"], ["        fitment: {\n            generationId: selectedGenerationId,\n            year: parseInt(selectedYear, 10),\n          },", "        fitment: {\n            generationId: selectedGenerationId,\n            year: parseInt(selectedYear, 10),\n            versionIds: versionChoice.mode === \"some\" ? versionChoice.ids : undefined,      // only some versions of the car (none: every version)\n          },"], ["          <VehiclePicker cascade={cascade} />\n          )}\n        </div>", "          <VehiclePicker cascade={cascade} />\n          )}\n          <VersionsStep generationId={selectedGenerationId} year={selectedYear} value={versionChoice} onChange={setVersionChoice} />\n        </div>"]]}, {"file": "apps/supplier-portal/src/auth.js", "what": "the call for the versions of a generation", "done": "fetchVersionsForGeneration", "pairs": [["export async function fetchGenerationsForModel(modelId) {\n  const response = await fetch(`${API_BASE_URL}/fitment/models/${modelId}/generations`);\n  if (!response.ok) throw new Error(`Failed to load generations (${response.status})`);\n  return response.json();\n}", "export async function fetchGenerationsForModel(modelId) {\n  const response = await fetch(`${API_BASE_URL}/fitment/models/${modelId}/generations`);\n  if (!response.ok) throw new Error(`Failed to load generations (${response.status})`);\n  return response.json();\n}\n\n// The versions (trims) of a generation, for the optional Versions step of a product's fitment.\nexport async function fetchVersionsForGeneration(generationId) {\n  const response = await fetch(`${API_BASE_URL}/fitment/generations/${generationId}/versions`);\n  if (!response.ok) throw new Error(`Failed to load versions (${response.status})`);\n  return response.json();\n}"]]}], "whole": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'fit-versions-supplier-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'fit-versions-supplier-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-fit-versions-supplier`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
