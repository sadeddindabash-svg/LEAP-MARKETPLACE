/**
 * "Get a quotation": the rules, kept apart from the routes so they can be tested on their own.
 *
 *  - The PRICES are the ones the buyer sees in the cart at that moment (the same live price as the cart: pricing engine + discount rules), plus
 *    the shipping fee of a small order. They are stored and never change; nobody can type a price.
 *  - Each SELLER sets how long its prices hold (suppliers.quote_validity_days, DEFAULT_VALIDITY_DAYS when not set); each line shows its own date
 *    and the whole quotation expires on the earliest one.
 *  - SHARES: who pays what. By default the named party pays it all; the buyer can split it with them (an accident share: 75 / 25). The amounts
 *    always add up to the total (the last share takes the rounding cent).
 *  - Anyone with the link can confirm a share (name, email, a payment method for their country: no money is collected online, exactly as at
 *    checkout). When every share is confirmed the quotation becomes a normal ORDER at the quoted prices, delivered to the address on it.
 *  - Sellers are never named to buyers or parties: the same anonymous labels as an order (shared/supplierAnonymize.js).
 */
const crypto = require('crypto');
const { calculateBuyerPriceUsd } = require('../pricing/engine');
const { withEffectiveShipping } = require('../shared/partShipping');
const { findMatchingDiscountRule } = require('../pricing/discountRules');
const { readFreeShipping, computeShipping } = require('../shared/freeShipping');
const { supplierUnitPriceCny } = require('../shared/supplierMoney');
const { buildSupplierLabelMap } = require('../shared/supplierAnonymize');

const DEFAULT_VALIDITY_DAYS = 7;
const MAX_ITEMS = 50;
const PARTY_TYPES = ['insurance', 'repair_shop', 'other_party', 'employer', 'other'];
const CODE_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O, 1/I/L: read aloud or typed from paper
const DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const round2 = (n) => Math.round(Number((Number(n) * 100).toFixed(6))) / 100;      // half a cent rounds up (508.635 -> 508.64), whatever the float error
const clean = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function fail(status, message, code) {
  return Object.assign(new Error(message), { status, apiCode: code });
}

/** The live price of one product, exactly as the cart computes it (cart/routes.js computeLivePrice). */
async function livePriceUsd(p, q) {
  const discount = await findMatchingDiscountRule(p.id);
  let base;
  if (p.currency_code !== 'CNY') base = Number(p.price);
  else {
    const shipped = await withEffectiveShipping(p, q);
    const n = (v) => (v === null || v === undefined ? null : Number(v));
    const result = await calculateBuyerPriceUsd({
      supplierCostCny: Number(p.price), weightKg: n(shipped.weight_kg), lengthCm: n(shipped.length_cm), widthCm: n(shipped.width_cm), heightCm: n(shipped.height_cm),
    });
    base = result.buyerPriceUsd;
  }
  return round2(discount !== null && discount !== undefined ? base * (1 - discount / 100) : base);
}

/** A short code for the link and the PDF: 8 characters, shown as XXXX-XXXX. */
function newCode() {
  const bytes = crypto.randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += CODE_CHARSET[bytes[i] % CODE_CHARSET.length];
  return s;
}
const showCode = (code) => `${code.slice(0, 4)}-${code.slice(4)}`;
const readCode = (raw) => String(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '');

/** Who pays what: [{ payer, percent, amountUsd }], the amounts adding up to the total exactly. */
function splitShares(totalUsd, shares) {
  const list = Array.isArray(shares) && shares.length > 0 ? shares : [{ payer: 'party', percent: 100 }];
  const seen = new Set();
  for (const s of list) {
    if (!['party', 'buyer'].includes(s && s.payer)) throw fail(400, 'Each share is paid by the party or by you.', 'quote_share_payer');
    if (seen.has(s.payer)) throw fail(400, 'Each payer can have one share only.', 'quote_share_payer');
    seen.add(s.payer);
    const pct = Number(s.percent);
    if (!(pct > 0 && pct <= 100)) throw fail(400, 'A share must be more than 0% and at most 100%.', 'quote_share_percent');
  }
  const sum = round2(list.reduce((a, s) => a + Number(s.percent), 0));
  if (sum !== 100) throw fail(400, 'The shares must add up to 100%.', 'quote_share_total');
  let left = round2(totalUsd);
  return list.map((s, i) => {
    const amountUsd = i === list.length - 1 ? left : round2((totalUsd * Number(s.percent)) / 100);
    left = round2(left - amountUsd);
    return { payer: s.payer, percent: round2(Number(s.percent)), amountUsd };
  });
}

