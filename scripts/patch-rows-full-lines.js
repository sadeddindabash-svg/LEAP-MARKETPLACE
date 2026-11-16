#!/usr/bin/env node
/**
 * "Same model" and "same brand" under a product show full lines only (confirmed with the person via mockup):
 * website computer and tablet: 4 per line, a multiple of 4 (tablet goes from 3 to 4 per line for these rows); phone web and app: a multiple of 2.
 * Fewer than one line shows nothing. "Newest products" is unchanged.
 * Run AFTER patch-web-product-pin-reviews.
 *   node scripts/patch-rows-full-lines.js            dry run
 *   node scripts/patch-rows-full-lines.js --write    applies it
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/web-storefront/components/LazyProductRow.tsx", "what": "website, product rows: \"fullRows\" shows only full lines (computer and tablet: multiples of 4, 4 per line; phone: multiples of 2)", "done": "fullRows", "pairs": [["export default function LazyProductRow({ id, title, source, pageSize = 8, maxExtraPages, hiddenId }: Props) {", "// fullRows (same model, same brand; confirmed with the person via mockup): only full lines are shown. Tablet and computer: 4 per line and a\n// multiple of 4 (an unfinished last line is hidden); phone: 2 per line and a multiple of 2 (an odd last card is hidden). Fewer than one line\n// shows nothing. Done by the page's styles, so it also holds for the batches that load while scrolling.\nconst FULL_ROWS_GRID = \"grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 max-md:[&>*:last-child:nth-child(odd)]:hidden md:[&>*:nth-child(4n+1):nth-last-child(-n+3)]:hidden md:[&>*:nth-child(4n+1):nth-last-child(-n+3)~*]:hidden\";\nconst NORMAL_GRID = \"grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4\";\n\nexport default function LazyProductRow({ id, title, source, pageSize = 8, maxExtraPages, hiddenId, fullRows = false }: Props & { fullRows?: boolean }) {", false], ["maxExtraPages={maxExtraPages} gridClassName=\"grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4\" />", "maxExtraPages={maxExtraPages} gridClassName={fullRows ? FULL_ROWS_GRID : NORMAL_GRID} />", false]]}, {"file": "apps/web-storefront/app/products/[id]/page.tsx", "what": "website, product page: \"same model\" and \"same brand\" show full lines only", "done": "pageSize={8} maxExtraPages={2} fullRows />", "pairs": [["source={{ kind: \"sameModel\", productId: product.id }} pageSize={8} maxExtraPages={2} />", "source={{ kind: \"sameModel\", productId: product.id }} pageSize={8} maxExtraPages={2} fullRows />", false], ["source={{ kind: \"sameBrand\", productId: product.id }} pageSize={8} maxExtraPages={2} />", "source={{ kind: \"sameBrand\", productId: product.id }} pageSize={8} maxExtraPages={2} fullRows />", false]]}, {"file": "apps/mobile/lib/widgets/lazy_product_grid.dart", "what": "app, product grids: \"evenOnly\" shows only full lines of 2", "done": "widget.evenOnly", "pairs": [["  final String Function(List<Product> loadedSoFar) buildHeader;\n  const LazyProductGrid({super.key, required this.fetchPage, required this.buildHeader});", "  final String Function(List<Product> loadedSoFar) buildHeader;\n  // evenOnly (same brand; confirmed with the person via mockup): only full lines of 2, an odd last card is left out; a single card shows nothing.\n  final bool evenOnly;\n  const LazyProductGrid({super.key, required this.fetchPage, required this.buildHeader, this.evenOnly = false});", false], ["    if (!_initialLoadDone || _items.isEmpty) return const SizedBox.shrink();\n    final palette = LeapPalette.of(context);", "    final shown = widget.evenOnly ? _items.length - _items.length % 2 : _items.length;\n    if (!_initialLoadDone || shown == 0) return const SizedBox.shrink();\n    final palette = LeapPalette.of(context);", false], ["                itemCount: _items.length,\n                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(", "                itemCount: shown,\n                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(", false]]}, {"file": "apps/mobile/lib/widgets/same_brand_section.dart", "what": "app, same brand: full lines of 2 only", "done": "evenOnly: true", "pairs": [["    return LazyProductGrid(\n      fetchPage:", "    return LazyProductGrid(\n      evenOnly: true,      // only full lines of 2 (confirmed with the person via mockup)\n      fetchPage:", false]]}, {"file": "apps/mobile/lib/widgets/alternatives_section.dart", "what": "app, similar products (same model): a multiple of 2 only", "done": "all.length % 2", "pairs": [["        final alternatives = snapshot.data ?? [];", "        final all = snapshot.data ?? [];\n        // only a multiple of 2 (confirmed with the person via mockup): an odd last part is left out, a single one shows nothing\n        final alternatives = all.take(all.length - all.length % 2).toList();", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-rows-full-lines`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: website: Ctrl+F5; app: R (hot restart)');
