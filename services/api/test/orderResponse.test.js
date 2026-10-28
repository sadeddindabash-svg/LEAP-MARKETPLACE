// A supplier ACCEPTS or REFUSES a new order; 24 hours to answer, a reminder every 4 hours, then the admin (never cancelled silently); a refusal cancels only that supplier's part, tells the buyer and the admin,
// and the admin can reassign it. Through the REAL routes and the real database:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/orderResponse.test.js
// (it needs migrations 112 and 113; it refuses to run on a database whose name does not end in "_test", and removes everything it creates)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/pool');
require('./helpers/realRouters');
const express = require('express');
const { nextStep, MAX_REMINDERS, REFUSAL_REASONS } = require('../src/modules/orderResponse/helpers');
const { checkPendingResponses } = require('../src/modules/orderResponse/check');
const orderResponse = require('../src/modules/orderResponse/routes');

const S1 = 's1', S2 = 'zz-or-s2';
let server, base, adminToken, supplierToken, buyerId, s1UserId, adminIds;
const q = (sql, params) => db.query(sql, params);
const login = async (email, password) => (await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const call = (method, path, token, body) => fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
const sup = (m, p, b, t = supplierToken) => call(m, `/supplier/me/orders${p}`, t, b);
const adm = (m, p, b, t = adminToken) => call(m, `/supplier-responses${p}`, t, b);
const wipe = async () => {
  await q("DELETE FROM notifications WHERE link_id LIKE 'zz-or-%'"); await q("DELETE FROM order_line_items WHERE sub_order_id IN (SELECT id FROM supplier_sub_orders WHERE order_id LIKE 'zz-or-%')");
  await q("DELETE FROM hub_shipments WHERE sub_order_id IN (SELECT id FROM supplier_sub_orders WHERE order_id LIKE 'zz-or-%')"); await q("DELETE FROM supplier_sub_orders WHERE order_id LIKE 'zz-or-%'");
  await q("DELETE FROM orders WHERE id LIKE 'zz-or-%'"); await q("DELETE FROM products WHERE id LIKE 'zz-or-%'"); await q("DELETE FROM suppliers WHERE id = $1", [S2]);
  await q("DELETE FROM admin_audit_log WHERE action IN ('supplier_refusal_handled', 'supplier_refusal_reassigned')").catch(() => {});
};
let n = 0;
const mk = async ({ status = 'pending', respondBy = null, lines = [['p1', 2]], supplier = S1, orderStatus = 'to_ship', orderId = null } = {}) => {
  const oid = orderId || `zz-or-${++n}`; if (!orderId) await q("INSERT INTO orders (id, buyer_id, status, total, currency_code) VALUES ($1, $2, $3, 60, 'USD')", [oid, buyerId, orderStatus]);
  const so = (await q("INSERT INTO supplier_sub_orders (order_id, supplier_id, status, respond_by) VALUES ($1, $2, $3, COALESCE($4::timestamptz, now() + interval '24 hours')) RETURNING id", [oid, supplier, status, respondBy])).rows[0].id;
  for (const [pid, qty] of lines) await q("INSERT INTO order_line_items (sub_order_id, product_id, quantity, unit_price, supplier_unit_price_cny) VALUES ($1, $2, $3, 30, $4)", [so, `zz-or-${pid}`, qty, pid === 'alt' ? 40 : 50]);
  return { orderId: oid, subOrderId: so };
};
const row = async (id) => (await q('SELECT * FROM supplier_sub_orders WHERE id = $1', [id])).rows[0];
const stock = async (p) => (await q('SELECT stock_quantity, status FROM products WHERE id = $1', [`zz-or-${p}`])).rows[0];
const notified = async (userId, orderId) => Number((await q('SELECT COUNT(*) AS n FROM notifications WHERE user_id = $1 AND link_id = $2', [userId, orderId])).rows[0].n);
const setStock = (p, s, status = 'active') => q("UPDATE products SET stock_quantity = $2, status = $3 WHERE id = $1", [`zz-or-${p}`, s, status]);

before(async () => {
  await wipe();
  const app = express(); app.use(express.json()); app.use('/auth', require('../src/modules/auth/routes')); app.use('/supplier/me/orders', orderResponse.supplierRouter); app.use('/supplier', require('../src/modules/supplier/routes')); app.use('/supplier-responses', orderResponse.adminRouter);
  app.use((err, req, res, next) => res.status(500).json({ error: err.message })); server = app.listen(0); base = `http://localhost:${server.address().port}`;
  adminToken = await login('admin@leap.dev', 'admin_dev_password_123'); supplierToken = await login('supplier@leap.dev', 'supplier_dev_password_123');
  buyerId = (await q("SELECT id FROM users WHERE role = 'buyer' ORDER BY id LIMIT 1")).rows[0].id; s1UserId = (await q("SELECT id FROM users WHERE email = 'supplier@leap.dev'")).rows[0].id; adminIds = (await q("SELECT id FROM users WHERE role = 'admin'")).rows.map((r) => r.id);
  await q("INSERT INTO suppliers (id, name) VALUES ($1, 'ZZ Alt Supplier')", [S2]);
  for (const [id, sup_, oem, price] of [['p1', S1, 'ZZ-OEM-1', 50], ['p2', S1, null, 60], ['alt', S2, 'ZZ-OEM-1', 40]]) await q("INSERT INTO products (id, name, price, currency_code, supplier_id, stock_quantity, category, status, oem_number, weight_kg, length_cm, width_cm, height_cm) VALUES ($1, $2, $3, 'CNY', $4, 10, 'brake', 'active', $5, 1, 10, 10, 10)", [`zz-or-${id}`, `OR part ${id}`, price, sup_, oem]);
});
after(async () => { await wipe(); server.close(); await db.getPool().end(); });

// ---------------------------------------------------------------- the reminder timeline (pure)
const at = (hoursAfterOrder, over = {}) => { const placed = new Date('2026-10-28T08:00:00Z'); return nextStep({ status: 'pending', respondBy: new Date(placed.getTime() + 24 * 3600e3), remindersSent: 0, escalatedAt: null, now: new Date(placed.getTime() + hoursAfterOrder * 3600e3), ...over }); };
test('the timeline: nothing before 4 hours, a reminder at 4, 8, 12, 16 and 20 hours, then the admin at 24', () => {
  assert.equal(at(0).action, 'none'); assert.equal(at(3.9).action, 'none');
  for (const [h, due] of [[4, 1], [8, 2], [12, 3], [16, 4], [20, 5]]) { const s = at(h, { remindersSent: due - 1 }); assert.equal(s.action, 'remind', `at ${h}h`); assert.equal(s.remindersDue, due); assert.equal(at(h + 0.5, { remindersSent: due }).action, 'none', `no second reminder at ${h + 0.5}h`); }
  assert.equal(at(23.9, { remindersSent: 5 }).action, 'none'); assert.equal(at(24, { remindersSent: 5 }).action, 'escalate'); assert.equal(at(30, { remindersSent: 5 }).action, 'escalate'); assert.equal(MAX_REMINDERS, 5);
});
test('after the server was down: ONE reminder (not one per missed slot), never more than 5, and nothing once escalated, answered or cancelled', () => {
  const s = at(13, { remindersSent: 0 }); assert.equal(s.action, 'remind'); assert.equal(s.remindersDue, 3); assert.equal(at(23, { remindersSent: 0 }).remindersDue, 5);
  assert.equal(at(30, { escalatedAt: new Date() }).action, 'none'); for (const status of ['preparing', 'shipped', 'cancelled']) assert.equal(at(30, { status }).action, 'none');
  assert.equal(nextStep({ status: 'pending', respondBy: null, now: new Date() }).action, 'none');
});
test('hours left is stated in whole hours, never negative', () => { assert.equal(at(4, { remindersSent: 0 }).hoursLeft, 20); assert.equal(at(23.5, { remindersSent: 4 }).hoursLeft, 1); });

// ---------------------------------------------------------------- the reminder job (real database)
test('the job: a reminder to the supplier, the admin told after 24 hours; it never cancels, never repeats, and leaves answered orders alone', async () => {
  const now = new Date(); const A = await mk({ respondBy: new Date(now.getTime() + 19 * 3600e3).toISOString() });      // ordered 5 hours ago
  const B = await mk({ respondBy: new Date(now.getTime() - 3600e3).toISOString() });                                      // 25 hours ago
  const C = await mk({ status: 'preparing', respondBy: new Date(now.getTime() - 3600e3).toISOString() });                  // answered
  const supBefore = await notified(s1UserId, A.orderId); const adminBefore = await notified(adminIds[0], B.orderId);
  const r1 = await checkPendingResponses(now); assert.ok(r1.reminded >= 1 && r1.escalated >= 1);
  assert.equal((await row(A.subOrderId)).reminders_sent, 1); assert.equal(await notified(s1UserId, A.orderId), supBefore + 1); assert.equal((await row(A.subOrderId)).status, 'pending');
  assert.ok((await row(B.subOrderId)).escalated_at); assert.equal(await notified(adminIds[0], B.orderId), adminBefore + 1, 'the admin is told'); assert.equal((await row(B.subOrderId)).status, 'pending', 'NEVER cancelled by the job');
  const c = await row(C.subOrderId); assert.equal(c.escalated_at, null); assert.equal(c.reminders_sent, 0);
  const r2 = await checkPendingResponses(now); assert.deepEqual(r2, { reminded: 0, escalated: 0 }); assert.equal(await notified(adminIds[0], B.orderId), adminBefore + 1, 'the admin is told only once');
  const open = await (await adm('GET', '')).json(); const mine = open.find((x) => x.subOrderId === B.subOrderId); assert.ok(mine); assert.equal(mine.kind, 'no_answer'); assert.ok(!open.find((x) => x.subOrderId === A.subOrderId));
});

// ---------------------------------------------------------------- accept
test('accept: the order moves on as before (preparing), the time is kept; a second accept is refused; and it can no longer be refused', async () => {
  const o = await mk(); const r = await sup('POST', `/${o.subOrderId}/accept`); const j = await r.json(); assert.equal(r.status, 200, JSON.stringify(j)); assert.equal(j.status, 'preparing'); assert.ok(j.acceptedAt); assert.equal(j.canRefuse, false);
  assert.equal((await row(o.subOrderId)).status, 'preparing'); const again = await sup('POST', `/${o.subOrderId}/accept`); assert.equal(again.status, 409); assert.equal((await again.json()).code, 'already_accepted');
  const ref = await sup('POST', `/${o.subOrderId}/refuse`, { reason: 'out_of_stock' }); const rj = await ref.json(); assert.equal(ref.status, 409); assert.match(rj.error, /already accepted/); assert.equal((await row(o.subOrderId)).status, 'preparing');
});
test('accept and refuse belong to the supplier of the order; a signed-out caller or an admin cannot answer', async () => {
  const other = await mk({ supplier: S2, lines: [['alt', 1]] }); for (const p of ['accept', 'refuse']) { assert.equal((await sup('POST', `/${other.subOrderId}/${p}`, { reason: 'out_of_stock' })).status, 404, p); assert.equal((await sup('POST', `/${other.subOrderId}/${p}`, { reason: 'out_of_stock' }, adminToken)).status, 403, p); assert.equal((await sup('POST', `/${other.subOrderId}/${p}`, {}, 'bad')).status, 401, p); }
  assert.equal((await row(other.subOrderId)).status, 'pending'); assert.equal((await sup('POST', '/999999/accept')).status, 404);
});
test('moving an order to preparing the old way (PATCH) records the acceptance too', async () => { const o = await mk(); const r = await call('PATCH', `/supplier/me/orders/${o.subOrderId}`, supplierToken, { status: 'preparing' }); assert.equal(r.status, 200); assert.ok((await row(o.subOrderId)).accepted_at); });

// ---------------------------------------------------------------- refuse
test('refuse: a reason is required, and "other" needs a short note', async () => {
  const o = await mk(); for (const bad of [undefined, '', 'because', 'OUT_OF_STOCK']) assert.equal((await sup('POST', `/${o.subOrderId}/refuse`, { reason: bad })).status, 400, String(bad));
  assert.equal((await sup('POST', `/${o.subOrderId}/refuse`, { reason: 'other' })).status, 400); assert.equal((await sup('POST', `/${o.subOrderId}/refuse`, { reason: 'other', note: ' ' })).status, 400); assert.equal((await row(o.subOrderId)).status, 'pending');
  const ok = await sup('POST', `/${o.subOrderId}/refuse`, { reason: 'other', note: 'Supplier is closed for the holiday' }); assert.equal(ok.status, 200); const r = await row(o.subOrderId); assert.equal(r.refusal_note, 'Supplier is closed for the holiday'); assert.equal(r.refusal_reason, 'other');
  assert.deepEqual(REFUSAL_REASONS, ['out_of_stock', 'price_changed', 'discontinued', 'cannot_ship_in_time', 'other']);
});
test('refuse: out of stock - only that part is cancelled with the reason, the stock goes to 0, the buyer and the admin are told, the order is cancelled when it was the only part', async () => {
  await setStock('p1', 10); const o = await mk(); const aboutOrder = async () => Number((await q("SELECT COUNT(*) AS n FROM notifications WHERE user_id = $1 AND body LIKE $2", [buyerId, `%${o.orderId}%`])).rows[0].n);      // the buyer's notice links to the PART (to see the alternatives) and names the order in its text
  const buyerBefore = await aboutOrder(); const adminBefore = await notified(adminIds[0], o.orderId);
  const r = await sup('POST', `/${o.subOrderId}/refuse`, { reason: 'out_of_stock' }); const j = await r.json(); assert.equal(r.status, 200, JSON.stringify(j)); assert.equal(j.status, 'cancelled'); assert.equal(j.orderCancelled, true);
  const so = await row(o.subOrderId); assert.equal(so.status, 'cancelled'); assert.equal(so.refusal_reason, 'out_of_stock'); assert.ok(so.refused_at); assert.equal((await q('SELECT status FROM orders WHERE id = $1', [o.orderId])).rows[0].status, 'cancelled'); assert.equal((await stock('p1')).stock_quantity, 0);
  await new Promise((r) => setTimeout(r, 150)); assert.equal(await aboutOrder(), buyerBefore + 1, 'the buyer is told'); assert.equal(await notified(adminIds[0], o.orderId), adminBefore + 1, 'the admin is told');
  const n = (await q("SELECT title, body, title_ar, type, link_type, link_id FROM notifications WHERE user_id = $1 AND body LIKE $2 ORDER BY id DESC LIMIT 1", [buyerId, `%${o.orderId}%`])).rows[0]; assert.match(n.title, /unavailable/); assert.equal(n.type, 'order_status'); assert.equal(n.link_type, 'product'); assert.equal(n.link_id, 'zz-or-p1', 'it opens the part, where the alternatives are'); assert.match(n.body, /will not be charged/); assert.ok(n.title_ar);
  assert.equal((await sup('POST', `/${o.subOrderId}/refuse`, { reason: 'out_of_stock' })).status, 409, 'a second refusal is refused'); assert.equal((await sup('POST', `/${o.subOrderId}/accept`)).status, 409, 'and so is accepting a cancelled order');
});
test('refuse: with ANOTHER supplier\'s part in the same order, only this part is cancelled and the order goes on', async () => {
  const a = await mk(); const b = await mk({ supplier: S2, lines: [['alt', 1]], orderId: a.orderId }); const r = await sup('POST', `/${a.subOrderId}/refuse`, { reason: 'cannot_ship_in_time' }); assert.equal((await r.json()).orderCancelled, false);
  assert.equal((await row(b.subOrderId)).status, 'pending'); assert.equal((await q('SELECT status FROM orders WHERE id = $1', [a.orderId])).rows[0].status, 'to_ship');
});
test('what each reason does to the part: price changed / cannot ship / other put the reserved units back; discontinued stops selling it; out of stock empties it', async () => {
  for (const [reason, expected] of [['price_changed', 12], ['cannot_ship_in_time', 12], ['other', 12]]) { await setStock('p1', 10); const o = await mk({ lines: [['p1', 2]] }); const r = await sup('POST', `/${o.subOrderId}/refuse`, { reason, note: 'ok then' }); assert.equal(r.status, 200); assert.equal((await stock('p1')).stock_quantity, expected, reason); assert.equal((await stock('p1')).status, 'active'); }
  await setStock('p1', 10); const d = await mk({ lines: [['p1', 2]] }); await sup('POST', `/${d.subOrderId}/refuse`, { reason: 'discontinued' }); assert.equal((await stock('p1')).status, 'inactive'); await setStock('p1', 10);
});
test('the supplier\'s order list says what can be done and until when; a refused order shows its reason', async () => {
  const o = await mk(); const list = async () => (await (await call('GET', '/supplier/me/orders', supplierToken)).json()).find((x) => x.subOrderId === o.subOrderId);
  let so = await list(); assert.equal(so.canAccept, true); assert.equal(so.canRefuse, true); assert.ok(so.respondBy); assert.equal(so.acceptedAt, null);
  await sup('POST', `/${o.subOrderId}/refuse`, { reason: 'price_changed' }); so = await list(); assert.equal(so.canAccept, false); assert.equal(so.canRefuse, false); assert.equal(so.refusalReason, 'price_changed'); assert.ok(so.refusedAt);
  const p = await mk(); await sup('POST', `/${p.subOrderId}/accept`); const acc = (await (await call('GET', '/supplier/me/orders', supplierToken)).json()).find((x) => x.subOrderId === p.subOrderId); assert.equal(acc.canAccept, false); assert.equal(acc.canRefuse, false); assert.ok(acc.acceptedAt);
});

// ---------------------------------------------------------------- the admin
test('the admin list: refused orders with reason, items and the supplier\'s RMB price; marking one handled moves it to "handled"; only an admin sees it', async () => {
  await setStock('p1', 10); const o = await mk({ lines: [['p1', 2]] }); await sup('POST', `/${o.subOrderId}/refuse`, { reason: 'out_of_stock' });
  const open = await (await adm('GET', '?filter=open')).json(); const mine = open.find((x) => x.subOrderId === o.subOrderId); assert.ok(mine); assert.equal(mine.kind, 'refused'); assert.equal(mine.reason, 'out_of_stock'); assert.equal(mine.supplierId, S1); assert.deepEqual(mine.items.map((i) => [i.productId, i.quantity, i.buyerUnitPriceUsd, i.supplierUnitPriceCny]), [['zz-or-p1', 2, 30, 50]]);
  assert.equal((await adm('GET', '', null, supplierToken)).status, 403); assert.equal((await adm('GET', '?filter=nonsense')).status, 400);
  const h = await adm('POST', `/${o.subOrderId}/handled`, { note: 'called the buyer' }); assert.equal(h.status, 200); assert.ok(!(await (await adm('GET', '?filter=open')).json()).find((x) => x.subOrderId === o.subOrderId)); assert.ok((await (await adm('GET', '?filter=handled')).json()).find((x) => x.subOrderId === o.subOrderId));
  assert.equal((await adm('POST', `/${o.subOrderId}/handled`, {})).status, 409); assert.equal((await adm('POST', '/999999/handled', {})).status, 404); const fresh = await mk(); assert.equal((await adm('POST', `/${fresh.subOrderId}/handled`, {})).status, 409, 'a normal order is neither refused nor unanswered');
});
test('alternatives: other suppliers\' live parts with the same OEM number and enough stock; none for a part without an OEM number', async () => {
  await setStock('p1', 10); const o = await mk({ lines: [['p1', 2], ['p2', 1]] }); await sup('POST', `/${o.subOrderId}/refuse`, { reason: 'out_of_stock' }); const alts = await (await adm('GET', `/${o.subOrderId}/alternatives`)).json();
  const p1 = alts.find((a) => a.productId === 'zz-or-p1'); assert.deepEqual(p1.alternatives.map((a) => [a.productId, a.supplierId, a.supplierPriceCny]), [['zz-or-alt', S2, 40]]); assert.deepEqual(alts.find((a) => a.productId === 'zz-or-p2').alternatives, []);
  await setStock('alt', 1); assert.deepEqual((await (await adm('GET', `/${o.subOrderId}/alternatives`)).json()).find((a) => a.productId === 'zz-or-p1').alternatives, [], 'not enough stock'); await setStock('alt', 5);
});
test('reassign: the part goes to the other supplier at the buyer\'s agreed price, with that supplier\'s RMB price; the stock, the order and the notices follow; it cannot be done twice', async () => {
  await setStock('p1', 10); await setStock('alt', 5); const o = await mk({ lines: [['p1', 2]] }); await sup('POST', `/${o.subOrderId}/refuse`, { reason: 'out_of_stock' }); assert.equal((await q('SELECT status FROM orders WHERE id = $1', [o.orderId])).rows[0].status, 'cancelled');
  const bad = [[{ items: [] }, 400], [{ items: [{ productId: 'zz-or-p1', alternativeProductId: 'zz-or-p1' }] }, 400], [{ items: [{ productId: 'zz-or-p1', alternativeProductId: 'zz-or-nope' }] }, 400], [{}, 400]];
  for (const [body, code] of bad) assert.equal((await adm('POST', `/${o.subOrderId}/reassign`, body)).status, code, JSON.stringify(body));
  await q("UPDATE products SET oem_number = 'OTHER' WHERE id = 'zz-or-alt'"); assert.equal((await adm('POST', `/${o.subOrderId}/reassign`, { items: [{ productId: 'zz-or-p1', alternativeProductId: 'zz-or-alt' }] })).status, 400, 'a different OEM number'); await q("UPDATE products SET oem_number = 'ZZ-OEM-1' WHERE id = 'zz-or-alt'");
  await setStock('alt', 1); assert.equal((await adm('POST', `/${o.subOrderId}/reassign`, { items: [{ productId: 'zz-or-p1', alternativeProductId: 'zz-or-alt' }] })).status, 409, 'not enough stock'); await setStock('alt', 5);
  const buyerBefore = await notified(buyerId, o.orderId); const ok = await adm('POST', `/${o.subOrderId}/reassign`, { items: [{ productId: 'zz-or-p1', alternativeProductId: 'zz-or-alt' }] }); const j = await ok.json(); assert.equal(ok.status, 201, JSON.stringify(j)); assert.equal(j.reassignedTo.supplierId, S2);
  const nu = await row(j.reassignedTo.subOrderId); assert.equal(nu.status, 'pending'); assert.equal(nu.order_id, o.orderId); assert.ok(nu.respond_by, 'the new supplier gets their own 24 hours');
  const line = (await q('SELECT product_id, quantity, unit_price, supplier_unit_price_cny FROM order_line_items WHERE sub_order_id = $1', [nu.id])).rows[0]; assert.deepEqual([line.product_id, line.quantity, Number(line.unit_price), Number(line.supplier_unit_price_cny)], ['zz-or-alt', 2, 30, 40]);
  assert.equal((await stock('alt')).stock_quantity, 3); assert.equal((await q('SELECT status FROM orders WHERE id = $1', [o.orderId])).rows[0].status, 'to_ship', 'the order is alive again'); const old = await row(o.subOrderId); assert.equal(old.reassigned_to_sub_order_id, nu.id); assert.ok(old.refusal_handled_at);
  await new Promise((r) => setTimeout(r, 150)); assert.equal(await notified(buyerId, o.orderId), buyerBefore + 1, 'the buyer is told');
  assert.equal((await adm('POST', `/${o.subOrderId}/reassign`, { items: [{ productId: 'zz-or-p1', alternativeProductId: 'zz-or-alt' }] })).status, 409, 'not twice'); const pending = await mk(); assert.equal((await adm('POST', `/${pending.subOrderId}/reassign`, { items: [] })).status, 409, 'only a refused order');
});