/** units of `code` per 1 US dollar (fx_rates USD_xxx), 1 for US dollars or an unknown currency. */
async function displayRate(q, code) {
  if (!/^[A-Z]{3}$/.test(code) || code === 'USD') return { code: 'USD', rate: 1 };
  const { rows } = await q.query('SELECT rate FROM fx_rates WHERE currency_pair = $1', [`USD_${code}`]);
  return rows.length > 0 && Number(rows[0].rate) > 0 ? { code, rate: Number(rows[0].rate) } : { code: 'USD', rate: 1 };
}

/** The delivery address: one of the buyer's saved addresses, copied (later edits to the saved one never change the quotation). */
async function addressFor(q, buyerId, addressId) {
  if (!addressId) throw fail(400, 'Choose the delivery address.', 'quote_address');
  const { rows } = await q.query('SELECT * FROM buyer_addresses WHERE id = $1 AND buyer_id = $2', [addressId, buyerId]);
  if (rows.length === 0) throw fail(400, 'That saved address was not found on your account.', 'quote_address');
  const a = rows[0];
  return { recipientName: a.recipient_name, phone: a.phone, country: a.country, state: a.state || null, city: a.city, streetAddress: a.street_address, postalCode: a.postal_code || null, nationalAddress: a.national_address || null };
}

function readVehicle(v) {
  const vehicle = { make: clean(v && v.make, 60), model: clean(v && v.model, 80), year: Number(v && v.year) || null, vin: clean(v && v.vin, 17).toUpperCase() || null, plate: clean(v && v.plate, 20) || null };
  if (!vehicle.make || !vehicle.model || !vehicle.year || vehicle.year < 1950 || vehicle.year > new Date().getFullYear() + 2) throw fail(400, 'Choose the car (make, model and year).', 'quote_vehicle');
  return vehicle;
}

/**
 * Creates a quotation. input: { items: [{ productId, quantity }], vehicle, partyType, partyName, policyNumber?, reportNumber?, shares?,
 * addressId, lang?, displayCurrency? }. Runs on a client inside a transaction (the caller begins and commits). Returns the new id.
 */
