#!/usr/bin/env node
/**
 * Mobile app, My garage: "View compatible parts" now OPENS the parts that fit that car (a new "Parts for your car" screen: the number that fit, category chips, the app's normal product cards, and "Change" to go back to the garage).
 * Before, the button only closed the garage page and handed the car to whoever had opened it, and nobody used it, so nothing seemed to happen. No server change (the app's existing fit filter is used).
 * Run it AFTER the other app patches. I cannot run Flutter: please run flutter analyze and flutter test, then try it (see docs/GARAGE-PARTS.md).
 *
 *   node scripts/patch-garage-parts.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-garage-parts.js --write    applies it (each changed file is saved as <file>.before-garage-parts first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Windows (CRLF) line endings are handled. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/mobile/lib/core/app_strings.dart", "what": "the words of the Parts for your car screen (English and Arabic)", "done": "vparts_title", "pairs": [["    'view_compatible_parts': {'en': 'View compatible parts', 'ar': 'عرض القطع المتوافقة'},", "    'view_compatible_parts': {'en': 'View compatible parts', 'ar': 'عرض القطع المتوافقة'},\n    'vparts_title': {'en': 'Parts for your car', 'ar': 'قطع لسيارتك'},\n    'vparts_change': {'en': 'Change', 'ar': 'تغيير'},\n    'vparts_all': {'en': 'All', 'ar': 'الكل'},\n    'vparts_count': {'en': '{n} parts fit this car', 'ar': '{n} قطعة تناسب هذه السيارة'},\n    'vparts_one': {'en': 'One part fits this car', 'ar': 'قطعة واحدة تناسب هذه السيارة'},\n    'vparts_none': {'en': 'No parts fit this car yet.', 'ar': 'لا توجد قطع تناسب هذه السيارة حتى الآن.'},"]]}, {"file": "apps/mobile/lib/features/garage/garage_screen.dart", "what": "View compatible parts opens the parts that fit that car (it only closed the page before)", "done": "/vehicle-parts", "pairs": [["                      onPressed: () => Navigator.of(context).pop(v),", "                      onPressed: () => context.push('/vehicle-parts', extra: v),"]]}, {"file": "apps/mobile/lib/app.dart", "what": "the route of the Parts for your car screen (the garage if it is ever opened without a car)", "done": "VehiclePartsScreen", "pairs": [["import 'models/product.dart';", "import 'models/product.dart';\nimport 'models/vehicle.dart';"], ["import 'features/garage/garage_screen.dart';", "import 'features/garage/garage_screen.dart';\nimport 'features/garage/vehicle_parts_screen.dart';"], ["    GoRoute(path: '/garage', builder: (context, state) => const GarageScreen()),", "    GoRoute(path: '/garage', builder: (context, state) => const GarageScreen()),\n    GoRoute(\n      path: '/vehicle-parts',\n      builder: (context, state) {\n        final vehicle = state.extra;\n        return vehicle is Vehicle ? VehiclePartsScreen(vehicle: vehicle) : const GarageScreen();\n      },\n    ),"]]}], "whole": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'garage-parts-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'garage-parts-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-garage-parts`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
