// "Get a quotation" (migration 124): the prices come from the catalogue and never change, each seller's validity, the shares that always add up,
// what the public link shows (and hides), and the last confirmed share turning the quotation into an order at the quoted prices. Against the real
// database:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/quotations.test.js
// (it needs migration 124; it refuses to run on a database whose name does not end in "_test", and removes everything it creates)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/pool');
const service = require('../src/modules/quotations/service');

const BUYER = 'zz-qt-buyer', OTHER = 'zz-qt-other', S1 = 'zz-qt-s1', S2 = 'zz-qt-s2', PM = 'zz-qt-cash';
const q = (sql, params) => db.query(sql, params);
const NOW = new Date('2026-11-03T10:00:00Z');
const DAY = 24 * 3600e3;
let addressId, otherAddressId, savedFreeShipping;

async function wipe() {
  const ids = "(SELECT id FROM quotations WHERE buyer_id = 'zz-qt-buyer')";
  const orders = "(SELECT order_id FROM quotations WHERE buyer_id = 'zz-qt-buyer' AND order_id IS NOT NULL)";
  await q(`DELETE FROM order_line_items WHERE sub_order_id IN (SELECT id FROM supplier_sub_orders WHERE order_id IN ${orders})`);
  await q(`DELETE FROM supplier_sub_orders WHERE order_id IN ${orders}`);
  await q(`DELETE FROM order_addresses WHERE order_id IN ${orders}`);
  const { rows } = await q(`SELECT order_id FROM quotations WHERE buyer_id = 'zz-qt-buyer' AND order_id IS NOT NULL`);
  await q(`DELETE FROM quotation_shares WHERE quotation_id IN ${ids}`);
  await q(`DELETE FROM quotation_items WHERE quotation_id IN ${ids}`);
  await q("UPDATE quotations SET renewed_from = NULL WHERE buyer_id = 'zz-qt-buyer'");
  await q("DELETE FROM quotations WHERE buyer_id = 'zz-qt-buyer'");
  for (const r of rows) await q('DELETE FROM orders WHERE id = $1', [r.order_id]);
  await q("DELETE FROM products WHERE id LIKE 'zz-qt-%'");
  await q("DELETE FROM buyer_addresses WHERE buyer_id IN ('zz-qt-buyer', 'zz-qt-other')");
  await q("DELETE FROM suppliers WHERE id IN ('zz-qt-s1', 'zz-qt-s2')");
  await q("DELETE FROM users WHERE id IN ('zz-qt-buyer', 'zz-qt-other')");
  await q("DELETE FROM payment_methods WHERE id = 'zz-qt-cash'");
  await q("DELETE FROM fx_rates WHERE currency_pair = 'USD_ZZQ'").catch(() => {});
  await q("DELETE FROM vehicle_generations WHERE id = 'zz-qt-gen'");
  await q("DELETE FROM vehicle_models WHERE id = 'zz-qt-model'");
  await q("DELETE FROM vehicle_brands WHERE id = 'zz-qt-brand'");
}

