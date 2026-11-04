const test = require('node:test');
const assert = require('node:assert/strict');
const { classify, hubView } = require('../src/modules/parcelCosts/service');

// Parcel shipping costs (migration 127): the +-2% rule, and what the hub may see.
test('within 2% of the planned cost is equal; cheaper is saved; dearer (or no planned cost) is over', () => {
  assert.equal(classify(10, 10), 'equal');
  assert.equal(classify(10, 10.2), 'equal'); assert.equal(classify(10, 9.8), 'equal');      // exactly 2% either way
  assert.equal(classify(10, 10.21), 'over'); assert.equal(classify(10, 9.79), 'saved');
  assert.equal(classify(null, 5), 'over'); assert.equal(classify(0, 5), 'over');
});

test('the hub never sees an amount: only whether it may ship', () => {
  const v = hubView({ state: 'cleared', carrier: 'Aramex', amount: 8.5, amount_usd: 12, planned_usd: 12, admin_note: null });
  assert.deepEqual(v, { state: 'cleared', mayShip: true, carrier: 'Aramex', needsParcelPhoto: false, adminNote: null });
  assert.equal(hubView({ state: 'waiting' }).mayShip, false);
  assert.equal(hubView({ state: 'needs_photo' }).needsParcelPhoto, true);
  assert.equal(hubView({ state: 'sent_back', admin_note: 'wrong carrier' }).adminNote, 'wrong carrier');
  assert.deepEqual(hubView(null), { state: 'missing', mayShip: false });
});
