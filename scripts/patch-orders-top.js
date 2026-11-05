#!/usr/bin/env node
/**
 * Buyer app, My orders: the two tiles at the top (Active shipments, and the year's spend) are as short as their content (about 100 -> 56 px) and always
 * the same size (while the spend loads, its tile shows a dash instead of disappearing). Every gap on the page is the same 8 px: above and below the tabs,
 * between the two tiles, under them, and between the order cards (the line under the tabs is removed). Run after patch-order-cards.
 *
 *   node scripts/patch-orders-top.js            dry run
 *   node scripts/patch-orders-top.js --write    applies it (the file is saved as <file>.before-patch-orders-top first)
 * Then: buyer app: R
 */
const DATA = {"created": [], "anchored": [{"file": "apps/mobile/lib/features/orders/orders_screen.dart", "what": "app, My orders: Active shipments and the year's spend as short as their content and the same size; every gap on the page is 8", "done": "the two summary tiles: the same size, as short as their content", "pairs": [["          SizedBox(\n            height: 56,\n            child: ListView(\n              scrollDirection: Axis.horizontal,\n              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),", "          // the tabs: 8 above them, and 8 down to the first box (no line under them)\n          SizedBox(\n            height: 52,\n            child: ListView(\n              scrollDirection: Axis.horizontal,\n              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),", false], ["          Divider(height: 1, color: LeapPalette.of(context).line),\n          Expanded(\n            child: RefreshIndicator(", "          Expanded(\n            child: RefreshIndicator(", false], ["                    padding: const EdgeInsets.all(16),\n                    itemCount: orders.length + (_selectedTab == 'all' ? 1 : 0),\n                    separatorBuilder: (_, __) => const SizedBox(height: 10),", "                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),\n                    itemCount: orders.length + (_selectedTab == 'all' ? 1 : 0),\n                    separatorBuilder: (_, __) => const SizedBox(height: 8),       // every gap on this page is 8", false], ["    return Container(\n      margin: const EdgeInsets.only(bottom: 8),\n      clipBehavior: Clip.antiAlias,\n      decoration: Premium.card(context, radius: 14),", "    return Container(\n      // no gap of its own: the list puts 8 between the boxes\n      clipBehavior: Clip.antiAlias,\n      decoration: Premium.card(context, radius: 14),", false]], "block": {"from": "                      if (_selectedTab == 'all' && i == 0) {\n                        return Row(", "to": "                      final o = orders[i - (_selectedTab == 'all' ? 1 : 0)] as Map<String, dynamic>;", "text": "                      if (_selectedTab == 'all' && i == 0) {\n                        // the two summary tiles: the same size, as short as their content, 8 apart (the same gap as every box on this page)\n                        Widget tile(String label, Widget value) => Container(\n                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),\n                              decoration: Premium.card(context, radius: 12),\n                              child: Column(\n                                mainAxisAlignment: MainAxisAlignment.center,\n                                children: [\n                                  Text(label, textAlign: TextAlign.center, maxLines: 2, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: palette.signalDark, letterSpacing: 0.5)),\n                                  const SizedBox(height: 2),\n                                  FittedBox(fit: BoxFit.scaleDown, child: value),\n                                ],\n                              ),\n                            );\n                        final valueStyle = TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: palette.ink);\n                        return IntrinsicHeight(\n                          child: Row(\n                            crossAxisAlignment: CrossAxisAlignment.stretch,\n                            children: [\n                              Expanded(child: tile(tr(context, 'active_shipments').toUpperCase(), _AnimatedCountText(target: activeShipments, style: valueStyle))),\n                              if (_spendSummaryFuture != null) ...[\n                                const SizedBox(width: 8),\n                                Expanded(\n                                  child: FutureBuilder<Map<String, dynamic>>(\n                                    future: _spendSummaryFuture,\n                                    builder: (context, snapshot) {\n                                      final summary = snapshot.data;\n                                      final year = summary?['year'] ?? DateTime.now().year;\n                                      final label = isAr ? '${tr(context, 'annual_spend_label')} $year' : '$year ${tr(context, 'annual_spend_label')}';\n                                      // while it loads (or if it cannot): the same tile with a dash, so both tiles keep the same size\n                                      if (summary == null) return tile(label, Text('—', style: valueStyle));\n                                      final usdTotal = (summary['totalSpent'] as num).toDouble();\n                                      final currency = context.watch<CurrencyState>();\n                                      final converted = currency.convert(usdTotal);\n                                      final displayCurrencyCode = converted != null ? currency.currencyCode : 'USD';\n                                      return tile(\n                                        label,\n                                        _AnimatedCountText(target: (converted ?? usdTotal).round(), formatter: (v) => formatAmount(context, v.toDouble(), displayCurrencyCode), style: valueStyle),\n                                      );\n                                    },\n                                  ),\n                                ),\n                              ],\n                            ],\n                          ),\n                        );\n                      }\n"}}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-orders-top`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: buyer app: R (hot restart) in flutter run');
