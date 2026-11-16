#!/usr/bin/env node
/**
 * Buyer app product cards (confirmed with the person via mockup): the empty space under the delivery date is gone (every line has a fixed height and the card is
 * exactly as tall as they are: photo + 156 instead of photo + 181); the stock is in a coloured box with white text, as on the website (green in stock, red out
 * of stock, orange when only a few are left). The card's text does not grow with the phone's font size, so it always fits.
 *
 *   node scripts/patch-app-product-card-tight.js            dry run
 *   node scripts/patch-app-product-card-tight.js --write    applies it (the changed file is saved as <file>.before-patch-app-product-card-tight first)
 * Then: buyer app: R (hot restart)
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/mobile/lib/widgets/product_card.dart", "what": "buyer app product cards: no empty space under the delivery date (every line a fixed height), the stock in a coloured box", "done": "return imageHeight + 156;", "pairs": [["  return imageHeight + 181;\n}", "  // Every line under the photo now has a fixed height (confirmed with the person via mockup: no empty space under the delivery date): padding 8 + 6 +\n  // name 33.2 + 4 + stars 14 + 4 + stock box 18 + 6 + price row 34 + 4 + delivery 16 + padding 8 = 155.2.\n  return imageHeight + 156;\n}", false], ["    return SizedBox.expand(\n      child: Container(\n        decoration: Premium.card(context, radius: 12),", "    // the card's text does not grow with the phone's font size: every line has a fixed place (above), so a larger font could not fit\n    return MediaQuery.withClampedTextScaling(\n      maxScaleFactor: 1.0,\n      child: SizedBox.expand(\n      child: Container(\n        decoration: Premium.card(context, radius: 12),", false], ["              const SizedBox(height: 4),\n              Row(\n                children: [\n                  Icon(p.rating > 0 ? Icons.star : Icons.star_border, size: 13, color: const Color(0xFFF5A623)),\n                  const SizedBox(width: 3),\n                  Text(\n                    p.reviewCount > 0 ? '${p.rating.toStringAsFixed(1)} (${p.reviewCount})' : tr(context, 'no_reviews_yet'),\n                    style: TextStyle(fontSize: 10.5, color: palette.muted),\n                    overflow: TextOverflow.ellipsis,\n                  ),\n                ],\n              ),\n              const SizedBox(height: 3),\n              Row(\n                children: [\n                  Icon(Icons.circle, size: 6, color: !inStock ? Colors.red : (p.stockQuantity <= 5 ? palette.torque : palette.gauge)),\n                  const SizedBox(width: 4),\n                  Text(\n                    // Real low-stock countdown (#8), same real threshold\n                    // and treatment as Product Detail's own.\n                    !inStock\n                        ? tr(context, 'out_of_stock')\n                        : p.stockQuantity <= 5\n                            ? (isAr ? 'متبقٍ ${p.stockQuantity} فقط' : 'Only ${p.stockQuantity} left')\n                            : tr(context, 'in_stock'),\n                    style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: !inStock ? Colors.red : (p.stockQuantity <= 5 ? palette.torque : palette.gauge)),\n                  ),\n                ],\n              ),\n              const SizedBox(height: 6),\n              Row(", "              const SizedBox(height: 4),\n              SizedBox(\n                height: 14,\n                child: Row(\n                  children: [\n                    Icon(p.rating > 0 ? Icons.star : Icons.star_border, size: 13, color: const Color(0xFFF5A623)),\n                    const SizedBox(width: 3),\n                    Flexible(\n                      child: Text(\n                        p.reviewCount > 0 ? '${p.rating.toStringAsFixed(1)} (${p.reviewCount})' : tr(context, 'no_reviews_yet'),\n                        style: TextStyle(fontSize: 10.5, height: 1.2, color: palette.muted),\n                        maxLines: 1,\n                        overflow: TextOverflow.ellipsis,\n                      ),\n                    ),\n                  ],\n                ),\n              ),\n              const SizedBox(height: 4),\n              // The stock in a coloured box with white text, as on the website: green in stock, red out of stock, orange when only a few are left.\n              SizedBox(\n                height: 18,\n                child: Align(\n                  alignment: AlignmentDirectional.centerStart,\n                  child: Container(\n                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),\n                    decoration: BoxDecoration(\n                      color: !inStock ? const Color(0xFFC62F26) : (p.stockQuantity <= 5 ? const Color(0xFFC2410C) : const Color(0xFF0F6B49)),\n                      borderRadius: BorderRadius.circular(5),\n                    ),\n                    child: Text(\n                      // Real low-stock countdown (#8), same real threshold\n                      // and treatment as Product Detail's own.\n                      !inStock\n                          ? tr(context, 'out_of_stock')\n                          : p.stockQuantity <= 5\n                              ? (isAr ? 'متبقٍ ${p.stockQuantity} فقط' : 'Only ${p.stockQuantity} left')\n                              : tr(context, 'in_stock'),\n                      maxLines: 1,\n                      style: const TextStyle(fontSize: 10.5, height: 1.2, fontWeight: FontWeight.w700, color: Colors.white),\n                    ),\n                  ),\n                ),\n              ),\n              const SizedBox(height: 6),\n              SizedBox(\n                height: 34,\n                child: Row(", false], ["                        Text(\n                          formatPrice(context, p.price),\n                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: palette.ink),", "                        Text(\n                          formatPrice(context, p.price),\n                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, height: 1.2, color: palette.ink),", false], ["                                  style: TextStyle(fontSize: 11, color: palette.muted, decoration: TextDecoration.lineThrough),", "                                  style: TextStyle(fontSize: 11, height: 1.2, color: palette.muted, decoration: TextDecoration.lineThrough),", false], ["style: TextStyle(fontSize: 10, fontWeight: FontWeight.w500, fontStyle: FontStyle.italic, color: discountTagTextColor(discountPercent)),", "style: TextStyle(fontSize: 10, height: 1.2, fontWeight: FontWeight.w500, fontStyle: FontStyle.italic, color: discountTagTextColor(discountPercent)),", false], ["                ],\n              ),\n              const SizedBox(height: 5),\n              Visibility(\n                visible: inStock,\n                maintainSize: true,\n                maintainAnimation: true,\n                maintainState: true,\n                child: Container(\n                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),\n                  decoration: BoxDecoration(color: palette.gauge.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(5)),\n                  child: Text(\n                    isAr ? 'التسليم: ${p.deliveryDateLabel(true)}' : 'Delivery: ${p.deliveryDateLabel(false)}',\n                    style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: palette.gauge),\n                  ),\n                ),\n              ),\n            ],\n          ),\n        ),\n      ),\n      ),\n      ),\n    );", "                ],\n                ),\n              ),\n              const SizedBox(height: 4),\n              SizedBox(\n                height: 16,\n                child: Align(\n                  alignment: AlignmentDirectional.centerStart,\n                  child: Visibility(\n                    visible: inStock,\n                    maintainSize: true,\n                    maintainAnimation: true,\n                    maintainState: true,\n                    child: Container(\n                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),\n                      decoration: BoxDecoration(color: palette.gauge.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(5)),\n                      child: Text(\n                        isAr ? 'التسليم: ${p.deliveryDateLabel(true)}' : 'Delivery: ${p.deliveryDateLabel(false)}',\n                        maxLines: 1,\n                        style: TextStyle(fontSize: 9, height: 1.2, fontWeight: FontWeight.w700, color: palette.gauge),\n                      ),\n                    ),\n                  ),\n                ),\n              ),\n            ],\n          ),\n        ),\n      ),\n      ),\n      ),\n      ),\n    );", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-app-product-card-tight`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: buyer app: R (hot restart)');