async function createQuotation(q, buyerId, input, now = new Date()) {
  const raw = Array.isArray(input.items) ? input.items : [];
  const qty = new Map();
  for (const it of raw) {
    const n = Math.floor(Number(it && it.quantity));
    if (!it || typeof it.productId !== 'string' || !(n > 0)) throw fail(400, 'Each part needs a quantity of at least 1.', 'quote_items');
    qty.set(it.productId, (qty.get(it.productId) || 0) + n);
  }
  if (qty.size === 0) throw fail(400, 'Choose at least one part.', 'quote_items');
  if (qty.size > MAX_ITEMS) throw fail(400, `A quotation can hold up to ${MAX_ITEMS} parts.`, 'quote_items');
  const partyType = PARTY_TYPES.includes(input.partyType) ? input.partyType : null;
  if (!partyType) throw fail(400, 'Choose who the quotation is for.', 'quote_party');
  const partyName = clean(input.partyName, 120);
  if (!partyName) throw fail(400, 'Enter the name of who it is for.', 'quote_party');
  const vehicle = readVehicle(input.vehicle);
  const address = input.addressCopy || (await addressFor(q, buyerId, input.addressId));      // a renewal keeps the address of the quotation it renews

  const ids = [...qty.keys()];
  const { rows: products } = await q.query(
    `SELECT p.id, p.name, p.name_ar, p.oem_number, p.price, p.currency_code, p.category, p.part, p.weight_kg, p.length_cm, p.width_cm, p.height_cm,
            p.stock_quantity, p.status, p.deleted_at, p.supplier_id, s.quote_validity_days
     FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = ANY($1::text[])`,
    [ids]
  );
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = [];
  for (const id of ids) {
    const p = byId.get(id);
    if (!p || p.deleted_at || p.status !== 'active') throw fail(400, 'One of the parts is no longer sold. Remove it from your selection and try again.', 'quote_unavailable');
    const days = Number(p.quote_validity_days) > 0 ? Number(p.quote_validity_days) : DEFAULT_VALIDITY_DAYS;
    lines.push({
      productId: id, supplierId: p.supplier_id, name: p.name, nameAr: p.name_ar || null, oemNumber: p.oem_number || null, quantity: qty.get(id),
      unitUsd: await livePriceUsd(p, q), inStock: Number(p.stock_quantity) >= qty.get(id), validUntil: new Date(now.getTime() + days * DAY_MS),
    });
  }
  const subtotal = round2(lines.reduce((a, l) => a + l.unitUsd * l.quantity, 0));
  const shipping = round2(computeShipping({ settings: await readFreeShipping(q), itemsUsd: subtotal }).chargedUsd);
  const total = round2(subtotal + shipping);
  const shares = splitShares(total, input.shares);
  const expiresAt = new Date(Math.min(...lines.map((l) => l.validUntil.getTime())));
  const currency = await displayRate(q, clean(input.displayCurrency, 3).toUpperCase());

  const { rows: seq } = await q.query("SELECT nextval('quotation_number_seq') AS n");
  const id = `Q-${now.getUTCFullYear()}-${String(seq[0].n).padStart(6, '0')}`;
  let code = newCode();
  for (let i = 0; i < 5; i++) {
    const { rows } = await q.query('SELECT 1 FROM quotations WHERE code = $1', [code]);
    if (rows.length === 0) break;
    code = newCode();
  }
  await q.query(
    `INSERT INTO quotations (id, code, buyer_id, party_type, party_name, policy_number, report_number, vehicle, address, lang, display_currency, display_rate,
                             subtotal_usd, shipping_usd, total_usd, expires_at, renewed_from, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
    [id, code, buyerId, partyType, partyName, clean(input.policyNumber, 60) || null, clean(input.reportNumber, 60) || null, JSON.stringify(vehicle), JSON.stringify(address),
      input.lang === 'ar' ? 'ar' : 'en', currency.code, currency.rate, subtotal, shipping, total, expiresAt, input.renewedFrom || null, now]
  );
  for (const l of lines) {
    await q.query(
      `INSERT INTO quotation_items (quotation_id, product_id, supplier_id, name, name_ar, oem_number, quantity, unit_price_usd, in_stock, valid_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, l.productId, l.supplierId, l.name, l.nameAr, l.oemNumber, l.quantity, l.unitUsd, l.inStock, l.validUntil]
    );
  }
  for (const s of shares) {
    await q.query('INSERT INTO quotation_shares (quotation_id, payer, percent, amount_usd) VALUES ($1, $2, $3, $4)', [id, s.payer, s.percent, s.amountUsd]);
  }
  return id;
}

/** The state shown everywhere: open (still valid), expired, ordered or cancelled. */
function stateOf(row, now = new Date()) {
  if (row.status === 'ordered' || row.status === 'cancelled') return row.status;
  return new Date(row.expires_at).getTime() < now.getTime() ? 'expired' : 'open';
}

async function loadFull(q, where, param) {
  const { rows } = await q.query(`SELECT * FROM quotations WHERE ${where} = $1`, [param]);
  if (rows.length === 0) return null;
  const quote = rows[0];
  const { rows: items } = await q.query('SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY id', [quote.id]);
  const { rows: shares } = await q.query('SELECT * FROM quotation_shares WHERE quotation_id = $1 ORDER BY id', [quote.id]);
  return { quote, items, shares };
}

const asJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

