#!/usr/bin/env node
/**
 * Position is not required any more: My Drafts (supplier portal) never asks for it or lists it as missing, the server accepts a product
 * without one, and the admin All Products edit form no longer has a Position field (the moderation list no longer shows it).
 * Products that already have a position keep it. Apply after patch-remove-attributes.js.
 *
 *   node scripts/patch-position-optional.js            dry run
 *   node scripts/patch-position-optional.js --write    applies it (each file is saved as <file>.before-position-optional first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"apps/supplier-portal/src/App.jsx","what":"My Drafts: Position no longer asked or listed as missing","done":"{/* Position: not required any more (not asked). */}","pairs":[["  const needsPosition = draft.missing.includes('position');\n",""],["  const [position, setPosition] = useState(draft.position || POSITION_OPTIONS[0].id);\n",""],["        position: needsPosition ? position : undefined,\n",""],["        {needsPosition && (\n          <Field label={cascadeLabel('位置', 'Position')}>\n            <select style={selectStyle} value={position} onChange={(e) => setPosition(e.target.value)}>\n              {POSITION_OPTIONS.map((p) => <option key={p.id} value={p.id}>{p[lang]}</option>)}\n            </select>\n          </Field>\n        )}\n\n","        {/* Position: not required any more (not asked). */}\n"],["{d.missing.filter((m) => m !== 'dimensions').length > 0 && <> · {cascadeLabel('缺少：', 'Needs: ')}{d.missing.filter((m) => m !== 'dimensions').map(draftMissingText)","{d.missing.filter((m) => m !== 'dimensions' && m !== 'position').length > 0 && <> · {cascadeLabel('缺少：', 'Needs: ')}{d.missing.filter((m) => m !== 'dimensions' && m !== 'position').map(draftMissingText)"]]},{"file":"apps/admin-dashboard/src/App.jsx","what":"All Products edit: the Position field removed; moderation list no longer shows it","done":"// position: not edited any more (kept as it is)","pairs":[["{m.supplierName} · {m.category} · {m.part} · {m.position} · OEM {m.oemNumber}","{m.supplierName} · {m.category} · {m.part} · OEM {m.oemNumber}"],["  const [position, setPosition] = useState(\"\");\n",""],["        setPosition(detail.position || \"\");\n",""],["        category, part, position, oemNumber: oemNumber || null,","        category, part, oemNumber: oemNumber || null,      // position: not edited any more (kept as it is)"],["          <div>\n            <label style={labelStyle}>Position</label>\n            <select style={inputStyle} value={position} onChange={(e) => setPosition(e.target.value)}>\n              <option value=\"\">Select…</option>\n              {ALLOWED_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}\n            </select>\n          </div>\n",""]]},{"file":"services/api/src/modules/supplier/routes.js","what":"drafts: position no longer listed as missing","done":"// position: not required any more","pairs":[["      if (!row.position) missing.push('position');\n","      // position: not required any more\n"]]},{"file":"services/api/src/modules/supplier/productValidation.js","what":"position no longer required to submit a product","done":"// position is optional (not required any more)","pairs":[["  if (!position) missing.push('position');\n",""],["  if (!ALLOWED_POSITIONS.includes(position)) {","  if (position && !ALLOWED_POSITIONS.includes(position)) {      // position is optional (not required any more)"]]}],"created":[{"file":"apps/supplier-portal/src/noPosition.wiring.test.js","what":"the test","text":"import { readFileSync } from \"node:fs\";\nimport { describe, expect, it } from \"vitest\";\n\n// Position is not required any more: My Drafts never asks for it or lists it as missing. Reads the source text.\ndescribe(\"Position not required (supplier portal)\", () => {\n  const app = readFileSync(\"src/App.jsx\", \"utf8\");\n  it(\"My Drafts has no Position field\", () => {\n    expect(app).not.toContain(\"draft.missing.includes('position')\");\n    expect(app).not.toContain(\"cascadeLabel('位置', 'Position')}>\");\n  });\n});\n"}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-position-optional`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Restart the API (start-all), then reload the supplier portal and the admin dashboard with Ctrl+F5.');
