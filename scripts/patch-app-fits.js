#!/usr/bin/env node
/**
 * Mobile app, product screen: a part that fits MANY vehicles. The Technical Specifications used to show ONE brand, model and year (the first car); now ONE "Fits" row lists every model the part fits with its years ("BYD Seal 2022-2024", "BYD Dolphin 2023"),
 * three lines to start with and then "+2 more models . 11 vehicles in all", which opens the whole list; a part with no fitment says it is universal; an older server keeps the old rows. Needs the server part of patch-multi-fit.js (the server sends fitGroups).
 * I cannot run Flutter: please run flutter analyze and flutter test, then try it (see docs/APP-FITS.md).
 *
 *   node scripts/patch-app-fits.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-app-fits.js --write    applies it (each changed file is saved as <file>.before-app-fits first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Windows (CRLF) line endings are handled. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/mobile/lib/models/product.dart", "what": "a product carries every model it fits (fitGroups) with how many models and vehicles; null from an older server", "done": "fitGroups", "pairs": [["/// Corresponds to SRS", "import 'fit_group.dart';\n\n/// Corresponds to SRS"], ["  final List<String> fitsVehicleIds; // BUY-013: fitment-confirmed vehicles\n", "  final List<String> fitsVehicleIds; // BUY-013: fitment-confirmed vehicles\n  // Every MODEL it fits with its years (the server's fitGroups): null from an older server (the screen keeps its old rows), an empty list when the part has no fitment at all (universal).\n  final List<FitGroup>? fitGroups;\n  final int? fitGroupCount; // how many models in all (the list is capped at 60)\n  final int? fitVehicleCount; // how many different vehicles (a generation and a year)\n"], ["    required this.fitsVehicleIds,\n", "    required this.fitsVehicleIds,\n    this.fitGroups,\n    this.fitGroupCount,\n    this.fitVehicleCount,\n"], ["        fitsVehicleIds: (json['fitsVehicleIds'] as List?)?.cast<String>() ?? const [],\n", "        fitsVehicleIds: (json['fitsVehicleIds'] as List?)?.cast<String>() ?? const [],\n        fitGroups: FitGroup.listFromJson(json['fitGroups']),\n        fitGroupCount: json['fitGroupCount'] as int?,\n        fitVehicleCount: json['fitVehicleCount'] as int?,\n"]]}, {"file": "apps/mobile/lib/features/catalog/product_screen.dart", "what": "the Technical Specifications show one Fits row with every model and its years (the old rows from an older server)", "done": "FitsSpecRow", "pairs": [["import '../../core/config/app_config.dart';", "import '../../core/config/app_config.dart';\nimport '../../widgets/fits_spec_row.dart';"], ["                        final rows = <_SpecRow>[\n                          _SpecRow(index: 0, label: _lBrand, value: product.brand ?? _lNotSpecified),\n                          _SpecRow(index: 1, label: _lModel, value: product.model ?? _lNotSpecified),\n                          _SpecRow(index: 2, label: _lYear, value: product.year?.toString() ?? _lNotSpecified),\n                          _SpecRow(index: 3, label: _lPartNo, value: product.oemNumber ?? _lNotSpecified),\n                        ];", "                        // A part that fits many vehicles: ONE \"Fits\" row with every model and its years, instead of the first car's brand, model and year. An older server (no fitGroups) keeps the three old rows.\n                        final fitGroups = product.fitGroups;\n                        final rows = <Widget>[\n                          if (fitGroups != null)\n                            FitsSpecRow(index: 0, groups: fitGroups, groupCount: product.fitGroupCount, vehicleCount: product.fitVehicleCount)\n                          else ...[\n                            _SpecRow(index: 0, label: _lBrand, value: product.brand ?? _lNotSpecified),\n                            _SpecRow(index: 1, label: _lModel, value: product.model ?? _lNotSpecified),\n                            _SpecRow(index: 2, label: _lYear, value: product.year?.toString() ?? _lNotSpecified),\n                          ],\n                          _SpecRow(index: fitGroups != null ? 1 : 3, label: _lPartNo, value: product.oemNumber ?? _lNotSpecified),\n                        ];"]]}, {"file": "apps/mobile/lib/core/app_strings.dart", "what": "the words of the Fits row (English and Arabic)", "done": "fits_show_fewer", "pairs": [["    'view_compatible_parts': {'en': 'View compatible parts', 'ar': 'عرض القطع المتوافقة'},", "    'view_compatible_parts': {'en': 'View compatible parts', 'ar': 'عرض القطع المتوافقة'},\n    'fits_label_row': {'en': 'Fits', 'ar': 'تناسب'},\n    'fits_universal': {'en': 'Universal: fits all vehicles', 'ar': 'عامة: تناسب جميع المركبات'},\n    'fits_more_model_one': {'en': '+1 more model', 'ar': '+1 موديل آخر'},\n    'fits_more_models': {'en': '+{n} more models', 'ar': '+{n} موديلات أخرى'},\n    'fits_vehicles_in_all': {'en': '{n} vehicles in all', 'ar': '{n} مركبة إجمالاً'},\n    'fits_show_fewer': {'en': 'Show fewer', 'ar': 'عرض أقل'},"]]}], "whole": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'app-fits-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'app-fits-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-app-fits`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
