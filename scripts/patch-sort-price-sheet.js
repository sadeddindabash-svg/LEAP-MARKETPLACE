#!/usr/bin/env node
/**
 * Mobile app, the "Sort & price" sheet: (1) the price boxes, the "Price range" label and the summary chip show the CURRENCY of the app (SAR, ... instead of a fixed $); the amounts typed are in that currency and are converted to US dollars for the search (the server filters in dollars),
 * and a saved filter is shown back in the app's currency; (2) DARK MODE: the section labels and the sort chips take their colours from the app's palette (they used the light-mode colours, dark grey on the dark sheet).
 * Needs lib/models/price_filter.dart and lib/widgets/currency_label.dart from the same package. I cannot run Flutter: please run flutter analyze and flutter test, then try it in light and dark mode (see docs/SORT-PRICE-SHEET.md).
 *
 *   node scripts/patch-sort-price-sheet.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-sort-price-sheet.js --write    applies it (the changed file is saved as <file>.before-sort-price-sheet first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Windows (CRLF) line endings are handled. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/mobile/lib/features/search/sort_and_price_sheet.dart", "what": "the Sort & price sheet shows the app's currency in the price boxes, converts to dollars for the search, and takes its colours from the palette (dark mode)", "done": "currencyLabelOf", "pairs": [["import '../../core/app_strings.dart';", "import '../../core/app_strings.dart';\nimport 'package:provider/provider.dart';\nimport '../../core/currency_state.dart';\nimport '../../models/price_filter.dart';\nimport '../../widgets/currency_label.dart';"], ["final min = minPrice != null ? '\\$$minPrice' : '\\$0';", "final min = formatPrice(context, (minPrice ?? 0).toDouble());"], ["final max = maxPrice != null ? '\\$$maxPrice' : '+';", "final max = maxPrice != null ? formatPrice(context, maxPrice!.toDouble()) : '+';"], ["_minController.text = '${widget.initial!.minPrice}';", "_minController.text = formatPriceInput(displayFromUsd(widget.initial!.minPrice, context.read<CurrencyState>().convert(1.0) ?? 1.0));"], ["_maxController.text = '${widget.initial!.maxPrice}';", "_maxController.text = formatPriceInput(displayFromUsd(widget.initial!.maxPrice, context.read<CurrencyState>().convert(1.0) ?? 1.0));"], ["Navigator.of(context).pop(SortAndPriceSelection(sort: _sort, minPrice: min, maxPrice: max, maxDeliveryDays: _maxDeliveryDays));", "final range = priceRangeFromTyped(min, max, context.read<CurrencyState>().convert(1.0) ?? 1.0);\n    Navigator.of(context).pop(SortAndPriceSelection(sort: _sort, minPrice: range.minUsd, maxPrice: range.maxUsd, maxDeliveryDays: _maxDeliveryDays));"], ["Text(tr(context, 'sort_by_label'), style: const TextStyle(fontSize: 12.5, color: LeapColors.muted)),", "Text(tr(context, 'sort_by_label'), style: TextStyle(fontSize: 12.5, color: LeapPalette.of(context).muted)),"], ["Text(tr(context, 'price_range_label'), style: const TextStyle(fontSize: 12.5, color: LeapColors.muted)),", "Text('${tr(context, 'price_range_label')} (${currencyLabelOf(context)})', style: TextStyle(fontSize: 12.5, color: LeapPalette.of(context).muted)),"], ["Text(tr(context, 'delivery_speed_label'), style: const TextStyle(fontSize: 12.5, color: LeapColors.muted)),", "Text(tr(context, 'delivery_speed_label'), style: TextStyle(fontSize: 12.5, color: LeapPalette.of(context).muted)),"], ["decoration: InputDecoration(labelText: tr(context, 'min_field'), prefixText: '\\$'),", "decoration: InputDecoration(labelText: tr(context, 'min_field'), prefixText: '${currencyLabelOf(context)} '),"], ["decoration: InputDecoration(labelText: tr(context, 'max_field'), prefixText: '\\$'),", "decoration: InputDecoration(labelText: tr(context, 'max_field'), prefixText: '${currencyLabelOf(context)} '),"], ["selectedColor: LeapColors.signal.withValues(alpha: 0.15),", "selectedColor: LeapPalette.of(context).signal.withValues(alpha: 0.15),"], ["labelStyle: TextStyle(color: selected ? LeapColors.signal : LeapColors.ink, fontWeight: selected ? FontWeight.w700 : FontWeight.w500),", "labelStyle: TextStyle(color: selected ? LeapPalette.of(context).signal : LeapPalette.of(context).ink, fontWeight: selected ? FontWeight.w700 : FontWeight.w500),"]]}], "whole": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'sort-price-sheet-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'sort-price-sheet-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-sort-price-sheet`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
