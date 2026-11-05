#!/usr/bin/env node
/**
 * READ-ONLY check: why do Wishlist and Saved searches answer "500"? It does exactly what those pages ask the server, step by step, and prints the
 * real error (nothing is changed in the database). Also lists any database update (migration) that has not been run.
 *
 *   node scripts\check-api-500.js                    (tests the buyer with the most wishlist items)
 *   node scripts\check-api-500.js you@example.com    (tests that buyer's own account)
 * Send the whole output.
 */
const path = require('path');
const fs = require('fs');
const api = path.join(__dirname, '..', 'services', 'api');
process.chdir(api);      // so the API's own .env (DATABASE_URL) is read
const show = (what, e) => {
  console.log(`FAILED   ${what}\n         ${e && e.message}${e && e.code ? `  (code ${e.code})` : ''}${e && e.detail ? `\n         ${e.detail}` : ''}`);
  if (e && e.stack) console.log(e.stack.split('\n').slice(1, 4).map((l) => `         ${l.trim()}`).join('\n'));
};

(async () => {
  let db;
  try { db = require(path.join(api, 'db', 'pool')); await db.query('SELECT 1'); console.log('ok       database connection'); }
  catch (e) { show('database connection (is PostgreSQL running? is DATABASE_URL in services\\api\\.env right?)', e); process.exit(1); }

  try {
    const files = fs.readdirSync(path.join(api, 'db', 'migrations')).filter((f) => f.endsWith('.sql')).sort();
    const { rows } = await db.query('SELECT filename FROM schema_migrations');
    const done = new Set(rows.map((r) => r.filename));
    const missing = files.filter((f) => !done.has(f));
    console.log(missing.length ? `NOT RUN  migrations: ${missing.join(', ')}` : `ok       all ${files.length} migrations have run (last: ${files[files.length - 1]})`);
  } catch (e) { show('reading the migrations', e); }

  let buyer = null;
  try {
    if (process.argv[2]) { const u = await db.query('SELECT id FROM users WHERE lower(email) = lower($1)', [process.argv[2]]); buyer = u.rows[0] && u.rows[0].id; if (!buyer) console.log(`NOT FOUND no account with the email ${process.argv[2]}`); }
    const w = buyer ? { rows: [{ buyer_id: buyer }] } : await db.query('SELECT buyer_id FROM wishlist_items GROUP BY buyer_id ORDER BY COUNT(*) DESC LIMIT 1');
    buyer = w.rows[0] && w.rows[0].buyer_id;
    if (!buyer) { const u = await db.query("SELECT id FROM users WHERE role = 'buyer' LIMIT 1"); buyer = u.rows[0] && u.rows[0].id; }
    console.log(`ok       testing with buyer ${buyer}`);
  } catch (e) { show('finding a buyer', e); }

  try {
    const c = require(path.join(api, 'src', 'modules', 'catalog', 'routes'));
    const { resolveDestinationIsoCode } = require(path.join(api, 'src', 'modules', 'deliveryEstimate', 'engine'));
    const { rows } = await db.query('SELECT p.* FROM wishlist_items w JOIN products p ON p.id = w.product_id WHERE w.buyer_id = $1 ORDER BY w.created_at DESC', [buyer]);
    const iso = await resolveDestinationIsoCode({ user: { sub: buyer }, query: {}, headers: {} });
    let failed = false;
    for (const r of rows) {
      let dto;
      try { dto = c.toBuyerProductDto(r, 'en'); } catch (e) { show(`wishlist: product ${r.id}, reading it`, e); failed = true; break; }
      for (const [step, run] of [['pictures', (d) => c.attachBuyerImages(d, r.id)], ['price', (d) => c.attachBuyerPrice(d, r)], ['seller', (d) => c.attachSupplierSignals(d, r.supplier_id)], ['delivery estimate', (d) => c.attachDeliveryEstimate(d, iso)], ['car fitment', (d) => c.attachPrimaryFitment(d, r.id, 'en')]]) {
        try { dto = await run(dto); } catch (e) { show(`wishlist: product ${r.id} (${r.currency_code} ${r.price}), ${step}`, e); failed = true; break; }
      }
      if (failed) break;
    }
    if (!failed) console.log(`ok       wishlist (${rows.length} items)`);
  } catch (e) { show('wishlist', e); }

  try {
    const { rows } = await db.query('SELECT * FROM saved_searches WHERE buyer_id = $1 ORDER BY created_at DESC', [buyer]);
    console.log(`ok       saved searches (${rows.length})`);
  } catch (e) { show('saved searches', e); }

  try { const { rows } = await db.query("SELECT currency_code, COUNT(*)::int AS n FROM products GROUP BY currency_code"); console.log(`ok       product currencies: ${rows.map((r) => `${r.currency_code} ${r.n}`).join(', ')}`); }
  catch (e) { show('product currencies', e); }

  // every product a buyer could see that cannot be priced: no weight and size of its own, and its part has none either
  try {
    const { calculateBuyerPriceUsd } = require(path.join(api, 'src', 'modules', 'pricing', 'engine'));
    const { withEffectiveShipping } = require(path.join(api, 'src', 'modules', 'shared', 'partShipping'));
    const { rows } = await db.query("SELECT p.*, s.name AS supplier_name FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.status = 'active' AND p.deleted_at IS NULL AND p.currency_code = 'CNY' ORDER BY p.category, p.part, p.id");
    const n = (v) => (v === null || v === undefined ? null : Number(v));
    const bad = [];
    for (const r of rows) {
      try { const sh = await withEffectiveShipping(r); await calculateBuyerPriceUsd({ supplierCostCny: Number(r.price), weightKg: n(sh.weight_kg), lengthCm: n(sh.length_cm), widthCm: n(sh.width_cm), heightCm: n(sh.height_cm) }); }
      catch (e) { if (e && e.code === 'missing_shipping_data') bad.push(r); else { show(`pricing product ${r.id}`, e); break; } }
    }
    if (bad.length === 0) console.log(`ok       all ${rows.length} products can be priced`);
    else {
      console.log(`NO SIZE  ${bad.length} of ${rows.length} products have no weight and size (neither their own nor their part's), so buyers cannot see or buy them:`);
      for (const r of bad.slice(0, 60)) console.log(`         ${r.id}  ${String(r.name || '').slice(0, 50)}  |  ${r.category || '-'} / ${r.part || '-'}  |  ${r.supplier_name || r.supplier_id || '-'}`);
      if (bad.length > 60) console.log(`         ... and ${bad.length - 60} more`);
      const parts = [...new Set(bad.map((r) => `${r.category || '-'} / ${r.part || '-'}`))];
      console.log(`         The quickest fix: set the weight and size of these ${parts.length} part(s) (admin), every product of the part then has one:`);
      for (const pt of parts.slice(0, 40)) console.log(`           - ${pt}`);
    }
  } catch (e) { show('checking which products can be priced', e); }

  process.exit(0);
})();
