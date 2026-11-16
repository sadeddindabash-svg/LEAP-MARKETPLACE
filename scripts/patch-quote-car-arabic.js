#!/usr/bin/env node
/**
 * A quotation's car in the reader's language: in Arabic, the Arabic brand, model and version (the server keeps them since the car comes from the catalogue,
 * patch-quote-real-car); in English, the English ones. Website (the quotation, its PDF and check page, My quotations) and the buyer app (My quotations and a
 * quotation). A quotation made before patch-quote-real-car has only the English names, and keeps showing them.
 *
 *   node scripts/patch-quote-car-arabic.js            dry run
 *   node scripts/patch-quote-car-arabic.js --write    applies it (each changed file is saved as <file>.before-patch-quote-car-arabic first)
 * Then: website: Ctrl+F5 · buyer app: R
 */
const DATA = {"created": [], "anchored": [{"file": "apps/web-storefront/lib/quotations.ts", "what": "website: a quotation's car in the page's language (the Arabic brand, model and version when it has them)", "done": "const ar = lang === \"ar\";", "pairs": [["export const vehicleLabel = (v: QuoteVehicle): string => [v.make, v.model, v.year, v.version].filter(Boolean).join(\" \");", "/** The quotation's car: in Arabic when the page is (its Arabic brand, model and version, kept since the car comes from the catalogue), else in English. */\nexport const vehicleLabel = (v: QuoteVehicle, lang?: Lang): string => {\n  const ar = lang === \"ar\";\n  return [ar && v.makeAr ? v.makeAr : v.make, ar && v.modelAr ? v.modelAr : v.model, v.year, ar && v.versionAr ? v.versionAr : v.version].filter(Boolean).join(\" \");\n};", false]]}, {"file": "apps/web-storefront/components/QuotationDocument.tsx", "what": "website, the quotation (and its PDF and check page): the car in the page's language", "done": "<bdi>{vehicleLabel(v, lang)}</bdi>", "pairs": [["<bdi>{vehicleLabel(v)}</bdi>", "<bdi>{vehicleLabel(v, lang)}</bdi>", false]]}, {"file": "apps/web-storefront/app/quotations/page.tsx", "what": "website, My quotations: the car in the page's language", "done": "<bdi>{vehicleLabel(q.vehicle, lang)}</bdi>", "pairs": [["<bdi>{vehicleLabel(q.vehicle)}</bdi>", "<bdi>{vehicleLabel(q.vehicle, lang)}</bdi>", false]]}, {"file": "apps/mobile/lib/features/quotations/quotations_screens.dart", "what": "app, quotations: the car in the app's language (Arabic brand, model and version when the quotation has them)", "done": "String _vehicleLine(Map<String, dynamic> v, {bool ar = false})", "pairs": [["String _vehicleLine(Map<String, dynamic> v) => [v['make'], v['model'], v['year'], v['version']].where((x) => x != null && '$x'.isNotEmpty).join(' ');", "// The quotation's car: in Arabic when the app is (its Arabic brand, model and version, kept since the car comes from the catalogue), else in English.\nString _vehicleLine(Map<String, dynamic> v, {bool ar = false}) {\n  String? pick(String key) {\n    final arValue = v['${key}Ar'];\n    return ar && arValue is String && arValue.isNotEmpty ? arValue : (v[key] == null ? null : '${v[key]}');\n  }\n  return [pick('make'), pick('model'), '${v['year'] ?? ''}', pick('version')].where((x) => x != null && x.isNotEmpty).join(' ');\n}", false], ["${_vehicleLine(q['vehicle'] as Map<String, dynamic>)} · ${qtr(context, 'parts_count')", "${_vehicleLine(q['vehicle'] as Map<String, dynamic>, ar: _ar(context))} · ${qtr(context, 'parts_count')", false], ["        Text(_vehicleLine(q['vehicle'] as Map<String, dynamic>), style: TextStyle(color: p.muted)),", "        Text(_vehicleLine(q['vehicle'] as Map<String, dynamic>, ar: _ar(context)), style: TextStyle(color: p.muted)),", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-quote-car-arabic`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: website: Ctrl+F5 · buyer app: R (hot restart)');
