#!/usr/bin/env node
/**
 * Product prices in RMB (yuan) only (confirmed with the person):
 *  - Products still marked in another currency (older products, from before suppliers priced in RMB only) keep their number, relabelled as yuan.
 *  - Order lines that had no supplier price because of that get it (e.g. LP-201353), so it shows in the supplier portal's order details.
 *  - The database refuses any product price in another currency from now on (migration 132), whatever adds it.
 *  - The sample products in the dev data (db/seed.js) are priced in RMB too.
 *
 *   node scripts/patch-prices-rmb-only.js            dry run
 *   node scripts/patch-prices-rmb-only.js --write    applies it
 * Then: cd services\api ; npm run migrate ; restart the API.
 *
 * A file that is not as this patch expects is NOT changed. Windows (CRLF) line endings are handled. Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created":[{"file":"services/api/db/migrations/132_prices_rmb_only.sql","what":"database: every product price in RMB, and only RMB from now on (migration 132)","text":"-- Migration 132: every product price is in RMB (yuan), and only RMB from now on (confirmed with the person).\n-- Products still marked in another currency (older products, from before suppliers priced in RMB only) keep their number, relabelled as yuan:\n-- the person confirmed those numbers were yuan.\nUPDATE products SET currency_code = 'CNY' WHERE currency_code IS DISTINCT FROM 'CNY';\n\n-- Order lines that had no supplier RMB price because their product was not in RMB: the product's price, now in yuan (the supplier portal's order\n-- details, payouts and profits read it).\nUPDATE order_line_items oli SET supplier_unit_price_cny = ROUND(p.price::numeric, 2)\n  FROM products p\n  WHERE p.id = oli.product_id AND oli.supplier_unit_price_cny IS NULL AND p.price IS NOT NULL AND p.price >= 0;\n\n-- And never anything else: the database itself refuses a product price in any other currency.\nALTER TABLE products ALTER COLUMN currency_code SET DEFAULT 'CNY';\nALTER TABLE products ALTER COLUMN currency_code SET NOT NULL;\nALTER TABLE products DROP CONSTRAINT IF EXISTS products_price_rmb_only;\nALTER TABLE products ADD CONSTRAINT products_price_rmb_only CHECK (currency_code = 'CNY');\n"}],"anchored":[{"file":"services/api/db/seed.js","what":"dev data: the sample products are priced in RMB too","done":"'brake', 34.90, 'CNY', 100000","pairs":[["'brake', 34.90, 'USD', 100000","'brake', 34.90, 'CNY', 100000"],["'filters', 6.90, 'USD', 100000","'filters', 6.90, 'CNY', 100000"],["'transmission', 210.00, 'USD', 40","'transmission', 210.00, 'CNY', 40"]],"optional":true}]};
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
    if (!n.includes(e.done) && (e.pairs.some(([a]) => !once(n, a)) || (e.block && (!n.includes(e.block.from) || !n.includes(e.block.to))))) { console.log(`skipped   ${e.file}: not as expected, left as it is (${e.what})`); continue; }
  }
  edit(e.file, e.what, e.done, (s) => {
    let out = s;
    for (const [a, b, all] of e.pairs) { if (all) { if (!out.includes(a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.split(a).join(b); continue; } if (!once(out, a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(a, () => b); }
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-prices-rmb-only`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: cd services\\api ; npm run migrate ; restart the API.');
