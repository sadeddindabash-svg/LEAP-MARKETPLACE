#!/usr/bin/env node
/**
 * Website product page, PC and tablet (confirmed with the person via mockup): "Same part, other suppliers" and Reviews move into the photo
 * column under Technical Specifications, all the same width, so the pinned name column stays until the reviews end. Phone: same order as before.
 * Run AFTER patch-web-product-gap20 and patch-web-reviews-width.
 *   node scripts/patch-web-product-pin-reviews.js            dry run
 *   node scripts/patch-web-product-pin-reviews.js --write    applies it
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/web-storefront/app/products/[id]/page.tsx", "what": "website, product page (PC and tablet): \"Same part, other suppliers\" and Reviews move under Technical Specifications, so the name column stays pinned until the reviews end", "done": "max-md:order-5\"><ReviewsSection", "pairs": [["          <div className=\"max-md:order-3\"><ProductDetails product={product} lang={lang} /></div>\n        </div>", "          <div className=\"max-md:order-3\"><ProductDetails product={product} lang={lang} /></div>\n          {/* \"Same part, other suppliers\" and the reviews sit in the photo column, under Technical Specifications, the same width: the name column beside\n              them stays pinned until the reviews end (confirmed with the person via mockup). On a phone they come after the details, as before. */}\n          <div className=\"max-md:order-4\"><OemComparison products={oemMatches} lang={lang} /></div>\n          <div className=\"max-md:order-5\"><ReviewsSection productId={product.id} summary={reviews} /></div>\n        </div>", false], ["      {/* The sections under a part, in the mobile app's order. Each one is drawn only when it has something to show. */}\n      <OemComparison products={oemMatches} lang={lang} />\n      <ReviewsSection productId={product.id} summary={reviews} />\n", "      {/* The rows under a part, in the mobile app's order (other suppliers and reviews are in the photo column above). Each one is drawn only when it has something to show. */}\n", false]]}, {"file": "apps/web-storefront/components/ReviewsSection.tsx", "what": "website, reviews: full width of the photo column (it now sits inside it)", "done": "sm:mt-4 sm:pt-4\" aria-labelledby=\"rv-h\">", "pairs": [["<section className=\"mt-3 border-t border-line pt-3 sm:mt-4 sm:pt-4 md:w-[calc(50%-0.5rem)]\" aria-labelledby=\"rv-h\">      {/* PC and tablet: as wide as the photo column (the \"Technical Specifications\" card); phone: full width */}", "<section className=\"mt-3 border-t border-line pt-3 sm:mt-4 sm:pt-4\" aria-labelledby=\"rv-h\">      {/* inside the photo column on PC and tablet, so as wide as \"Technical Specifications\"; phone: full width */}", false]]}, {"file": "apps/web-storefront/app/stickyColumn.test.tsx", "what": "website test: other suppliers and reviews are in the photo column, so the name column stays pinned until the reviews end", "done": "released only when the reviews end", "pairs": [["  it(\"is released where the photos and details end: the sections below (other listings, reviews) are NOT inside the two columns, so they are never covered\", async () => {\n    const root = await page(); const g = grid(root)!; expect(contains(g, OemComparison)).toBe(false); expect(contains(g, ReviewsSection)).toBe(false); expect(contains(root, ReviewsSection)).toBe(true); expect(contains(root, OemComparison)).toBe(true);", "  it(\"is released only when the reviews end: other suppliers and reviews are in the photo column, never in the pinned name column\", async () => {\n    const root = await page(); const g = grid(root)!; const [left, right] = kids(g); expect(contains(left, OemComparison)).toBe(true); expect(contains(left, ReviewsSection)).toBe(true); expect(contains(right, OemComparison)).toBe(false); expect(contains(right, ReviewsSection)).toBe(false);", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-web-product-pin-reviews`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: website: Ctrl+F5');
