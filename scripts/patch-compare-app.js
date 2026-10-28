#!/usr/bin/env node
/**
 * Mobile app: the wishlist's compare mode picks at most 2 items (it was 4): a third tap is refused with the message "You can compare 2 items at a time". Two columns fit the phone screen exactly (110 + 2 x 140 = 390 px) where four scrolled sideways.
 * I cannot run Flutter: please run flutter analyze and flutter test, then try it (see docs/COMPARE-APP.md).
 *
 *   node scripts/patch-compare-app.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-compare-app.js --write    applies it (each changed file is saved as <file>.before-compare-app first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Windows (CRLF) line endings are handled. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/mobile/lib/features/account/wishlist_screen.dart", "what": "the wishlist picks at most 2 items to compare; a third is refused with a message", "done": "canSelectForCompare", "pairs": [["import '../../core/app_strings.dart';", "import '../../core/app_strings.dart';\nimport '../../models/compare_limit.dart';"], ["} else if (_selectedForCompare.length < 4) {\n                                  _selectedForCompare.add(p.id);\n                                }", "} else if (canSelectForCompare(_selectedForCompare.length)) {\n                                  _selectedForCompare.add(p.id);\n                                } else {\n                                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr(context, 'compare_limit'))));\n                                }"]]}, {"file": "apps/mobile/lib/core/app_strings.dart", "what": "the message shown when a third item is refused (English and Arabic)", "done": "compare_limit", "pairs": [["    'compare_label': {'en': 'Compare', 'ar': 'مقارنة'},", "    'compare_label': {'en': 'Compare', 'ar': 'مقارنة'},\n    'compare_limit': {'en': 'You can compare 2 items at a time', 'ar': 'يمكنك مقارنة عنصرين في المرة الواحدة'},"]]}], "whole": []};
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const once = (s, a) => s.split(a).length === 2;

const plan = [];
let problems = 0;
const refuse = (file, why) => { console.log(`REFUSED   ${file}: ${why}`); problems++; };
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const c = (x) => (s.includes('\r\n') ? x.replace(/\r?\n/g, '\r\n') : x);
  if (s.includes(c(e.done))) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  let out = s;
  for (const [a0, b0] of e.pairs) { const a = c(a0), b = c(b0); if (!once(out, a)) { out = null; break; } out = out.replace(a, () => b); }
  if (out === null) { refuse(e.file, 'its text is not what this patch expects, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: out });
}
for (const e of DATA.whole) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'compare-app-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'compare-app-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-compare-app`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
