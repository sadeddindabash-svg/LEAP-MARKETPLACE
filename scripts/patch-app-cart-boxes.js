#!/usr/bin/env node
/**
 * Buyer app basket (confirmed with the person via mockup): each quotation is ONE box with a gold edge (its navy header and its parts); the other parts are a second
 * box (with "OTHER PARTS" when a quotation is above); inside a box the parts are plain lines with a thin line between them instead of a card each. 8 between boxes.
 *
 *   node scripts/patch-app-cart-boxes.js            dry run
 *   node scripts/patch-app-cart-boxes.js --write    applies it (the changed file is saved as <file>.before-patch-app-cart-boxes first)
 * Then: buyer app: R (hot restart)
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/mobile/lib/features/cart/cart_screen.dart", "what": "buyer app basket: each quotation in one box (its header and its parts, gold edge), the other parts in another box, thin lines between the parts", "done": "List<Widget> _boxRows(", "pairs": [["        if (cart.items.any((i) => i.quotationId != null) && cart.items.any((i) => i.quotationId == null))\n          Padding(\n            padding: const EdgeInsets.fromLTRB(2, 0, 2, 8),\n            child: Text(\n              context.watch<LanguageState>().isArabic ? 'قطع أخرى' : 'OTHER PARTS',\n              style: const TextStyle(color: Color(0xFFC98A00), fontWeight: FontWeight.w800, fontSize: 11.5, letterSpacing: .5),\n            ),\n          ),\n        for (final entry in grouped.entries)\n          if (entry.value.any((i) => i.quotationId == null))\n            _SupplierGroup(supplierName: entry.key, items: entry.value.where((i) => i.quotationId == null).toList()),\n", "        // The other parts, from the catalogue: one box of their own (with a small heading when a quotation's box is above it).\n        if (cart.items.any((i) => i.quotationId == null))\n          Container(\n            margin: const EdgeInsets.only(bottom: 8),\n            padding: const EdgeInsets.fromLTRB(10, 2, 10, 2),\n            decoration: Premium.card(context),\n            child: Column(\n              crossAxisAlignment: CrossAxisAlignment.stretch,\n              children: [\n                if (cart.items.any((i) => i.quotationId != null))\n                  Padding(\n                    padding: const EdgeInsetsDirectional.fromSTEB(2, 8, 2, 0),\n                    child: Text(\n                      context.watch<LanguageState>().isArabic ? 'قطع أخرى' : 'OTHER PARTS',\n                      style: const TextStyle(color: Color(0xFFC98A00), fontWeight: FontWeight.w800, fontSize: 11.5, letterSpacing: .5),\n                    ),\n                  ),\n                ..._boxRows([for (final entry in grouped.entries) ...entry.value.where((i) => i.quotationId == null)]),\n              ],\n            ),\n          ),\n", false], ["/// The parts of one quotation, together: a navy header (its number, who it is for, the car; tap it to open the quotation) over its lines, edged in gold.", "/// The parts inside one box: plain lines, a thin line between them (the box is the card, not each part).\nList<Widget> _boxRows(List<CartItem> items) => [\n      for (var n = 0; n < items.length; n++) _CartItemRow(key: ValueKey(items[n].productId), item: items[n], inBox: true, lineAbove: n > 0),\n    ];\n\n/// The parts of one quotation, in one box of their own with a gold edge: a navy header (its number, who it is for, the car; tap it to open the quotation) over its lines.", false], ["    return Container(\n      // no gap of its own: its last line already ends with the 8 gap\n      child: Column(\n        crossAxisAlignment: CrossAxisAlignment.stretch,\n        children: [\n          InkWell(\n            borderRadius: BorderRadius.circular(14),\n            onTap: () => context.push('/quotations/", "    return Container(\n      margin: const EdgeInsets.only(bottom: 8),\n      padding: const EdgeInsets.fromLTRB(8, 8, 8, 2),\n      decoration: Premium.card(context, ring: Premium.gold),\n      child: Column(\n        crossAxisAlignment: CrossAxisAlignment.stretch,\n        children: [\n          InkWell(\n            borderRadius: BorderRadius.circular(14),\n            onTap: () => context.push('/quotations/", false], ["          const SizedBox(height: 8),\n          Container(\n            padding: const EdgeInsetsDirectional.only(start: 8),\n            decoration: const BoxDecoration(border: BorderDirectional(start: BorderSide(color: Premium.gold, width: 3))),\n            child: Column(children: [for (final item in items) _CartItemRow(key: ValueKey(item.productId), item: item)]),\n          ),", "          const SizedBox(height: 2),\n          ..._boxRows(items),", false], ["class _SupplierGroup extends StatelessWidget {\n  final String supplierName;\n  final List<CartItem> items;\n  const _SupplierGroup({required this.supplierName, required this.items});\n\n  @override\n  Widget build(BuildContext context) {\n    return Container(\n      // no gap of its own: its last line already ends with the 8 gap\n      child: Column(\n        crossAxisAlignment: CrossAxisAlignment.start,\n        children: [\n          for (final item in items) _CartItemRow(key: ValueKey(item.productId), item: item),\n        ],\n      ),\n    );\n  }\n}\n\n", "", false], ["  final CartItem item;\n  const _CartItemRow({super.key, required this.item});", "  final CartItem item;\n  /// Inside a box (a quotation's, or the other parts'): no card of its own; [lineAbove] draws the thin line between two parts.\n  final bool inBox;\n  final bool lineAbove;\n  const _CartItemRow({super.key, required this.item, this.inBox = false, this.lineAbove = false});", false], ["      margin: const EdgeInsets.only(bottom: 8),\n      padding: const EdgeInsets.all(12),\n      decoration: Premium.card(context),\n      // Real, new -- tapping the row", "      margin: widget.inBox ? EdgeInsets.zero : const EdgeInsets.only(bottom: 8),\n      padding: widget.inBox ? const EdgeInsets.symmetric(vertical: 10, horizontal: 2) : const EdgeInsets.all(12),\n      decoration: widget.inBox ? (widget.lineAbove ? BoxDecoration(border: Border(top: BorderSide(color: palette.line))) : null) : Premium.card(context),\n      // Real, new -- tapping the row", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-app-cart-boxes`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: buyer app: R (hot restart)');
