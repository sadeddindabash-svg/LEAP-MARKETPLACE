#!/usr/bin/env node
/**
 * Website product page, PC, tablet and phone (confirmed with the person via mockup):
 *  - no heart beside the name; the name has the whole width and at most 2 lines (20 px phone and tablet, 26 px computer; longer ends with "…", full on hover);
 *  - Share moves down, on one line with "Add to wishlist" under Add to cart;
 *  - phone: the photos, then the name (with price and buttons), then the details card.
 *
 *   node scripts/patch-web-product-title.js            dry run
 *   node scripts/patch-web-product-title.js --write    applies it (each changed file is saved as <file>.before-patch-web-product-title first)
 * Then: website Ctrl+F5
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/web-storefront/app/products/[id]/page.tsx", "what": "website, product page: name on 2 lines with all the width (no heart, no Share beside it), Share next to \"Add to wishlist\", phone order: photos, name, details", "done": "line-clamp-2", "pairs": [["import WishlistHeart from \"@/components/WishlistHeart\";\n", "", false], ["      <div className=\"grid md:grid-cols-2 gap-10\">\n        <div>\n          <ProductGallery images={product.images.map(resolveImageUrl)} alt={product.name} />\n          <ProductDetails product={product} lang={lang} />\n        </div>", "      {/* On a phone (one column) the order is: the photos, the name with the price and the buttons, then the details card (confirmed with the person).\n          The left column is \"contents\" there, so its two parts take their own places; on a tablet and a computer it is the column beside the name, as before. */}\n      <div className=\"grid gap-4 md:grid-cols-2 md:gap-10\">\n        <div className=\"max-md:contents\">\n          <div className=\"max-md:order-1\"><ProductGallery images={product.images.map(resolveImageUrl)} alt={product.name} /></div>\n          <div className=\"max-md:order-3\"><ProductDetails product={product} lang={lang} /></div>\n        </div>", false], ["<div className=\"md:sticky md:top-[calc(var(--header-h,0px)+1rem)]", "<div className=\"max-md:order-2 md:sticky md:top-[calc(var(--header-h,0px)+1rem)]", false], ["          <div className=\"flex items-start justify-between gap-3\">\n            <h1 className=\"font-display min-w-0 font-bold text-4xl tracking-tight [overflow-wrap:anywhere]\">\n              {product.name}\n            </h1>\n            <div className=\"flex shrink-0 items-center gap-2\">\n              <WishlistHeart productId={product.id} name={product.name} variant=\"page\" />\n              <ShareButton title={product.name} />\n            </div>\n          </div>", "          {/* The name has the whole width and at most 2 lines (confirmed with the person via mockup): phone and tablet 20 px, computer 26 px; a longer one ends with \"…\" and shows in full on hover. */}\n          <h1 title={product.name} className=\"font-display line-clamp-2 font-bold text-[20px] leading-[1.2] tracking-tight [overflow-wrap:anywhere] lg:text-[26px]\">\n            {product.name}\n          </h1>", false], ["            <WishlistButton productId={product.id} />\n", "            {/* \"Add to wishlist\" and Share on one line under Add to cart */}\n            <div className=\"mt-3 flex items-stretch gap-2\">\n              <div className=\"min-w-0 flex-1 [&>*]:mt-0\">\n                <WishlistButton productId={product.id} />\n              </div>\n              <ShareButton title={product.name} boxed />\n            </div>\n", false]]}, {"file": "apps/web-storefront/components/ShareButton.tsx", "what": "website, Share: a boxed look for beside \"Add to wishlist\"", "done": "boxed?: boolean", "pairs": [["export default function ShareButton({ title }: { title: string }) {", "export default function ShareButton({ title, boxed = false }: { title: string; boxed?: boolean }) {", false], ["    <button type=\"button\" onClick={share} className=\"inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-bold text-navy underline underline-offset-4 hover:bg-chalk\">", "    <button type=\"button\" onClick={share} className={boxed\n      ? \"inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-line px-4 py-3 font-bold text-navy transition-colors hover:border-signal hover:text-signal\"      // beside \"Add to wishlist\", same height and border\n      : \"inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-bold text-navy underline underline-offset-4 hover:bg-chalk\"}>", false]]}, {"file": "apps/web-storefront/components/WishlistHeartPlacement.test.tsx", "what": "website test: the product page has no heart now, Share sits beside \"Add to wishlist\"", "done": "no heart beside the name", "pairs": [["  it(\"the product page puts the heart right before Share, in the title row, beside the name\", () => { const s = read(\"app/products/[id]/page.tsx\"); expect(s).toContain('<WishlistHeart productId={product.id} name={product.name} variant=\"page\" />\\n              <ShareButton title={product.name} />'); expect(s.indexOf(\"</h1>\")).toBeLessThan(s.indexOf(\"<WishlistHeart\")); expect(s).toContain('import WishlistHeart from \"@/components/WishlistHeart\";'); expect(s).toContain(\"<WishlistButton productId={product.id} />\"); });", "  it(\"the product page: no heart beside the name; Share sits right after the wide Add to wishlist button\", () => { const s = read(\"app/products/[id]/page.tsx\"); expect(s).not.toContain(\"<WishlistHeart\"); expect(s).toContain(\"line-clamp-2\"); expect(s.indexOf(\"<WishlistButton productId={product.id} />\")).toBeLessThan(s.indexOf(\"<ShareButton title={product.name} boxed />\")); expect(s.indexOf(\"</h1>\")).toBeLessThan(s.indexOf(\"<WishlistButton\")); });", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-web-product-title`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: website: Ctrl+F5');
