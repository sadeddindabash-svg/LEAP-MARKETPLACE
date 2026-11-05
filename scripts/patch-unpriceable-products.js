#!/usr/bin/env node
/**
 * Fixes "ApiException 500" on Wishlist (and Recently viewed, the cart, checkout, part requests). Cause: a product with no weight and size (neither its
 * own nor its part's) cannot be priced, because its shipping fee cannot be worked out. Since all prices are in yuan (patch-prices-rmb-only), the
 * products that were in US dollars now go through that calculation too, and ONE such product made the whole page an error.
 * The search and product pages already leave such a product out; now these do the same:
 *  - Wishlist, Recently viewed: the product is left out (it comes back by itself once it has a weight and size). The server log names it.
 *  - Cart: the line is left out of the cart shown (it is still saved). Locking prices for checkout skips it.
 *  - Placing an order with it: a clear message ("cannot be ordered right now"), code product_unpriceable, instead of 500.
 *  - Part requests: a priced request whose product cannot be priced shows no price instead of failing.
 * The real fix for each such product: give its part a weight and size (admin), or the product its own (supplier). See check-api-500.js for the list.
 *
 *   node scripts/patch-unpriceable-products.js            dry run
 *   node scripts/patch-unpriceable-products.js --write    applies it (each changed file is saved as <file>.before-unpriceable-products first)
 * Then: restart the API (Ctrl+C, npm run dev). No migration.
 *
 * A file that is not as this patch expects is NOT changed (the whole patch stops). Windows (CRLF) line endings are handled. Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created":[],"anchored":[{"file":"services/api/src/modules/catalog/routes.js","what":"server: the \"leave out a product that cannot be priced\" rule, shared","done":"module.exports.buildBuyerList = buildBuyerList;","pairs":[["module.exports.buildProductMatchQuery = buildProductMatchQuery;","module.exports.buildProductMatchQuery = buildProductMatchQuery;\nmodule.exports.buildBuyerList = buildBuyerList;      // wishlist, recently viewed: leave out a product that cannot be priced"]]},{"file":"services/api/src/modules/wishlist/routes.js","what":"server: Wishlist no longer fails because of one product without weight and size","done":"buildBuyerList(rows","pairs":[["const { toBuyerProductDto, attachBuyerPrice, attachBuyerImages, attachSupplierSignals, attachDeliveryEstimate, attachPrimaryFitment } = require('../catalog/routes');\n","const { toBuyerProductDto, attachBuyerPrice, attachBuyerImages, attachSupplierSignals, attachDeliveryEstimate, attachPrimaryFitment, buildBuyerList } = require('../catalog/routes');\n"],["    const dtos = await Promise.all(rows.map(async (r) => {\n","    // a product that cannot be priced (no weight and size) is left out, as in the catalog, instead of making the whole list an error\n    const dtos = await buildBuyerList(rows, async (r) => {\n"],["      return dto;\n    }));\n    res.json(dtos);\n","      return dto;\n    });\n    res.json(dtos);\n"]]},{"file":"services/api/src/modules/recentlyViewed/routes.js","what":"server: Recently viewed no longer fails because of one product without weight and size","done":"buildBuyerList(rows","pairs":[["const { toBuyerProductDto, attachBuyerPrice, attachBuyerImages, attachSupplierSignals, attachDeliveryEstimate, attachPrimaryFitment } = require('../catalog/routes');\n","const { toBuyerProductDto, attachBuyerPrice, attachBuyerImages, attachSupplierSignals, attachDeliveryEstimate, attachPrimaryFitment, buildBuyerList } = require('../catalog/routes');\n"],["    const dtos = await Promise.all(rows.map(async (r) => {\n","    // a product that cannot be priced (no weight and size) is left out, as in the catalog, instead of making the whole list an error\n    const dtos = await buildBuyerList(rows, async (r) => {\n"],["      return dto;\n    }));\n    res.json(dtos);\n","      return dto;\n    });\n    res.json(dtos);\n"]]},{"file":"services/api/src/modules/cart/routes.js","what":"server: the cart no longer fails because of one product without weight and size","done":"MissingShippingDataError } = require","pairs":[["const { calculateBuyerPriceUsd } = require('../pricing/engine');\n","const { calculateBuyerPriceUsd, MissingShippingDataError } = require('../pricing/engine');\n"],["  const items = await Promise.all(rows.map(async (r) => {\n    const live = await computeLivePrice(r);\n","  const items = (await Promise.all(rows.map(async (r) => {\n    let live;\n    try {\n      live = await computeLivePrice(r);\n    } catch (err) {      // no weight and size: the line is left out of the cart shown (still saved), instead of the whole cart failing\n      if (err instanceof MissingShippingDataError) { console.error(`[cart] product ${r.product_id} is left out of the cart: ${err.message}`); return null; }\n      throw err;\n    }\n"],["      weightKg: effectiveWeightKg,\n    };\n  }));\n","      weightKg: effectiveWeightKg,\n    };\n  }))).filter(Boolean);\n"],["        const live = await computeLivePrice(r);\n        await db.query(","        const live = await computeLivePrice(r).catch((err) => { if (err instanceof MissingShippingDataError) return null; throw err; });\n        if (!live) return;      // cannot be priced: not locked (it is not shown in the cart either)\n        await db.query("]]},{"file":"services/api/src/modules/order/routes.js","what":"server: ordering a product without weight and size says so clearly (no 500)","done":"apiCode: 'product_unpriceable'","pairs":[["const { calculateBuyerPriceUsd } = require('../pricing/engine');\n","const { calculateBuyerPriceUsd: engineBuyerPriceUsd, MissingShippingDataError } = require('../pricing/engine');\n// a product with no weight and size cannot be priced: a clear 400 for the buyer instead of a 500\nasync function calculateBuyerPriceUsd(input) {\n  try {\n    return await engineBuyerPriceUsd(input);\n  } catch (err) {\n    if (err instanceof MissingShippingDataError) {\n      throw Object.assign(new Error('One of the parts cannot be ordered right now (its shipping size is not set yet). Remove it from the cart and try again.'), { status: 400, apiCode: 'product_unpriceable' });\n    }\n    throw err;\n  }\n}\n"]]},{"file":"services/api/src/modules/quote-requests/routes.js","what":"server: a part request whose product cannot be priced shows no price (no 500)","done":"missing_shipping_data') return { price: null }","pairs":[["      const priced = await attachBuyerPrice({}, rows[0]);\n","      const priced = await attachBuyerPrice({}, rows[0]).catch((err) => { if (err && err.code === 'missing_shipping_data') return { price: null }; throw err; });\n"]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-hub-portal-redesign`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: restart the API (Ctrl+C, npm run dev).');
