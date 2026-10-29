#!/usr/bin/env node
/**
 * Mobile app, product screen: the buyer's VERSION (My Garage) is used when the part is narrowed to some versions of the car: the "CONFIRMED FIT" badge only when the part fits that version, an amber
 * "Doesn't fit your version" note, or a grey "Choose your version" note with a button to the garage. A part that is not narrowed behaves exactly as before.
 * Needs lib/models/fit_verdict.dart and lib/widgets/fit_version_note.dart from the same package, and the server package (patch-fit-versions.js). I cannot run Flutter: please run flutter analyze and flutter test, then try it.
 * (The "CONFIRMED FIT" badge on the product CARDS in lists is not changed by this patch.)
 *
 *   node scripts/patch-fit-versions-app.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-fit-versions-app.js --write    applies it (each changed file is saved as <file>.before-fit-versions-app first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Windows (CRLF) line endings are handled. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/mobile/lib/models/product.dart", "what": "the product reads the versions a car is narrowed to", "done": "fitVersions", "pairs": [["import 'fit_group.dart';", "import 'fit_group.dart';\nimport 'fit_verdict.dart';"], ["  final List<String> fitsVehicleIds; // BUY-013: fitment-confirmed vehicles", "  final List<String> fitsVehicleIds; // BUY-013: fitment-confirmed vehicles\n  // The cars of this part narrowed to some VERSIONS ({ \"generationId|year\": [version ids] }) and those versions' names: a car that is not in it fits every version (an older server sends none).\n  final Map<String, List<String>> fitVersions;\n  final Map<String, Map<String, String?>> fitVersionNames;"], ["    required this.fitsVehicleIds,", "    required this.fitsVehicleIds,\n    this.fitVersions = const {},\n    this.fitVersionNames = const {},"], ["        fitsVehicleIds: (json['fitsVehicleIds'] as List?)?.cast<String>() ?? const [],", "        fitsVehicleIds: (json['fitsVehicleIds'] as List?)?.cast<String>() ?? const [],\n        fitVersions: parseFitVersions(json['fitVersions']),\n        fitVersionNames: parseFitVersionNames(json['fitVersionNames']),"]]}, {"file": "apps/mobile/lib/features/catalog/product_screen.dart", "what": "the product screen uses the buyer's version: the badge only for a real fit, and the version notes", "done": "FitVersionNote", "pairs": [["import '../../models/vehicle.dart';", "import '../../models/vehicle.dart';\nimport '../../models/fit_verdict.dart';\nimport '../../widgets/fit_version_note.dart';"], ["    final isConfirmedFit = defaultVehicle != null && product.fitsVehicleIds.contains(defaultVehicle!.generationId);", "    // The buyer's VERSION counts when the part is narrowed to some versions (a part that is not narrowed fits every version, as before).\n    final fitResult = defaultVehicle == null\n        ? null\n        : fitVerdict(generationId: defaultVehicle!.generationId, year: defaultVehicle!.year, versionId: defaultVehicle!.versionId, fitsVehicleIds: product.fitsVehicleIds, fitVersions: product.fitVersions);\n    final isConfirmedFit = fitResult != null && fitResult.confirmed;"], ["            Text(product.name, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18, color: palette.ink)),", "            Text(product.name, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18, color: palette.ink)),\n            FitVersionNote(verdict: fitResult, vehicle: defaultVehicle, versionNames: product.fitVersionNames, onChooseVersion: () => context.push('/garage')),"]]}, {"file": "apps/mobile/lib/core/app_strings.dart", "what": "the words of the version fit notes (English and Arabic)", "done": "fit_wrong_version", "pairs": [["    'confirmed_fit': {'en': 'CONFIRMED FIT', 'ar': 'توافق مؤكد'},", "    'confirmed_fit': {'en': 'CONFIRMED FIT', 'ar': 'توافق مؤكد'},\n    'fit_part_is_for': {'en': 'This part is for: {versions}', 'ar': 'هذه القطعة مخصصة لـ: {versions}'},\n    'fit_wrong_version': {'en': \"Doesn't fit your version.\", 'ar': 'لا تناسب إصدار سيارتك.'},\n    'fit_wrong_version_detail': {'en': 'This part is for {versions}. Your car: {car}. You can still order it.', 'ar': 'هذه القطعة مخصصة لـ {versions}. سيارتك: {car}. يمكنك طلبها مع ذلك.'},\n    'fit_need_version': {'en': 'This part fits only some versions of {car}: {versions}.', 'ar': 'هذه القطعة تناسب بعض إصدارات {car} فقط: {versions}.'},\n    'fit_choose_version': {'en': 'Choose your version to check', 'ar': 'اختر إصدار سيارتك للتحقق'},"]]}], "whole": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'fit-versions-app-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'fit-versions-app-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-fit-versions-app`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
