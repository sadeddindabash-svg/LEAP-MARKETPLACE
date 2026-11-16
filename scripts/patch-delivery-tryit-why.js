#!/usr/bin/env node
/**
 * Delivery Rules > How it works > "Try it": a size (L x W x H) can be entered, and the rules table (step 3) shows each rule's size limit and, for the
 * example, why each rule fits or not ("needs a size", "ships from Turkey, not China", "Egypt is not in GCC", "2 kg is over 1 kg", "fits · wins").
 * Run AFTER patch-delivery-flow.
 *   node scripts/patch-delivery-tryit-why.js            dry run
 *   node scripts/patch-delivery-tryit-why.js --write    applies it
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "services/api/src/modules/deliveryRules/routes.js", "what": "API, \"Try it\": takes a size too, and says for every rule why it fits or not", "done": "checks: await whyEachRule(", "pairs": [["    const weight = b.weightKg === '' || b.weightKg == null ? null : Number(b.weightKg);\n    const est = await estimateDelivery({ weightKg: Number.isFinite(weight) ? weight : null, lengthCm: null, widthCm: null, heightCm: null, warehouseCountry: b.warehouseCountry || null, destinationIsoCode }, s);\n    res.json({ ...est, destinationIsoCode });", "    const n = (v) => { if (v === '' || v == null) return null; const x = Number(v); return Number.isFinite(x) && x >= 0 ? x : null; };\n    const input = { weightKg: n(b.weightKg), lengthCm: n(b.lengthCm), widthCm: n(b.widthCm), heightCm: n(b.heightCm), warehouseCountry: b.warehouseCountry || null, destinationIsoCode };\n    const est = await estimateDelivery(input, s);\n    res.json({ ...est, destinationIsoCode, checks: await whyEachRule(input) });", false], ["// ---- Delivery Rules > How it works (confirmed with the person via mockup): the settings around the rules, and \"Try it\".", "// For \"Try it\": every rule, in order, with why it fits or not (the same tests as deliveryEstimate/engine.js matchRule).\nasync function whyEachRule({ weightKg, lengthCm, widthCm, heightCm, warehouseCountry, destinationIsoCode }) {\n  const { rows: rules } = await db.query('SELECT dr.*, cg.name AS group_name FROM delivery_rules dr LEFT JOIN country_groups cg ON cg.id = dr.destination_group_id ORDER BY dr.sort_order ASC');\n  const { rows: member } = await db.query('SELECT group_id FROM country_group_members WHERE iso_code = $1', [destinationIsoCode]);\n  const inGroups = new Set(member.map((m) => m.group_id));\n  const volume = weightKg != null && lengthCm != null && widthCm != null && heightCm != null ? lengthCm * widthCm * heightCm : null;\n  const country = nameForIsoCode(destinationIsoCode) || destinationIsoCode;\n  const num = (v) => (v == null ? null : Number(v));\n  let winner = -1;\n  return rules.map((r, i) => {\n    const reasons = [];\n    if (r.warehouse_country && r.warehouse_country !== warehouseCountry) reasons.push(`ships from ${r.warehouse_country}, not ${warehouseCountry || 'unknown'}`);\n    if (r.destination_group_id && !inGroups.has(r.destination_group_id)) reasons.push(`${country} is not in ${r.group_name || 'that group'}`);\n    const [wMin, wMax, vMin, vMax] = [num(r.min_weight_kg), num(r.max_weight_kg), num(r.min_volume_cm3), num(r.max_volume_cm3)];\n    if (wMin != null || wMax != null) {\n      if (weightKg == null) reasons.push('needs a weight');\n      else { if (wMin != null && weightKg < wMin) reasons.push(`${weightKg} kg is under ${wMin} kg`); if (wMax != null && weightKg > wMax) reasons.push(`${weightKg} kg is over ${wMax} kg`); }\n    }\n    if (vMin != null || vMax != null) {\n      if (volume == null) reasons.push(`needs a size (it has a volume limit: ${vMin ?? 0}–${vMax ?? '∞'} cm³)`);\n      else { if (vMin != null && volume < vMin) reasons.push(`${volume} cm³ is under ${vMin} cm³`); if (vMax != null && volume > vMax) reasons.push(`${volume} cm³ is over ${vMax} cm³`); }\n    }\n    const fits = reasons.length === 0;\n    if (fits && winner < 0) winner = i;\n    return { ruleIndex: i, ruleId: r.id, fits, wins: fits && winner === i, reasons };\n  });\n}\n\n// ---- Delivery Rules > How it works (confirmed with the person via mockup): the settings around the rules, and \"Try it\".", false]]}, {"file": "apps/admin-dashboard/src/App.jsx", "what": "admin, Delivery Rules > How it works: \"Try it\" takes a size, and the rules table shows each rule's size limit and why it fits or not", "done": "sizeText(r)", "pairs": [["const [tryIt, setTryIt] = useState({ warehouseCountry: warehouseCountries[0] || \"China\", destinationIsoCode: \"SA\", weightKg: 2 });", "const [tryIt, setTryIt] = useState({ warehouseCountry: warehouseCountries[0] || \"China\", destinationIsoCode: \"SA\", weightKg: 2, lengthCm: \"\", widthCm: \"\", heightCm: \"\" });", false], ["previewDelivery(getStoredToken(), { ...tryIt, weightKg: Number(tryIt.weightKg), destinationIsoCode: tryIt.destinationIsoCode || null, settings: draft })", "previewDelivery(getStoredToken(), { ...tryIt, weightKg: tryIt.weightKg === \"\" ? null : Number(tryIt.weightKg), lengthCm: tryIt.lengthCm === \"\" ? null : Number(tryIt.lengthCm), widthCm: tryIt.widthCm === \"\" ? null : Number(tryIt.widthCm), heightCm: tryIt.heightCm === \"\" ? null : Number(tryIt.heightCm), destinationIsoCode: tryIt.destinationIsoCode || null, settings: draft })", false], ["            <span>Weight</span><span><input type=\"number\" min={0} step={0.5} value={tryIt.weightKg} onChange={(e) => setTryIt((t) => ({ ...t, weightKg: e.target.value }))} style={{ ...sel, width: 70 }} /> kg</span>", "            <span>Weight</span><span><input type=\"number\" min={0} step={0.5} value={tryIt.weightKg} onChange={(e) => setTryIt((t) => ({ ...t, weightKg: e.target.value }))} style={{ ...sel, width: 70 }} /> kg</span>\n            <span>Size (cm)</span><span style={{ display: \"flex\", gap: 4, alignItems: \"center\" }}>{[\"lengthCm\", \"widthCm\", \"heightCm\"].map((k, i) => <React.Fragment key={k}>{i > 0 && \"×\"}<input type=\"number\" min={0} placeholder={[\"L\", \"W\", \"H\"][i]} value={tryIt[k]} onChange={(e) => setTryIt((t) => ({ ...t, [k]: e.target.value }))} style={{ ...sel, width: 52 }} /></React.Fragment>)}</span>", false], ["  const weightText = (r) =>", "  const sizeText = (r) => (r.minVolumeCm3 != null && r.maxVolumeCm3 != null ? `${r.minVolumeCm3}–${r.maxVolumeCm3} cm³` : r.maxVolumeCm3 != null ? `up to ${r.maxVolumeCm3} cm³` : r.minVolumeCm3 != null ? `over ${r.minVolumeCm3} cm³` : \"any\");\n  const checkOf = (i) => (preview && !preview.error && Array.isArray(preview.checks) ? preview.checks[i] : null);\n  const weightText = (r) =>", false], ["[\"#\", \"From\", \"To\", \"Weight\", \"Days\"].map((h) =>", "[\"#\", \"From\", \"To\", \"Weight\", \"Size\", \"Days\", \"Try it\"].map((h) =>", false], ["<tr><td colSpan={5} style={{ padding: \"8px\", color: C.muted }}>No rules yet", "<tr><td colSpan={7} style={{ padding: \"8px\", color: C.muted }}>No rules yet", false], ["                  <td style={{ padding: \"5px 8px\", borderTop: `1px solid ${C.line}` }}>{r.deliveryDays}{i === winner ? \" ← wins (Try it)\" : \"\"}</td>\n                </tr>", "                  <td style={{ padding: \"5px 8px\", borderTop: `1px solid ${C.line}` }}>{sizeText(r)}</td>\n                  <td style={{ padding: \"5px 8px\", borderTop: `1px solid ${C.line}` }}>{r.deliveryDays}</td>\n                  <td style={{ padding: \"5px 8px\", borderTop: `1px solid ${C.line}`, fontWeight: 600, color: !checkOf(i) ? C.muted : checkOf(i).fits ? C.gauge : C.red }}>\n                    {!checkOf(i) ? \"…\" : checkOf(i).wins ? \"✓ fits · wins\" : checkOf(i).fits ? \"✓ fits (a rule above wins)\" : `✗ ${checkOf(i).reasons.join(\"; \")}`}\n                  </td>\n                </tr>", false], ["          {hint(\"Weight only: rules that need a size are skipped here.\")}", "          {hint(\"Size is optional; without it, rules with a size (volume) limit cannot fit. The rules table (step 3) says why each rule fits or not.\")}", false]]}]};
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const plan = [];
let problems = 0;
const once = (s, a) => s.split(a).length === 2;
const read = (file) => { const p = path.join(root, file); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; };
function edit(file, what, done, change) {
  const s = read(file);
  if (s === null) { console.log(`MISSING   ${file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; return; }
  if (s.replace(/\r\n/g, '\n').includes(done)) { console.log(`already   ${file}: ${what}`); return; }
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  const out = change(s.replace(/\r\n/g, '\n'));
  if (typeof out !== 'string') { console.log(`REFUSED   ${file}: ${out && out.why ? out.why : 'its text is not what this patch expects'}, so nothing was changed. Send this file.`); problems++; return; }
  plan.push({ file, what, before: s, after: out.replace(/\n/g, eol) });
}

for (const e of DATA.created) {
  const p = path.join(root, e.file);
  if (e.base64) {      // a picture: written as it is
    const bytes = Buffer.from(e.base64, 'base64');
    if (fs.existsSync(p)) {
      if (fs.readFileSync(p).equals(bytes)) { console.log(`already   ${e.file}: ${e.what}`); continue; }
      console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
    }
    if (!fs.existsSync(path.dirname(p))) { console.log(`MISSING   ${path.dirname(e.file)}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
    plan.push({ file: e.file, what: e.what, before: null, after: bytes });
    continue;
  }
  if (fs.existsSync(p)) {
    if (fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') === e.text) { console.log(`already   ${e.file}: ${e.what}`); continue; }
    console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
  }
  // a new folder (services/api/src/modules/draftPhotos) is made, but only inside one that is already there
  if (!fs.existsSync(path.dirname(path.dirname(p)))) { console.log(`MISSING   ${path.dirname(path.dirname(e.file))}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  plan.push({ file: e.file, what: e.what, before: null, after: e.text });
}
for (const e of DATA.replaced || []) {
  edit(e.file, e.what, e.done, (s) => (e.from.includes(s) ? e.text : { why: 'it is not the version patch-hub-label-design made (run that patch first, or send this file)' }));
}
for (const e of DATA.anchored) {
  // a test file: changed when it is there and as expected, otherwise left as it is (it does not stop the patch)
  if (e.optional) {
    const s = read(e.file);
    if (s === null) { console.log(`skipped   ${e.file}: not found (a test file; nothing to do)`); continue; }
    const n = s.replace(/\r\n/g, '\n');
    if (!n.includes(e.done) && (e.pairs.some(([a, , all]) => all !== 'maybe' && all !== 'alts' && !once(n, a)) || (e.block && (!n.includes(e.block.from) || !n.includes(e.block.to))))) { console.log(`skipped   ${e.file}: not as expected, left as it is (${e.what})`); continue; }
  }
  edit(e.file, e.what, e.done, (s) => {
    let out = s;
    for (const [a, b, all] of e.pairs) {
      if (all === 'alts') { const hit = a.find(([x]) => once(out, x)); if (!hit) return { why: `this part was not found: "${a[a.length - 1][0].split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(hit[0], () => hit[1]); continue; }
      if (all === 'maybe') { if (once(out, a)) out = out.replace(a, () => b); continue; }
      if (all) { if (!out.includes(a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.split(a).join(b); continue; } if (!once(out, a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(a, () => b); }
    if (e.region) {
      const r = e.region; const i = out.indexOf(r.from); const j = i < 0 ? -1 : out.indexOf(r.to, i);
      if (i < 0 || j < 0) return { why: `the part starting "${r.from.trim().slice(0, 60)}" was not found` };
      const seg = out.slice(i, j);
      if (r.must && !seg.includes(r.must)) return { why: `"${r.must}" was not found in the part starting "${r.from.trim().slice(0, 60)}"` };
      const changed = seg.replace(new RegExp(r.find, 'g'), r.repl);
      if (changed === seg) return { why: `nothing to change in the part starting "${r.from.trim().slice(0, 60)}"` };
      out = out.slice(0, i) + changed + out.slice(j);
    }
    if (e.block) {
      const i = out.indexOf(e.block.from); const j = i < 0 ? -1 : out.indexOf(e.block.to, i);
      if (i < 0 || j < 0) return { why: `the part starting "${e.block.from.trim().slice(0, 60)}" was not found` };
      out = out.slice(0, i) + e.block.text + out.slice(e.block.includeTo ? j + e.block.to.length : j);
    }
    return out;
  });
}
if (DATA.mount) edit('services/api/src/index.js', DATA.mount.what, DATA.mount.done, (s) => {
  const m = s.match(/\n([ \t]*)app\.use\('\/payouts', payoutsRoutes\);[^\n]*/);
  if (!m) return { why: "the line app.use('/payouts', payoutsRoutes); was not found" };
  const at = m.index + m[0].length;
  return s.slice(0, at) + `\n${m[1]}${DATA.mount.line}` + s.slice(at);
});
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) {
    const p = path.join(root, c.file);
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-delivery-tryit-why`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: API window: Ctrl+C, npm run dev; admin: Ctrl+F5');