before(async () => {
  await wipe();
  const { rows: fs } = await q("SELECT value FROM platform_settings WHERE key = 'free_shipping'");
  savedFreeShipping = fs[0] ? fs[0].value : null;
  await q("INSERT INTO platform_settings (key, value) VALUES ('free_shipping', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify({ enabled: true, thresholdUsd: 100, feeUsd: 9.9 })]);
  await q("INSERT INTO users (id, email, name, role) VALUES ($1, 'zz-qt-buyer@test.dev', 'Sara Buyer', 'buyer'), ($2, 'zz-qt-other@test.dev', 'Other', 'buyer')", [BUYER, OTHER]);
  await q("INSERT INTO suppliers (id, name) VALUES ($1, 'ZZ Real Name One'), ($2, 'ZZ Real Name Two')", [S1, S2]);
  await q("INSERT INTO vehicle_brands (id, name, name_ar) VALUES ('zz-qt-brand', 'Volkswagen', 'فولكس فاجن')");
  await q("INSERT INTO vehicle_models (id, brand_id, name, name_ar) VALUES ('zz-qt-model', 'zz-qt-brand', 'Golf', 'جولف')");
  await q("INSERT INTO vehicle_generations (id, model_id, name, year_start, year_end) VALUES ('zz-qt-gen', 'zz-qt-model', 'Mk8', 2019, NULL)");
  await q('UPDATE suppliers SET quote_validity_days = 3 WHERE id = $1', [S1]);
  const product = (id, supplier, price, stock, extra = '') => q(`INSERT INTO products (id, supplier_id, name, name_ar, oem_number, category, price, currency_code, stock_quantity, status) VALUES ($1, $2, $3, $4, $5, 'body', $6, 'USD', $7, 'active')${extra}`,
    [id, supplier, `Part ${id}`, `قطعة ${id}`, `OEM-${id}`, price, stock]);
  await product('zz-qt-bumper', S1, 40, 5);
  await product('zz-qt-light', S1, 25, 1);
  await product('zz-qt-support', S2, 10, 0);
  await product('zz-qt-gone', S2, 10, 3);
  // zz-qt-fit: every part fits the quotation's car (a part that does not is refused)
  await q("INSERT INTO product_fitment_entries (product_id, generation_id, year) SELECT id, 'zz-qt-gen', 2020 FROM products WHERE id LIKE 'zz-qt-%'");
  await q("UPDATE products SET status = 'inactive' WHERE id = 'zz-qt-gone'");
  await q("INSERT INTO payment_methods (id, name_en, name_ar, photo_url) VALUES ($1, 'Cash', 'نقدًا', '/x.png')", [PM]);
  await q("INSERT INTO fx_rates (currency_pair, rate) VALUES ('USD_ZZQ', 3.75)").catch(() => {});
  const addr = async (buyer, city) => (await q("INSERT INTO buyer_addresses (id, buyer_id, label, recipient_name, phone, country, city, street_address) VALUES ($1, $2, 'Home', 'Sara Buyer', '+49 1', 'Germany', $3, 'Hauptstr. 5') RETURNING id", [`zz-qt-a-${buyer}`, buyer, city])).rows[0].id;
  addressId = await addr(BUYER, 'Berlin');
  otherAddressId = await addr(OTHER, 'Munich');
});
after(async () => {
  await wipe();
  if (savedFreeShipping === null) await q("DELETE FROM platform_settings WHERE key = 'free_shipping'");
  else await q("UPDATE platform_settings SET value = $1 WHERE key = 'free_shipping'", [savedFreeShipping]);
  await db.getPool().end();
});

const VEHICLE = { generationId: 'zz-qt-gen', year: 2020, vin: 'wvwzzzauzlw003307' };     // a car of the catalogue (a typed car is refused)
const base = (over = {}) => ({
  items: [{ productId: 'zz-qt-bumper', quantity: 1 }, { productId: 'zz-qt-support', quantity: 2 }], vehicle: VEHICLE, partyType: 'insurance', partyName: 'Example Versicherung AG',
  policyNumber: '55-77821', reportNumber: 'POL-B-2026-118204', addressId, lang: 'en', displayCurrency: 'ZZQ', ...over,
});
async function create(over = {}, now = NOW) {
  const client = await db.getPool().connect();
  try { await client.query('BEGIN'); const id = await service.createQuotation(client, BUYER, base(over), now); await client.query('COMMIT'); return id; }
  catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}
async function confirm(code, shareId, payer, now = NOW) {
  const client = await db.getPool().connect();
  try { await client.query('BEGIN'); const r = await service.confirmShare(client, code, shareId, payer, now); await client.query('COMMIT'); return r; }
  catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}
const PAYER = { name: 'Claims desk', email: 'claims@example.test', paymentMethod: PM };

// ---------------------------------------------------------------- shares (pure)
test('shares: the named party pays it all by default; a split always adds up to the total exactly', () => {
  assert.deepEqual(service.splitShares(678.18, undefined), [{ payer: 'party', percent: 100, amountUsd: 678.18 }]);
  const s = service.splitShares(678.18, [{ payer: 'party', percent: 75 }, { payer: 'buyer', percent: 25 }]);
  assert.equal(s[0].amountUsd, 508.64); assert.equal(s[1].amountUsd, 169.54); assert.equal(service.round2(s[0].amountUsd + s[1].amountUsd), 678.18);
  const third = service.splitShares(100, [{ payer: 'party', percent: 33.33 }, { payer: 'buyer', percent: 66.67 }]);
  assert.equal(service.round2(third[0].amountUsd + third[1].amountUsd), 100);
  for (const bad of [[{ payer: 'party', percent: 90 }, { payer: 'buyer', percent: 5 }], [{ payer: 'party', percent: 50 }, { payer: 'party', percent: 50 }], [{ payer: 'party', percent: 0 }, { payer: 'buyer', percent: 100 }], [{ payer: 'insurer', percent: 100 }]]) {
    assert.throws(() => service.splitShares(100, bad), (e) => e.status === 400);
  }
});

// ---------------------------------------------------------------- creating one
test('CRITICAL: the prices come from the catalogue (a price sent by the client is ignored), with the small-order shipping fee, in one currency fixed at issue', async () => {
  const id = await create({ items: [{ productId: 'zz-qt-bumper', quantity: 1, unitPrice: 0.01 }, { productId: 'zz-qt-support', quantity: 2 }] });
  const full = await service.loadFull(db, 'id', id);
  const dto = service.toDto(full, { forBuyer: true, now: NOW });
  assert.match(dto.id, /^Q-2026-\d{6}$/); assert.match(dto.code, /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  assert.deepEqual(dto.items.map((i) => [i.productId, i.unitPriceUsd, i.quantity, i.totalUsd]), [['zz-qt-bumper', 40, 1, 40], ['zz-qt-support', 10, 2, 20]]);
  assert.equal(dto.subtotalUsd, 60); assert.equal(dto.shippingUsd, 9.9); assert.equal(dto.totalUsd, 69.9);         // under the 100 limit: the fee is added
  assert.deepEqual(dto.currency, { code: 'ZZQ', rate: 3.75 });
  assert.deepEqual(dto.vehicle, { make: 'Volkswagen', model: 'Golf', year: 2020, vin: 'WVWZZZAUZLW003307', plate: null, makeAr: 'فولكس فاجن', modelAr: 'جولف', generationId: 'zz-qt-gen', versionId: null, version: null, versionAr: null });
  assert.deepEqual(dto.party, { type: 'insurance', name: 'Example Versicherung AG', policyNumber: '55-77821', reportNumber: 'POL-B-2026-118204' });
  assert.deepEqual(dto.shares.map((s) => [s.payer, s.percent, s.amountUsd, s.confirmed]), [['party', 100, 69.9, false]]);
  assert.equal(dto.state, 'open');
  assert.deepEqual(dto.items.map((i) => i.inStock), [true, false]);                                                   // availability on the day: shown, not blocking
});

test('each seller\'s validity: its own date on each line, and the quotation expires on the earliest (7 days when a seller has none)', async () => {
  const id = await create();
  const dto = service.toDto(await service.loadFull(db, 'id', id), { now: NOW });
  assert.equal(dto.items[0].validUntil, new Date(NOW.getTime() + 3 * DAY).toISOString());                            // seller 1: 3 days
  assert.equal(dto.items[1].validUntil, new Date(NOW.getTime() + service.DEFAULT_VALIDITY_DAYS * DAY).toISOString()); // seller 2: not set
  assert.equal(dto.expiresAt, dto.items[0].validUntil);
  assert.equal(service.toDto(await service.loadFull(db, 'id', id), { now: new Date(NOW.getTime() + 4 * DAY) }).state, 'expired');
});

test('sellers are never named: the same anonymous labels as an order, two sellers numbered', async () => {
  const dto = service.toDto(await service.loadFull(db, 'id', await create()), { now: NOW });
  const labels = dto.items.map((i) => i.seller);
  assert.equal(new Set(labels).size, 2);
  for (const l of labels) assert.ok(!/Real Name/.test(String(l)), `no real name in ${l}`);
});

test('refused: a part no longer sold, no car, no party, nothing chosen, and someone else\'s address', async () => {
  const code = async (over) => { try { await create(over); return 'created'; } catch (e) { return e.apiCode; } };
  assert.equal(await code({ items: [{ productId: 'zz-qt-gone', quantity: 1 }] }), 'quote_unavailable');
  assert.equal(await code({ items: [{ productId: 'zz-qt-nope', quantity: 1 }] }), 'quote_unavailable');
  assert.equal(await code({ items: [] }), 'quote_items');
  assert.equal(await code({ items: [{ productId: 'zz-qt-bumper', quantity: 0 }] }), 'quote_items');
  assert.equal(await code({ vehicle: { make: 'VW' } }), 'quote_vehicle');
  assert.equal(await code({ partyType: 'bank' }), 'quote_party');
  assert.equal(await code({ partyName: '  ' }), 'quote_party');
  assert.equal(await code({ addressId: otherAddressId }), 'quote_address');
  assert.equal(await code({ shares: [{ payer: 'party', percent: 60 }] }), 'quote_share_total');
});

test('the public view shows the city and country only, never the street or a payer\'s email; the buyer\'s view has them', async () => {
  const id = await create({ shares: [{ payer: 'party', percent: 75 }, { payer: 'buyer', percent: 25 }] });
  const full = await service.loadFull(db, 'id', id);
  await confirm(full.quote.code, full.shares[1].id, { ...PAYER, name: 'Sara', email: 'sara@example.test' });
  const pub = service.toDto(await service.loadFull(db, 'id', id), { now: NOW });
  assert.deepEqual(pub.delivery, { city: 'Berlin', country: 'Germany' });
  assert.equal(JSON.stringify(pub).includes('sara@example.test'), false); assert.equal(JSON.stringify(pub).includes('Hauptstr'), false); assert.equal(pub.orderId, null);
  const mine = service.toDto(await service.loadFull(db, 'id', id), { forBuyer: true, now: NOW });
  assert.equal(mine.delivery.streetAddress, 'Hauptstr. 5'); assert.equal(mine.shares[1].payerEmail, 'sara@example.test');
  assert.equal(service.toDto(full, { lang: 'ar', now: NOW }).items[0].name, 'قطعة zz-qt-bumper');
});

// ---------------------------------------------------------------- shares -> order
test('CRITICAL: the last confirmed share places the order at the QUOTED prices, delivered to the quotation\'s address, stock taken; nothing can be confirmed twice', async () => {
  const id = await create({ items: [{ productId: 'zz-qt-bumper', quantity: 2 }], shares: [{ payer: 'party', percent: 75 }, { payer: 'buyer', percent: 25 }] });
  const full = await service.loadFull(db, 'id', id);
  await q("UPDATE products SET price = 99 WHERE id = 'zz-qt-bumper'");                                                 // the catalogue price changes afterwards
  try {
    const first = await confirm(full.quote.code, full.shares[0].id, PAYER);
    assert.equal(first.orderId, null);
    await assert.rejects(confirm(full.quote.code, full.shares[0].id, PAYER), (e) => e.apiCode === 'quote_share_done');
    const second = await confirm(service.showCode(full.quote.code).toLowerCase(), full.shares[1].id, { ...PAYER, name: 'Sara', email: 'sara@example.test' });
    assert.match(second.orderId, /^LP-\d+$/);
    const { rows: [order] } = await q('SELECT * FROM orders WHERE id = $1', [second.orderId]);
    assert.equal(order.buyer_id, BUYER); assert.equal(order.status, 'to_ship'); assert.equal(Number(order.total), 89.9); assert.equal(Number(order.shipping_fee), 9.9); assert.equal(order.currency_code, 'USD');
    const { rows: lines } = await q('SELECT oli.product_id, oli.quantity, oli.unit_price FROM order_line_items oli JOIN supplier_sub_orders so ON so.id = oli.sub_order_id WHERE so.order_id = $1', [second.orderId]);
    assert.deepEqual(lines.map((l) => [l.product_id, Number(l.quantity), Number(l.unit_price)]), [['zz-qt-bumper', 2, 40]]);
    const { rows: [address] } = await q('SELECT city, street_address FROM order_addresses WHERE order_id = $1', [second.orderId]);
    assert.deepEqual([address.city, address.street_address], ['Berlin', 'Hauptstr. 5']);
    assert.equal(Number((await q("SELECT stock_quantity FROM products WHERE id = 'zz-qt-bumper'")).rows[0].stock_quantity), 3);
    const after = service.toDto(await service.loadFull(db, 'id', id), { forBuyer: true, now: NOW });
    assert.equal(after.state, 'ordered'); assert.equal(after.orderId, second.orderId);
    await assert.rejects(confirm(full.quote.code, full.shares[0].id, PAYER), (e) => e.apiCode === 'quote_closed');
  } finally {
    await q("UPDATE products SET price = 40, stock_quantity = 5 WHERE id = 'zz-qt-bumper'");
  }
});

test('confirming is refused when the quotation expired, without a name, email or a real payment method, and when the stock ran out (nothing is half done)', async () => {
  const id = await create({ items: [{ productId: 'zz-qt-light', quantity: 1 }] });
  const { quote, shares } = await service.loadFull(db, 'id', id);
  const why = async (payer, now = NOW) => { try { await confirm(quote.code, shares[0].id, payer, now); return 'ok'; } catch (e) { return e.apiCode; } };
  assert.equal(await why(PAYER, new Date(NOW.getTime() + 8 * DAY)), 'quote_expired');
  assert.equal(await why({ ...PAYER, name: '' }), 'quote_payer_name');
  assert.equal(await why({ ...PAYER, email: 'nope' }), 'quote_payer_email');
  assert.equal(await why({ ...PAYER, paymentMethod: 'made-up' }), 'quote_payment_method');
  await q("UPDATE products SET stock_quantity = 0 WHERE id = 'zz-qt-light'");
  assert.equal(await why(PAYER), 'quote_out_of_stock');
  const still = await service.loadFull(db, 'id', id);
  assert.equal(still.quote.status, 'open'); assert.equal(still.shares[0].confirmed_at, null);                         // the share was not kept either
  await q("UPDATE products SET stock_quantity = 1 WHERE id = 'zz-qt-light'");
  try { await confirm('ZZZZ-ZZZZ', shares[0].id, PAYER); assert.fail('should refuse'); } catch (e) { assert.equal(e.apiCode, 'quote_not_found'); }
});
