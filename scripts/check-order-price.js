#!/usr/bin/env node
/**
 * Why an order shows no supplier price: lists each line of the order with what the supplier portal reads.
 *   node scripts/check-order-price.js LP-201353
 * Read only: it changes nothing.
 */
const path = require('path');
process.chdir(path.join(__dirname, '..', 'services', 'api'));
const db = require(path.join(process.cwd(), 'db', 'pool'));
const orderId = process.argv[2];
if (!orderId) { console.log('Usage: node scripts/check-order-price.js LP-201353'); process.exit(1); }
(async () => {
  const { rows } = await db.query(
    `SELECT so.id AS sub_order, s.name AS supplier, p.id AS product, p.name, oli.quantity,
            oli.supplier_unit_price_cny AS saved_rmb_price, p.currency_code AS product_currency, p.price AS product_price_now, o.placed_at, o.replacement_of
     FROM orders o JOIN supplier_sub_orders so ON so.order_id = o.id JOIN suppliers s ON s.id = so.supplier_id
     JOIN order_line_items oli ON oli.sub_order_id = so.id JOIN products p ON p.id = oli.product_id
     WHERE o.id = $1 ORDER BY so.id`, [orderId]);
  if (!rows.length) { console.log(`No order ${orderId} (or it has no lines).`); process.exit(0); }
  console.table(rows);
  for (const r of rows) {
    if (r.saved_rmb_price !== null) continue;
    const why = r.product_currency !== 'CNY'
      ? `the product is priced in ${r.product_currency}, not RMB, so no supplier RMB price was saved with the order`
      : (r.product_price_now === null ? 'the product had no price' : 'the order was placed before RMB prices were saved (migration 112), and the product was not in RMB then');
    console.log(`- ${r.name}: no price because ${why}.`);
  }
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
