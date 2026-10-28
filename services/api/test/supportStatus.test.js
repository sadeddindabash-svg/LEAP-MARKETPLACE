// Support tickets: the Status only moves FORWARD (open -> in_progress -> resolved) and can never be undone, through the REAL route and the real database:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/supportStatus.test.js
// (it refuses to run on a database whose name does not end in "_test", and removes the tickets it creates)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/pool');
require('./helpers/realRouters');
const express = require('express');

let server, base, adminToken, supplierToken;
const q = (sql, params) => db.query(sql, params);
const login = async (email, password) => (await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const patch = (id, status, token = adminToken) => fetch(`${base}/support/tickets/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status }) });
const status = async (id) => (await q('SELECT status FROM support_tickets WHERE id = $1', [id])).rows[0].status;
const make = async (id, st) => { await q('DELETE FROM support_ticket_messages WHERE ticket_id = $1', [id]); await q('DELETE FROM support_tickets WHERE id = $1', [id]); await q("INSERT INTO support_tickets (id, guest_email, subject, status, priority) VALUES ($1, 'zz-ts@example.com', 'ZZ status test', $2, 'medium')", [id, st]); };
const cleanup = async () => { await q("DELETE FROM support_ticket_messages WHERE ticket_id LIKE 'T-ZZTS%'"); await q("DELETE FROM support_tickets WHERE id LIKE 'T-ZZTS%'"); };

before(async () => {
  await cleanup();
  const app = express(); app.use(express.json()); app.use('/auth', require('../src/modules/auth/routes')); app.use('/support', require('../src/modules/support/routes')); app.use((err, req, res, next) => res.status(500).json({ error: err.message }));
  server = app.listen(0); base = `http://localhost:${server.address().port}`;
  adminToken = await login('admin@leap.dev', 'admin_dev_password_123'); supplierToken = await login('supplier@leap.dev', 'supplier_dev_password_123');
  assert.ok(adminToken, 'the dev admin can sign in');
});
after(async () => { await cleanup(); server.close(); await db.getPool().end(); });

test('open -> in progress is allowed, and so is open -> resolved (a step may be skipped)', async () => {
  await make('T-ZZTS1', 'open'); let r = await patch('T-ZZTS1', 'in_progress'); assert.equal(r.status, 200); assert.equal((await r.json()).status, 'in_progress'); assert.equal(await status('T-ZZTS1'), 'in_progress');
  await make('T-ZZTS2', 'open'); r = await patch('T-ZZTS2', 'resolved'); assert.equal(r.status, 200); assert.equal(await status('T-ZZTS2'), 'resolved');
});
test('in progress -> resolved is allowed', async () => { await make('T-ZZTS3', 'in_progress'); const r = await patch('T-ZZTS3', 'resolved'); assert.equal(r.status, 200); assert.equal(await status('T-ZZTS3'), 'resolved'); });
test('BACKWARD is refused (409) and changes nothing: in progress -> open', async () => {
  await make('T-ZZTS4', 'in_progress'); const before = (await q('SELECT updated_at FROM support_tickets WHERE id = $1', ['T-ZZTS4'])).rows[0].updated_at; const r = await patch('T-ZZTS4', 'open'); const body = await r.json();
  assert.equal(r.status, 409); assert.equal(body.currentStatus, 'in_progress'); assert.match(body.error, /only moves forward/); assert.equal(await status('T-ZZTS4'), 'in_progress'); assert.deepEqual((await q('SELECT updated_at FROM support_tickets WHERE id = $1', ['T-ZZTS4'])).rows[0].updated_at, before);
});
test('Resolved is final: it cannot go back to in progress or to open', async () => {
  await make('T-ZZTS5', 'resolved'); for (const s of ['in_progress', 'open']) { const r = await patch('T-ZZTS5', s); assert.equal(r.status, 409, s); assert.equal(await status('T-ZZTS5'), 'resolved'); }
});
test('the same status again is a harmless no-op (200, nothing changes, the time is not touched)', async () => {
  for (const s of ['open', 'in_progress', 'resolved']) { const id = `T-ZZTS6${s.length}`; await make(id, s); const before = (await q('SELECT updated_at FROM support_tickets WHERE id = $1', [id])).rows[0].updated_at; const r = await patch(id, s); assert.equal(r.status, 200, s); assert.equal((await r.json()).status, s); assert.deepEqual((await q('SELECT updated_at FROM support_tickets WHERE id = $1', [id])).rows[0].updated_at, before, s); }
});
test('two admins at the same moment (resolve and reopen): the ticket ends Resolved whatever the order', async () => {
  for (let i = 0; i < 6; i++) { await make('T-ZZTS7', 'in_progress'); const rs = await Promise.all([patch('T-ZZTS7', 'resolved'), patch('T-ZZTS7', 'open'), patch('T-ZZTS7', 'in_progress')]); assert.equal(await status('T-ZZTS7'), 'resolved'); assert.ok(rs.some((r) => r.status === 200)); }
});
test('a bad status is 400, an unknown ticket is 404, and a signed-out or non-admin caller is refused', async () => {
  await make('T-ZZTS8', 'open'); assert.equal((await patch('T-ZZTS8', 'closed')).status, 400); assert.equal((await patch('T-ZZTS8', undefined)).status, 400); assert.equal((await patch('T-ZZTS-NOPE', 'resolved')).status, 404);
  assert.equal((await patch('T-ZZTS8', 'resolved', 'not-a-token')).status, 401); assert.equal((await patch('T-ZZTS8', 'resolved', supplierToken)).status, 403); assert.equal(await status('T-ZZTS8'), 'open');
});
test('an admin reply moves an OPEN ticket to in progress (forward), and never moves a resolved ticket back', async () => {
  const reply = (id) => fetch(`${base}/support/tickets/${id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ message: 'ZZ hello' }) });
  await make('T-ZZTS9', 'open'); assert.equal((await reply('T-ZZTS9')).status, 201); assert.equal(await status('T-ZZTS9'), 'in_progress');
  await make('T-ZZTS10', 'resolved'); await reply('T-ZZTS10'); assert.equal(await status('T-ZZTS10'), 'resolved');
});
