#!/usr/bin/env node
/**
 * Product page: the "Customer photos" section after the reviews is removed. The photos inside each review stay as they are.
 *
 *   node scripts/patch-no-customer-photos.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-no-customer-photos.js --write    applies it (each changed file is saved as <file>.before-no-customer-photos first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied).
 * Windows (CRLF) line endings are handled. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/app/products/[id]/page.tsx", "what": "the product page: no \"Customer photos\" section after the reviews (photos stay inside each review)", "done": "<ReviewsSection productId={product.id} summary={reviews} />\n      {(product.model", "pairs": [["import { AddToCartButton } from \"@/components/AddToCartButton\";\nimport CustomerPhotos from \"@/components/CustomerPhotos\";\nimport LazyProductRow from \"@/components/LazyProductRow\";\n", "import { AddToCartButton } from \"@/components/AddToCartButton\";\nimport LazyProductRow from \"@/components/LazyProductRow\";\n"], ["      <ReviewsSection productId={product.id} summary={reviews} />\n      <CustomerPhotos reviews={reviews.reviews} lang={lang} />\n      {(product.model || (product.fitCarCount ?? 0) > 0) && (\n", "      <ReviewsSection productId={product.id} summary={reviews} />\n      {(product.model || (product.fitCarCount ?? 0) > 0) && (\n"]]}, {"file": "apps/web-storefront/app/stage1c-page.test.tsx", "what": "the product page's tests: the section order without it", "done": "no separate \"Customer photos\" section", "pairs": [["import ReviewsSection from \"@/components/ReviewsSection\";\nimport CustomerPhotos from \"@/components/CustomerPhotos\";\nimport LazyProductRow from \"@/components/LazyProductRow\";\n", "import ReviewsSection from \"@/components/ReviewsSection\";\nimport LazyProductRow from \"@/components/LazyProductRow\";\n"], ["  const found: El[] = [];\n  const watched = [OemComparison, ReviewsSection, CustomerPhotos, LazyProductRow, ProductGallery, ProductDetails, NotifyWhenInStock, ShareButton];\n  const walk = (node: unknown): void => {\n", "  const found: El[] = [];\n  const watched = [OemComparison, ReviewsSection, LazyProductRow, ProductGallery, ProductDetails, NotifyWhenInStock, ShareButton];\n  const walk = (node: unknown): void => {\n"], ["describe(\"the full product page\", () => {\n  const ROW = [\"ProductDetails\", \"OemComparison\", \"ReviewsSection\", \"CustomerPhotos\", \"LazyProductRow\", \"LazyProductRow\", \"LazyProductRow\"];\n  const content = (els: El[]) => els.filter((e) => ![\"ProductGallery\", \"NotifyWhenInStock\", \"ShareButton\"].includes((e.type as { name: string }).name));\n", "describe(\"the full product page\", () => {\n  const ROW = [\"ProductDetails\", \"OemComparison\", \"ReviewsSection\", \"LazyProductRow\", \"LazyProductRow\", \"LazyProductRow\"];\n  const content = (els: El[]) => els.filter((e) => ![\"ProductGallery\", \"NotifyWhenInStock\", \"ShareButton\"].includes((e.type as { name: string }).name));\n"], ["\n  it(\"CRITICAL: the sections come in this order: the details under the photos, other listings, reviews, customer photos, more parts of the same model, of the same brand, the newest\", async () => {\n    expect(names(content(await render()))).toEqual(ROW);\n", "\n  it(\"CRITICAL: the sections come in this order: the details under the photos, other listings, reviews (their photos are inside each review; no separate \"Customer photos\" section), more parts of the same model, of the same brand, the newest\", async () => {\n    expect(names(content(await render()))).toEqual(ROW);\n"], ["    m.product.current = detail({ brand: null, model: null, year: null });\n    expect(names(content(await render()))).toEqual([\"ProductDetails\", \"OemComparison\", \"ReviewsSection\", \"CustomerPhotos\", \"LazyProductRow\"]);\n  });\n", "    m.product.current = detail({ brand: null, model: null, year: null });\n    expect(names(content(await render()))).toEqual([\"ProductDetails\", \"OemComparison\", \"ReviewsSection\", \"LazyProductRow\"]);\n  });\n"]]}], "created": []};
const once = (s, a) => s.split(a).length === 2;
const plan = [];
let problems = 0;
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const c = (x) => (s.includes('\r\n') ? x.replace(/\r?\n/g, '\r\n') : x);
  if (s.includes(c(e.done))) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  let out = s;
  for (const [a0, b0] of e.pairs) { const a = c(a0), b = c(b0); if (!once(out, a)) { out = null; break; } out = out.replace(a, () => b); }
  if (out === null) { console.log(`REFUSED   ${e.file}: its text is not what this patch expects, so nothing was changed. Send this file.`); problems++; continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: out });
}
for (const e of DATA.created) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(path.dirname(p))) { console.log(`MISSING   ${path.dirname(e.file)}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  if (fs.existsSync(p)) {
    const s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    if (s === e.text) { console.log(`already   ${e.file}: ${e.what}`); continue; }
    console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
  }
  plan.push({ file: e.file, what: e.what, before: null, after: e.text });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) {
    const p = path.join(root, c.file);
    if (c.before !== null) fs.writeFileSync(`${p}.before-no-customer-photos`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Ctrl+F5 on the website.');
