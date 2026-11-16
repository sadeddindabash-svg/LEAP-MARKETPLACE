#!/usr/bin/env node
/**
 * Buyer app, "Item details" (confirmed with the person via mockup):
 *  - "Ships from ... Warehouse" starts with the flag of the supplier's country (China, Japan, Germany...) instead of the globe; a country not in the list
 *    keeps the globe;
 *  - out of stock, the button says "Notify when in stock" / "أعلمني عند التوفر", always on one line (smaller on a narrow phone rather than two lines);
 *    after a tap "We'll notify you" / "سنُعلمك عند التوفر", also on one line.
 *
 *   node scripts/patch-app-supplier-flag.js            dry run
 *   node scripts/patch-app-supplier-flag.js --write    applies it (the changed file is saved as <file>.before-patch-app-supplier-flag first)
 * Then: buyer app: R (hot restart)
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/mobile/lib/features/catalog/product_screen.dart", "what": "buyer app, Item details: the supplier country flag before \"Ships from ... Warehouse\"; \"Notify when in stock\" / \"أعلمني عند التوفر\" on one line", "done": "Widget? supplierFlagIcon(String? country)", "pairs": [["                            Icon(Icons.public, size: 14, color: palette.muted),\n", "                            // the flag of the supplier's country (confirmed with the person via mockup); a country not in the list keeps the globe\n                            supplierFlagIcon(product.shipsFromCountry) ?? Icon(Icons.public, size: 14, color: palette.muted),\n", false], ["      label: Text(\n        subscribed\n            ? (widget.isAr ? 'سنُعلمك عند التوفر' : 'We\\'ll notify you')\n            : (widget.isAr ? 'أعلمني عند التوفر' : 'Notify me when back in stock'),\n      ),", "      // always on ONE line: on a narrow phone the words get a little smaller instead of wrapping\n      label: FittedBox(\n        fit: BoxFit.scaleDown,\n        child: Text(\n          subscribed\n              ? (widget.isAr ? 'سنُعلمك عند التوفر' : 'We\\'ll notify you')\n              : (widget.isAr ? 'أعلمني عند التوفر' : 'Notify when in stock'),\n          maxLines: 1,\n        ),\n      ),", false], ["class _SpecRow extends StatelessWidget {\n", "// The supplier's country, as its flag (the country comes from the server as its English name, or as its two-letter code).\nconst Map<String, String> _countryCodes = {\n  'china': 'CN', 'japan': 'JP', 'south korea': 'KR', 'korea': 'KR', 'taiwan': 'TW', 'hong kong': 'HK', 'singapore': 'SG', 'thailand': 'TH',\n  'malaysia': 'MY', 'indonesia': 'ID', 'vietnam': 'VN', 'philippines': 'PH', 'india': 'IN', 'pakistan': 'PK',\n  'germany': 'DE', 'france': 'FR', 'italy': 'IT', 'spain': 'ES', 'portugal': 'PT', 'united kingdom': 'GB', 'uk': 'GB', 'netherlands': 'NL',\n  'belgium': 'BE', 'austria': 'AT', 'switzerland': 'CH', 'sweden': 'SE', 'poland': 'PL', 'czech republic': 'CZ', 'czechia': 'CZ', 'hungary': 'HU',\n  'romania': 'RO', 'russia': 'RU', 'turkey': 'TR', 'türkiye': 'TR', 'turkiye': 'TR',\n  'united states': 'US', 'usa': 'US', 'united states of america': 'US', 'canada': 'CA', 'mexico': 'MX', 'brazil': 'BR', 'argentina': 'AR',\n  'united arab emirates': 'AE', 'uae': 'AE', 'saudi arabia': 'SA', 'kuwait': 'KW', 'qatar': 'QA', 'bahrain': 'BH', 'oman': 'OM', 'jordan': 'JO',\n  'egypt': 'EG', 'morocco': 'MA', 'south africa': 'ZA', 'australia': 'AU',\n};\n\nWidget? supplierFlagIcon(String? country) {\n  final name = country?.trim().toLowerCase() ?? '';\n  if (name.isEmpty) return null;\n  final code = name.length == 2 ? name.toUpperCase() : _countryCodes[name];\n  if (code == null || !RegExp(r'^[A-Z]{2}$').hasMatch(code)) return null;\n  final flag = String.fromCharCodes(code.codeUnits.map((c) => 0x1F1E6 + c - 65));\n  return Text(flag, style: const TextStyle(fontSize: 14, height: 1));\n}\n\nclass _SpecRow extends StatelessWidget {\n", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-app-supplier-flag`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: buyer app: R (hot restart)');
