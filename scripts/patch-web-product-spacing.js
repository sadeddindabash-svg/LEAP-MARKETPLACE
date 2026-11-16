#!/usr/bin/env node
/**
 * Website product page, PC, tablet and phone (confirmed with the person via mockup): every space between the blocks as small as the space
 * between product cards: 12 px on a phone, 16 px on a tablet and a computer (photos, details card, the two columns, "same part number",
 * reviews, the rows of parts, the cards in those rows, the page's top and bottom). Inside the name column: 8 px; 16 px above Add to cart.
 * Run AFTER patch-web-product-title and patch-web-product-order.
 *
 *   node scripts/patch-web-product-spacing.js            dry run
 *   node scripts/patch-web-product-spacing.js --write    applies it (each changed file is saved as <file>.before-patch-web-product-spacing first)
 * Then: website Ctrl+F5
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/web-storefront/app/products/[id]/page.tsx", "what": "website, product page: every space between the blocks 12 px phone / 16 px tablet and computer, 8 px inside the name column", "done": "px-3 py-3 sm:px-4 sm:py-4", "pairs": [["    <div className=\"mx-auto max-w-6xl px-6 py-10\">", "    <div className=\"mx-auto max-w-6xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6\">\n      {/* Every space between the blocks: 12 px phone, 16 px tablet and computer, like the space between product cards (confirmed with the person via mockup). */}", false], ["      <div className=\"grid gap-4 md:grid-cols-2 md:gap-10\">", "      <div className=\"grid gap-3 sm:gap-4 md:grid-cols-2\">", false], ["          <div className=\"mt-3 flex flex-wrap gap-2\">\n            <ProductChips", "          <div className=\"mt-2 flex flex-wrap gap-2\">\n            <ProductChips", false], ["          <div className=\"mt-8\">", "          <div className=\"mt-4\">", false], ["            <div className=\"mt-3 flex items-stretch gap-2\">", "            <div className=\"mt-2 flex items-stretch gap-2\">", false]]}, {"file": "apps/web-storefront/components/ProductDetails.tsx", "what": "website, product details card: 16 px under the photos (on a phone the page's own 12 px space)", "done": "bg-white p-5 md:mt-4\"", "pairs": [["className=\"mt-6 rounded-xl border border-line bg-white p-5\"", "className=\"rounded-xl border border-line bg-white p-5 md:mt-4\"", false]]}, {"file": "apps/web-storefront/components/StockBanner.tsx", "what": "website, stock box: 8 px above", "done": "`mt-2 flex w-fit", "pairs": [["className={`mt-5 flex w-fit max-w-full", "className={`mt-2 flex w-fit max-w-full", false]]}, {"file": "apps/web-storefront/components/SellerSignals.tsx", "what": "website, \"ships from\" lines: 8 px above", "done": "\"mt-2 flex flex-wrap gap-x-4", "pairs": [["<ul className=\"mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted\">", "<ul className=\"mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted\">", false]]}, {"file": "apps/web-storefront/components/PriceBlock.tsx", "what": "website, price: 8 px above", "done": "\"mt-2 flex flex-wrap items-center gap-x-3", "pairs": [["<div className=\"mt-5 flex flex-wrap items-center gap-x-3 gap-y-1\">", "<div className=\"mt-2 flex flex-wrap items-center gap-x-3 gap-y-1\">", false]]}, {"file": "apps/web-storefront/components/OemComparison.tsx", "what": "website, \"same part number\" block: 12 / 16 px above", "done": "\"mt-3 sm:mt-4\" aria-labelledby=\"oem-h\"", "pairs": [["<section className=\"mt-14\" aria-labelledby=\"oem-h\">", "<section className=\"mt-3 sm:mt-4\" aria-labelledby=\"oem-h\">", false], ["<p className=\"mb-5 mt-1 text-muted\">", "<p className=\"mb-2 mt-0.5 text-muted\">", false]]}, {"file": "apps/web-storefront/components/ReviewsSection.tsx", "what": "website, reviews: 12 / 16 px above, smaller gaps inside", "done": "mt-3 border-t border-line pt-3", "pairs": [["<section className=\"mt-16 border-t border-line pt-10\" aria-labelledby=\"rv-h\">", "<section className=\"mt-3 border-t border-line pt-3 sm:mt-4 sm:pt-4\" aria-labelledby=\"rv-h\">", false], ["<h2 id=\"rv-h\" className=\"mb-6 flex", "<h2 id=\"rv-h\" className=\"mb-3 flex", false], ["<div ref={formBox} className=\"mt-10 rounded-[14px]", "<div ref={formBox} className=\"mt-4 rounded-[14px]", false]]}, {"file": "apps/web-storefront/components/LazyProductRow.tsx", "what": "website, the rows of parts under a product: 12 / 16 px above and between the cards (the page already gives the side space)", "done": "gap-3 sm:gap-4 md:grid-cols-3", "pairs": [["<section aria-labelledby={id} className=\"mx-auto max-w-6xl px-6 pt-12\">", "<section aria-labelledby={id} className=\"pt-3 sm:pt-4\">", false], ["<h2 id={id} className=\"mb-6 text-2xl font-bold tracking-tight\">", "<h2 id={id} className=\"mb-2 text-2xl font-bold tracking-tight\">", false], ["gridClassName=\"grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4\"", "gridClassName=\"grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4\"", false], ["<div ref={anchor} className=\"mx-auto min-h-px max-w-6xl px-6 pt-12\"", "<div ref={anchor} className=\"min-h-px pt-3 sm:pt-4\"", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-web-product-spacing`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: website: Ctrl+F5');
