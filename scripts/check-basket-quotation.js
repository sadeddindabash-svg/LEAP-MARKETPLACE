#!/usr/bin/env node
/**
 * READ ONLY check: why a basket part from a quotation shows no "From quotation" header. Changes nothing.
 *   node scripts/check-basket-quotation.js
 * It checks the patched files, migration 141, and lists the newest basket lines with the quotation each one remembers.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const has = (file, text) => { const p = path.join(root, file); return fs.existsSync(p) && fs.readFileSync(p, 'utf8').includes(text); };
const line = (ok, what) => console.log(`${ok ? 'OK     ' : 'PROBLEM'}  ${what}`);

line(has('services/api/src/modules/cart/routes.js', 'async function quotationFor(req, productId)'), 'server basket keeps the quotation of a part (patch-basket-quotation-parts)');
line(has('apps/mobile/lib/features/quotations/quotations_screens.dart', 'await cart.setQuantity(id, qty, quotationId: quotationId)'), 'app: "Order these parts" sends the quotation');
line(has('apps/mobile/lib/features/cart/cart_screen.dart', 'class _QuotationGroup extends StatelessWidget'), 'app basket groups the quotation\'s parts');
line(has('apps/mobile/lib/models/cart_item.dart', "quotationId: (json['quotation']"), 'app reads the quotation of a basket line');

process.chdir(path.join(root, 'services/api'));
let db;
try { require(path.join(root, 'services/api/node_modules/dotenv')).config({ path: path.join(root, 'services/api/.env') }); db = require(path.join(root, 'services/api/db/pool')); }
catch (e) { console.log(`PROBLEM  could not open the database: ${e.message}`); process.exit(1); }
(async () => {
  try {
    const { rows: col } = await db.query("SELECT 1 FROM information_schema.columns WHERE table_name = 'cart_items' AND column_name = 'quotation_id'");
    line(col.length > 0, 'migration 141: basket lines can remember a quotation (npm run migrate)');
    if (col.length === 0) return;
    const { rows } = await db.query(
      `SELECT ci.product_id, ci.quantity, ci.quotation_id, to_char(ci.added_at, 'YYYY-MM-DD HH24:MI') AS added, p.name
       FROM cart_items ci JOIN carts c ON c.id = ci.cart_id JOIN products p ON p.id = ci.product_id
       WHERE c.buyer_id IS NOT NULL AND c.merged_into IS NULL ORDER BY ci.added_at DESC LIMIT 15`);
    console.log('\nNewest lines in signed-in baskets (quotation = the mark; "-" = none):');
    for (const r of rows) console.log(`  ${r.added}  ${String(r.quotation_id || '-').padEnd(16)} x${r.quantity}  ${r.name}`);
    const { rows: q } = await db.query("SELECT id, to_char(created_at, 'YYYY-MM-DD HH24:MI') AS made, (SELECT string_agg(product_id, ', ') FROM quotation_items WHERE quotation_id = quotations.id) AS parts FROM quotations ORDER BY created_at DESC LIMIT 3");
    console.log('\nNewest quotations and their parts:');
    for (const r of q) console.log(`  ${r.made}  ${r.id}  ${r.parts}`);
  } catch (e) { console.log(`PROBLEM  ${e.message}`); }
  finally { await db.getPool().end(); }
})();
