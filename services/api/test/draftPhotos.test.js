const test = require('node:test');
const assert = require('node:assert/strict');
const drafts = require('../src/modules/draftPhotos/service');

// The evidence photos being added for a step (migration 130), shared by the hub portal and the hub app. A tiny in-memory database.
function fakeDb() {
  const rows = []; let id = 0;
  return {
    rows,
    async query(sql, p) {
      if (sql.startsWith('SELECT id FROM hub_shipments')) return { rows: p[1] === 'hub-1' ? [{ id: p[0] }] : [] };
      if (sql.startsWith('SELECT COUNT(*)')) return { rows: [{ n: rows.filter((r) => r.shipment_id === p[0] && r.purpose === p[1]).length }] };
      if (sql.startsWith('INSERT')) { if (!rows.some((r) => r.shipment_id === p[0] && r.purpose === p[1] && r.url === p[2])) rows.push({ id: ++id, shipment_id: p[0], purpose: p[1], url: p[2] }); return { rows: [] }; }
      if (sql.startsWith('DELETE FROM hub_draft_photos WHERE shipment_id = $1 AND')) { for (let i = rows.length - 1; i >= 0; i--) if (rows[i].shipment_id === p[0] && rows[i].purpose === p[1] && rows[i].url === p[2]) rows.splice(i, 1); return { rows: [] }; }
      if (sql.startsWith('DELETE')) { for (let i = rows.length - 1; i >= 0; i--) if (rows[i].shipment_id === p[0]) rows.splice(i, 1); return { rows: [] }; }
      if (sql.startsWith('SELECT purpose, url')) return { rows: rows.filter((r) => r.shipment_id === p[0]) };
      throw new Error(sql);
    },
  };
}

test('a photo added on one screen is listed for the other; removing and confirming the step clear it', async () => {
  const db = fakeDb();
  const who = { shipmentId: 7, hubId: 'hub-1', userId: 'u1' };
  assert.deepEqual(await drafts.add(db, { ...who, purpose: 'step', url: '/uploads/a.jpg' }), { step: ['/uploads/a.jpg'], flag: [], fault_return: [] });
  await drafts.add(db, { ...who, purpose: 'step', url: '/uploads/a.jpg' });      // the same photo twice is kept once
  await drafts.add(db, { ...who, purpose: 'flag', url: '/uploads/b.jpg' });
  assert.deepEqual(await drafts.listFor(db, 7), { step: ['/uploads/a.jpg'], flag: ['/uploads/b.jpg'], fault_return: [] });
  assert.deepEqual((await drafts.remove(db, { ...who, purpose: 'step', url: '/uploads/a.jpg' })).step, []);
  await drafts.clearFor(db, 7);
  assert.equal(db.rows.length, 0);
});

test('only this hub\'s shipments, only uploaded photos, only known forms', async () => {
  const db = fakeDb();
  await assert.rejects(drafts.add(db, { shipmentId: 7, hubId: 'other', purpose: 'step', url: '/uploads/a.jpg' }), /not found/);
  await assert.rejects(drafts.add(db, { shipmentId: 7, hubId: 'hub-1', purpose: 'step', url: 'http://evil/a.jpg' }), /uploaded/);
  await assert.rejects(drafts.add(db, { shipmentId: 7, hubId: 'hub-1', purpose: 'step', url: '/uploads/../a.jpg' }), /uploaded/);
  await assert.rejects(drafts.add(db, { shipmentId: 7, hubId: 'hub-1', purpose: 'other', url: '/uploads/a.jpg' }), /purpose/);
});