/**
 * What the buyer, the party and the PDF see. `forBuyer` adds the full delivery address and each payer's details; the public view shows the
 * city and country only, and never a payer's email or phone.
 */
function toDto(full, { lang = 'en', forBuyer = false, now = new Date() } = {}) {
  const { quote, items, shares } = full;
  const labels = buildSupplierLabelMap([...new Set(items.map((i) => i.supplier_id).filter(Boolean))], quote.id);
  const address = asJson(quote.address) || {};
  return {
    id: quote.id,
    code: showCode(quote.code),
    state: stateOf(quote, now),
    createdAt: new Date(quote.created_at).toISOString(),
    expiresAt: new Date(quote.expires_at).toISOString(),
    party: { type: quote.party_type, name: quote.party_name, policyNumber: quote.policy_number, reportNumber: quote.report_number },
    vehicle: asJson(quote.vehicle),
    delivery: forBuyer ? address : { city: address.city || null, country: address.country || null },
    currency: { code: quote.display_currency, rate: Number(quote.display_rate) },
    items: items.map((i) => ({
      productId: i.product_id,
      name: lang === 'ar' && i.name_ar ? i.name_ar : i.name,
      oemNumber: i.oem_number,
      seller: labels.get(i.supplier_id) || null,
      quantity: i.quantity,
      unitPriceUsd: Number(i.unit_price_usd),
      totalUsd: round2(Number(i.unit_price_usd) * i.quantity),
      inStock: i.in_stock === true || i.in_stock === 't' || i.in_stock === 'true',
      validUntil: new Date(i.valid_until).toISOString(),
    })),
    subtotalUsd: Number(quote.subtotal_usd),
    shippingUsd: Number(quote.shipping_usd),
    totalUsd: Number(quote.total_usd),
    shares: shares.map((s) => ({
      id: Number(s.id), payer: s.payer, percent: Number(s.percent), amountUsd: Number(s.amount_usd), confirmed: Boolean(s.confirmed_at),
      ...(forBuyer ? { payerName: s.payer_name, payerEmail: s.payer_email, paymentMethod: s.payment_method, confirmedAt: s.confirmed_at ? new Date(s.confirmed_at).toISOString() : null } : {}),
    })),
    orderId: quote.order_id || null,                       // the order number is no secret: only the buyer can open the order itself
    ...(forBuyer ? { openCount: Number(quote.open_count) } : {}),
  };
}

let orderDisplayColumns = null; // whether orders has display_currency / display_rate (migration 123)
async function hasOrderDisplayColumns(q) {
  if (orderDisplayColumns === null) {
    const { rows } = await q.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND column_name IN ('display_currency', 'display_rate')");
    orderDisplayColumns = rows.length === 2;
  }
  return orderDisplayColumns;
}

