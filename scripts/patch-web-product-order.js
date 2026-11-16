#!/usr/bin/env node
/**
 * Website product page, PC, tablet and phone (confirmed with the person via mockup), beside / under the photos in this order:
 *   the name, the description, the category and the car it fits (the two chips), the stock box (then who ships it, the price, the buttons, as before).
 * Run AFTER patch-web-product-title. Also brings the page's tests up to date (the column now starts with the name itself).
 *
 *   node scripts/patch-web-product-order.js            dry run
 *   node scripts/patch-web-product-order.js --write    applies it (each changed file is saved as <file>.before-patch-web-product-order first)
 * Then: website Ctrl+F5
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/web-storefront/app/products/[id]/page.tsx", "what": "website, product page: name, description, category and car it fits, stock", "done": "the name, the description, then the chips", "pairs": [["          <div className=\"mt-3 flex flex-wrap gap-2\">\n            <ProductChips product={product} lang={lang} />\n          </div>\n          {product.description?.trim() && (\n            <p data-testid=\"product-summary\" className=\"mt-3.5 whitespace-pre-line text-base leading-relaxed text-ink/80 [overflow-wrap:anywhere]\">{product.description.trim()}</p>\n          )}\n", "          {/* In this order (confirmed with the person via mockup): the name, the description, then the chips (the part class and the car it fits), then the stock box. */}\n          {product.description?.trim() && (\n            <p data-testid=\"product-summary\" className=\"mt-2 whitespace-pre-line text-base leading-relaxed text-ink/80 [overflow-wrap:anywhere]\">{product.description.trim()}</p>\n          )}\n          <div className=\"mt-3 flex flex-wrap gap-2\">\n            <ProductChips product={product} lang={lang} />\n          </div>\n", false]]}, {"file": "apps/web-storefront/app/productDescription.test.tsx", "what": "website test: the description comes right after the name, before the chips", "done": "right after the name, before the chips", "pairs": [["  it(\"comes right after the title and the chips and before the stock box, the seller lines, the price block and the buttons\", async () => {\n    const { right } = columns(await page({ description: DESC })); const types = kids(right).map((c) => c.type); expect(types).toEqual([\"div\", \"div\", \"p\", StockBanner, SellerSignals, PriceBlock, \"div\"]);", "  it(\"comes right after the name, before the chips, the stock box, the seller lines, the price block and the buttons\", async () => {\n    const { right } = columns(await page({ description: DESC })); const types = kids(right).map((c) => c.type); expect(types).toEqual([\"h1\", \"p\", \"div\", StockBanner, SellerSignals, PriceBlock, \"div\"]);", false], ["  it(\"is 16 px with comfortable line spacing, in the page's text colour at 80%, 14 px below the chips\", async () => {\n    const c = (SUMMARY(columns(await page({ description: DESC })).right)!.props.className as string).split(\" \"); for (const k of [\"text-base\", \"leading-relaxed\", \"text-ink/80\", \"mt-3.5\"]) expect(c, k).toContain(k);", "  it(\"is 16 px with comfortable line spacing, in the page's text colour at 80%, 8 px below the name\", async () => {\n    const c = (SUMMARY(columns(await page({ description: DESC })).right)!.props.className as string).split(\" \"); for (const k of [\"text-base\", \"leading-relaxed\", \"text-ink/80\", \"mt-2\"]) expect(c, k).toContain(k);", false]]}, {"file": "apps/web-storefront/app/productFits.test.tsx", "what": "website test: the chips come after the name and the description", "done": "after the name and the description", "pairs": [["const el = kids(kids(right)[1]).find((c) => c.type === ProductChips);", "const el = kids(right).flatMap((d) => kids(d)).find((c) => c.type === ProductChips);", false], ["  it(\"the chip is in the same place as before: second in the column (after the title), before the description and the stock box\", async () => { const { right } = columns(await page({ fitGroups: [grp(\"Seal\", [[2022, 2024]])], fitGroupCount: 1, description: \"x\" } as never)); expect(kids(right).map((c) => c.type).slice(0, 3)).toEqual([\"div\", \"div\", \"p\"]); });", "  it(\"the chips come after the name and the description, before the stock box\", async () => { const { right } = columns(await page({ fitGroups: [grp(\"Seal\", [[2022, 2024]])], fitGroupCount: 1, description: \"x\" } as never)); expect(kids(right).map((c) => c.type).slice(0, 3)).toEqual([\"h1\", \"p\", \"div\"]); });", false]]}, {"file": "apps/web-storefront/app/productParity.test.tsx", "what": "website test: the column starts with the name (h1), then the chips", "done": "[\"h1\", \"div\", StockBanner", "pairs": [["expect(types).toEqual([\"div\", \"div\", StockBanner, SellerSignals, PriceBlock, \"div\"]);", "expect(types).toEqual([\"h1\", \"div\", StockBanner, SellerSignals, PriceBlock, \"div\"]);", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-web-product-order`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: website: Ctrl+F5');
