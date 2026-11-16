#!/usr/bin/env node
/**
 * Product names for buyers, in this order (confirmed with the person via mockup):
 *   the name that was added + the car's brand + the model     e.g. "Front Brake Disc Toyota Camry" / «قرص فرامل أمامي تويوتا كامري»
 * Built once in the API, so the website (PC, tablet, phone) and the mobile app all show the same:
 * product cards, the product page, search, alternatives, wishlist, recently viewed, the basket, orders and the receipt.
 * A brand or model already in the added name is not added again. Admin and the supplier hub keep the plain name.
 *
 *   node scripts/patch-product-name-car.js            dry run
 *   node scripts/patch-product-name-car.js --write    applies it (each changed file is saved as <file>.before-patch-product-name-car first)
 * Then: restart the API, website Ctrl+F5, app R (hot restart). No migration.
 */
const DATA = {"created": [{"file": "services/api/src/modules/shared/carName.js", "what": "API, new: builds the buyer name (name + car brand + model)", "text": "// Buyer-facing product name: the name that was added, then the car's brand, then its model\n// (\"Front Brake Disc\" + Toyota + Camry -> \"Front Brake Disc Toyota Camry\"; Arabic: name_ar + brand's name_ar + model's name_ar).\n// Confirmed with the person via mockup. The car is the product's first fitment, the same one attachPrimaryFitment shows.\n// A brand or model the added name already has in it is not added again. Admin and the supplier hub keep the plain name.\n\n// LEFT JOIN for any query on `products p`: adds fit_brand, fit_brand_ar, fit_model, fit_model_ar (null when there is no fitment).\nconst CAR_JOIN = `LEFT JOIN LATERAL (\n       SELECT vb.name AS fit_brand, vb.name_ar AS fit_brand_ar, vm.name AS fit_model, vm.name_ar AS fit_model_ar\n       FROM product_fitment_entries pfe\n       JOIN vehicle_generations vg ON vg.id = pfe.generation_id\n       JOIN vehicle_models vm ON vm.id = vg.model_id\n       JOIN vehicle_brands vb ON vb.id = vm.brand_id\n       WHERE pfe.product_id = p.id\n       ORDER BY pfe.id ASC LIMIT 1\n     ) fit ON true`;\n\nconst CAR_COLUMNS = 'fit.fit_brand, fit.fit_brand_ar, fit.fit_model, fit.fit_model_ar';\n\nfunction clean(text) {\n  return typeof text === 'string' ? text.replace(/\\s+/g, ' ').trim() : '';\n}\n\n// name + brand + model, skipping whatever is empty or already in the name (letter case ignored).\nfunction withCar(name, brand, model) {\n  let out = clean(name);\n  for (const word of [clean(brand), clean(model)]) {\n    if (!word) continue;\n    if (out.toLowerCase().includes(word.toLowerCase())) continue;\n    out = out ? `${out} ${word}` : word;\n  }\n  return out;\n}\n\n// A row with name, name_ar and the CAR_COLUMNS -> the full name in the buyer's language.\nfunction buyerName(row, lang) {\n  if (!row) return '';\n  const ar = lang === 'ar';\n  const name = ar && row.name_ar ? row.name_ar : row.name;\n  const brand = ar && row.fit_brand_ar ? row.fit_brand_ar : row.fit_brand;\n  const model = ar && row.fit_model_ar ? row.fit_model_ar : row.fit_model;\n  return withCar(name, brand, model);\n}\n\nmodule.exports = { CAR_JOIN, CAR_COLUMNS, withCar, buyerName };\n"}], "replaced": [], "anchored": [{"file": "services/api/src/modules/catalog/routes.js", "what": "API, products for buyers (lists, product page, alternatives, same brand/model, wishlist, recently viewed): name + brand + model", "done": "name: withCar(dto.name, brandName, modelName)", "pairs": [["const CJK_REGEX = /[\\u4e00-\\u9fff]/;", "const { withCar } = require('../shared/carName');      // buyer names: name + car brand + model\nconst CJK_REGEX = /[\\u4e00-\\u9fff]/;", false], ["  return { ...dto, brand: brandName, brandLogoUrl: primary?.brand_logo_url || null, model: modelName, year: primary?.year || null };", "  // the buyer's name: the name that was added + the car's brand + model (confirmed with the person via mockup)\n  return { ...dto, name: withCar(dto.name, brandName, modelName), brand: brandName, brandLogoUrl: primary?.brand_logo_url || null, model: modelName, year: primary?.year || null };", false]]}, {"file": "services/api/src/modules/cart/routes.js", "what": "API, basket: each part named name + brand + model, also in the \"only N left\" message", "done": "buyerName(r, lang)", "pairs": [["const { buildSupplierLabelMap } = require('../shared/supplierAnonymize');\n", "const { buildSupplierLabelMap } = require('../shared/supplierAnonymize');\nconst { CAR_JOIN, CAR_COLUMNS, buyerName, withCar } = require('../shared/carName');      // buyer names: name + car brand + model\n", false], ["p.stock_quantity, p.supplier_id\n     FROM cart_items ci\n     JOIN products p ON p.id = ci.product_id\n", "p.stock_quantity, p.supplier_id, ${CAR_COLUMNS}\n     FROM cart_items ci\n     JOIN products p ON p.id = ci.product_id\n     ${CAR_JOIN}\n", false], ["      name: lang === 'ar' && r.name_ar ? r.name_ar : r.name,\n      price,", "      name: buyerName(r, lang),\n      price,", false], ["  const { rows } = await db.query('SELECT stock_quantity, name, name_ar FROM products WHERE id = $1', [productId]);", "  const { rows } = await db.query(`SELECT p.stock_quantity, p.name, p.name_ar, ${CAR_COLUMNS} FROM products p ${CAR_JOIN} WHERE p.id = $1`, [productId]);", false], ["    const productName = lang === 'ar' && rows[0].name_ar ? rows[0].name_ar : rows[0].name;", "    const productName = buyerName(rows[0], lang);", false]]}, {"file": "services/api/src/modules/cart/accountCart.js", "what": "API, joining a guest basket into the account: names in the message as name + brand + model", "done": "buyerName(item, lang)", "pairs": [["const { optionalAuth } = require('../auth/middleware');\n", "const { optionalAuth } = require('../auth/middleware');\nconst { CAR_JOIN, CAR_COLUMNS, buyerName, withCar } = require('../shared/carName');      // buyer names: name + car brand + model\n", false], ["    `SELECT ci.product_id, ci.quantity, ci.locked_price, p.name, p.name_ar, p.stock_quantity FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.cart_id = $1 ORDER BY ci.product_id`, [source.id]);", "    `SELECT ci.product_id, ci.quantity, ci.locked_price, p.name, p.name_ar, p.stock_quantity, ${CAR_COLUMNS} FROM cart_items ci JOIN products p ON p.id = ci.product_id ${CAR_JOIN} WHERE ci.cart_id = $1 ORDER BY ci.product_id`, [source.id]);", false], ["    const name = lang === 'ar' && item.name_ar ? item.name_ar : item.name;\n    const had", "    const name = buyerName(item, lang);\n    const had", false]]}, {"file": "services/api/src/modules/order/routes.js", "what": "API, orders: the buyer's order page, receipt and \"only N left\" message name each part name + brand + model (admin keeps the plain name)", "done": "buyerName(i, req.query.lang)", "pairs": [["const { withEffectiveShipping } = require('../shared/partShipping');\n", "const { withEffectiveShipping } = require('../shared/partShipping');\nconst { CAR_JOIN, CAR_COLUMNS, buyerName, withCar } = require('../shared/carName');      // buyer names: name + car brand + model\n", false], ["        const { rows: currentRows } = await client.query('SELECT stock_quantity, name, name_ar FROM products WHERE id = $1', [item.productId]);", "        const { rows: currentRows } = await client.query(`SELECT p.stock_quantity, p.name, p.name_ar, ${CAR_COLUMNS} FROM products p ${CAR_JOIN} WHERE p.id = $1`, [item.productId]);", false], ["        const productName = req.query.lang === 'ar' && currentRows[0]?.name_ar ? currentRows[0].name_ar : (currentRows[0]?.name || item.productId);", "        const productName = currentRows[0] ? buyerName(currentRows[0], req.query.lang) : item.productId;", false], ["        `SELECT oli.product_id, oli.quantity, oli.unit_price, p.name, p.name_ar\n         FROM order_line_items oli JOIN products p ON p.id = oli.product_id\n         WHERE oli.sub_order_id = $1`,", "        `SELECT oli.product_id, oli.quantity, oli.unit_price, p.name, p.name_ar, ${CAR_COLUMNS}\n         FROM order_line_items oli JOIN products p ON p.id = oli.product_id\n         ${CAR_JOIN}\n         WHERE oli.sub_order_id = $1`,", false], ["        return { productId: i.product_id, name: (req.query.lang === 'ar' && i.name_ar) ? i.name_ar : i.name, quantity: i.quantity,", "        return { productId: i.product_id, name: isAdmin ? i.name : buyerName(i, req.query.lang), quantity: i.quantity,", false], ["      `SELECT oli.quantity, oli.unit_price, p.name, p.name_ar\n       FROM order_line_items oli\n       JOIN supplier_sub_orders so ON so.id = oli.sub_order_id\n       JOIN products p ON p.id = oli.product_id\n", "      `SELECT oli.quantity, oli.unit_price, p.name, p.name_ar, ${CAR_COLUMNS}\n       FROM order_line_items oli\n       JOIN supplier_sub_orders so ON so.id = oli.sub_order_id\n       JOIN products p ON p.id = oli.product_id\n       ${CAR_JOIN}\n", false], ["      name: (isAr && i.name_ar) ? i.name_ar : i.name, quantity: Number(i.quantity), unitUsd: Number(i.unit_price),", "      name: buyerName(i, isAr ? 'ar' : 'en'), quantity: Number(i.quantity), unitUsd: Number(i.unit_price),", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-product-name-car`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: restart the API (in its window: Ctrl+C, then npm run dev), then the website: Ctrl+F5, the app: R (hot restart)');