/** Turns a fully confirmed quotation into an order, on the caller's transaction. Stock is taken now; not enough stock refuses it all. */
async function createOrderFromQuotation(q, full) {
  const { quote, items } = full;
  for (const it of items) {
    const { rows } = await q.query('UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND stock_quantity >= $1 RETURNING id', [it.quantity, it.product_id]);
    if (rows.length === 0) throw fail(409, `${it.name} is out of stock now, so the order cannot be placed. Ask for a new quotation.`, 'quote_out_of_stock');
  }
  const { rows: n } = await q.query("SELECT nextval('order_id_seq') AS n");
  const orderId = `LP-${200000 + Number(n[0].n)}`;
  const cols = ['id', 'buyer_id', 'status', 'total', 'currency_code', 'discount_amount', 'wait_for_all_shipments', 'shipping_fee'];
  const vals = [orderId, quote.buyer_id, 'to_ship', Number(quote.total_usd), 'USD', 0, false, Number(quote.shipping_usd)];
  if (await hasOrderDisplayColumns(q) && quote.display_currency !== 'USD') { cols.push('display_currency', 'display_rate'); vals.push(quote.display_currency, Number(quote.display_rate)); }
  await q.query(`INSERT INTO orders (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})`, vals);
  const a = asJson(quote.address);
  await q.query(
    `INSERT INTO order_addresses (order_id, recipient_name, phone, country, city, street_address, postal_code, state, national_address, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'saved_address')`,
    [orderId, a.recipientName, a.phone, a.country, a.city, a.streetAddress, a.postalCode || null, a.state || null, a.nationalAddress || null]
  );
  const { rows: products } = await q.query('SELECT id, price, currency_code, supplier_id FROM products WHERE id = ANY($1::text[])', [items.map((i) => i.product_id)]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const bySupplier = new Map();
  for (const it of items) {
    const sid = productById.get(it.product_id).supplier_id;
    if (!bySupplier.has(sid)) bySupplier.set(sid, []);
    bySupplier.get(sid).push(it);
  }
  for (const [supplierId, list] of bySupplier) {
    const { rows: sub } = await q.query("INSERT INTO supplier_sub_orders (order_id, supplier_id, status) VALUES ($1, $2, 'pending') RETURNING id", [orderId, supplierId]);
    for (const it of list) {
      await q.query(
        'INSERT INTO order_line_items (sub_order_id, product_id, quantity, unit_price, supplier_unit_price_cny) VALUES ($1, $2, $3, $4, $5)',
        [sub[0].id, it.product_id, it.quantity, Number(it.unit_price_usd), supplierUnitPriceCny(productById.get(it.product_id))]
      );
    }
  }
  await q.query("UPDATE quotations SET status = 'ordered', order_id = $1 WHERE id = $2", [orderId, quote.id]);
  return orderId;
}

/**
 * Confirms one share (whoever has the link: no money is collected online, as at checkout). payer: { name, email, phone?, paymentMethod }.
 * When it was the last unconfirmed share, the order is created. Runs on a client inside a transaction. Returns { orderId | null }.
 */
async function confirmShare(q, rawCode, shareId, payer, now = new Date()) {
  const { rows } = await q.query('SELECT * FROM quotations WHERE code = $1 FOR UPDATE', [readCode(rawCode)]);
  if (rows.length === 0) throw fail(404, 'Quotation not found.', 'quote_not_found');
  const quote = rows[0];
  const state = stateOf(quote, now);
  if (state === 'expired') throw fail(409, 'This quotation has expired. Ask the buyer for a new one.', 'quote_expired');
  if (state !== 'open') throw fail(409, 'This quotation is no longer open.', 'quote_closed');
  const name = clean(payer && payer.name, 120);
  const email = clean(payer && payer.email, 160);
  const method = clean(payer && payer.paymentMethod, 80);
  if (!name) throw fail(400, 'Enter your name.', 'quote_payer_name');
  if (!EMAIL.test(email)) throw fail(400, 'Enter a valid email address.', 'quote_payer_email');
  if (!method) throw fail(400, 'Choose a payment method.', 'quote_payment_method');
  const { rows: pm } = await q.query('SELECT 1 FROM payment_methods WHERE id = $1', [method]);
  if (pm.length === 0) throw fail(400, 'Choose a payment method.', 'quote_payment_method');
  const { rows: upd } = await q.query(
    `UPDATE quotation_shares SET confirmed_at = $1, payer_name = $2, payer_email = $3, payer_phone = $4, payment_method = $5
     WHERE id = $6 AND quotation_id = $7 AND confirmed_at IS NULL RETURNING id`,
    [now, name, email, clean(payer && payer.phone, 40) || null, method, Number(shareId), quote.id]
  );
  if (upd.length === 0) throw fail(409, 'This share is already confirmed.', 'quote_share_done');
  const { rows: left } = await q.query('SELECT COUNT(*)::int AS n FROM quotation_shares WHERE quotation_id = $1 AND confirmed_at IS NULL', [quote.id]);
  if (Number(left[0].n) > 0) return { orderId: null };
  const full = await loadFull(q, 'id', quote.id);
  return { orderId: await createOrderFromQuotation(q, full) };
}

module.exports = {
  DEFAULT_VALIDITY_DAYS, PARTY_TYPES, splitShares, createQuotation, confirmShare, createOrderFromQuotation, loadFull, toDto, stateOf, showCode, readCode, round2,
};
