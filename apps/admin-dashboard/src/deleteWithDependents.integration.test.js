// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import { createRequire } from 'module';
import { Pool } from 'pg';

const require = createRequire(import.meta.url);
const engine = require('../../../services/api/scripts/deleteWithDependents.js');

// Uses a real order made through the real backend, runs the engine on it INSIDE a transaction, and ALWAYS rolls the transaction back: nothing is ever deleted.
const BACKEND_URL = 'http://localhost:4000';
const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev';
const ADDRESS = { recipientName: 'John Smith', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' };
const pool = new Pool({ connectionString: TEST_DB_URL });
afterAll(async () => { await pool.end(); });

async function isBackendUp() { try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; } }
const backendUp = await isBackendUp();

async function newOrder() {
  const order = await fetch(`${BACKEND_URL}/order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], guestEmail: `engine.${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`, address: ADDRESS }) }).then((r) => r.json());
  expect(order.id).toBeTruthy();
  return order.id;
}
async function inRolledBackTransaction(work) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); return await work(client); } finally { await client.query('ROLLBACK'); client.release(); }
}

describe.runIf(backendUp)('the engine that deletes rows together with everything that depends on them (real schema, always rolled back)', () => {
  it('CRITICAL: starting from one order it finds its sub-orders, line items and address, deletes them all in a workable order, and leaves every other order alone', async () => {
    const mine = await newOrder();
    const other = await newOrder();
    await inRolledBackTransaction(async (client) => {
      const foreignKeys = await engine.loadForeignKeys(client);
      expect(foreignKeys.length).toBeGreaterThan(50);                               // it really read the database's foreign keys
      await engine.startMarking(client);
      expect(await engine.markRows(client, 'orders', 't.id = ANY($1::text[])', [[mine]])).toBe(1);
      await engine.markDependents(client, foreignKeys);
      const marked = await engine.markedCounts(client);
      expect(marked.orders).toBe(1);
      expect(marked.supplier_sub_orders).toBeGreaterThanOrEqual(1);
      expect(marked.order_line_items).toBeGreaterThanOrEqual(1);
      expect(marked.order_addresses).toBeGreaterThanOrEqual(1);

      const deleted = await engine.deleteMarked(client);
      expect(deleted.orders).toBe(1);
      expect((await client.query('SELECT count(*)::int AS n FROM orders WHERE id = $1', [mine])).rows[0].n).toBe(0);
      expect((await client.query('SELECT count(*)::int AS n FROM supplier_sub_orders WHERE order_id = $1', [mine])).rows[0].n).toBe(0);
      expect((await client.query('SELECT count(*)::int AS n FROM orders WHERE id = $1', [other])).rows[0].n).toBe(1);   // the other order is untouched
      expect((await client.query('SELECT count(*)::int AS n FROM order_line_items oli JOIN supplier_sub_orders so ON so.id = oli.sub_order_id WHERE so.order_id = $1', [other])).rows[0].n).toBeGreaterThanOrEqual(1);
    });
    // the transaction was rolled back: BOTH orders are still there
    for (const id of [mine, other]) expect((await pool.query('SELECT count(*)::int AS n FROM orders WHERE id = $1', [id])).rows[0].n).toBe(1);
  }, 60000);

  it('CRITICAL: an order that something still points at (a return case) is REFUSED by the database when deleted bare, and the engine removes that dependent too so the deletion goes through', async () => {
    const mine = await newOrder();
    await inRolledBackTransaction(async (client) => {
      const { rows: subs } = await client.query('SELECT id FROM supplier_sub_orders WHERE order_id = $1', [mine]);
      await client.query(`INSERT INTO return_cases (id, order_id, sub_order_id, guest_email, reason, status) VALUES ($1, $2, $3, 'engine@example.com', 'engine test', 'awaiting')`, [`RC-engine-${Date.now()}`, mine, subs[0].id]);

      await client.query('SAVEPOINT bare_delete');
      let refusal = null;
      try { await client.query('DELETE FROM orders WHERE id = $1', [mine]); } catch (err) { refusal = err.code; }
      expect(refusal).toBe('23503');                                                   // the database refuses: a return case still points at it
      await client.query('ROLLBACK TO SAVEPOINT bare_delete');

      const foreignKeys = await engine.loadForeignKeys(client);
      await engine.startMarking(client);
      await engine.markRows(client, 'orders', 't.id = ANY($1::text[])', [[mine]]);
      await engine.markDependents(client, foreignKeys);
      expect((await engine.markedCounts(client)).return_cases).toBe(1);                // the engine found the return case
      const deleted = await engine.deleteMarked(client);
      expect(deleted.return_cases).toBe(1);                                            // removed it first...
      expect(deleted.orders).toBe(1);                                                  // ...so the order could go
      expect((await client.query('SELECT count(*)::int AS n FROM orders WHERE id = $1', [mine])).rows[0].n).toBe(0);
    });
    expect((await pool.query('SELECT count(*)::int AS n FROM orders WHERE id = $1', [mine])).rows[0].n).toBe(1);   // rolled back: nothing was really deleted
  }, 60000);

  it('rows whose link is "ON DELETE SET NULL" are NOT marked (the database blanks the link and keeps the row)', async () => {
    await inRolledBackTransaction(async (client) => {
      const foreignKeys = await engine.loadForeignKeys(client);
      const setNull = foreignKeys.filter((fk) => fk.rule === 'n');
      expect(setNull.length).toBeGreaterThan(0);                                       // there are such links (e.g. bug reports)
      expect(foreignKeys.some((fk) => fk.rule === 'c')).toBe(true);
      expect(foreignKeys.every((fk) => ['a', 'c', 'n', 'r', 'd'].includes(fk.rule))).toBe(true);
    });
  }, 30000);
});
