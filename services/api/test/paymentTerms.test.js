const test = require('node:test');
const assert = require('node:assert/strict');
const { readTerm, termText, PAYMENT_TERMS } = require('../src/modules/payouts/terms');

// Supplier payment terms (migration 122): what an admin may save.
test('the 5 payment terms; days only for "days after shipping", 1 to 30', () => {
  assert.equal(PAYMENT_TERMS.length, 5);
  assert.deepEqual(readTerm({ paymentTerm: 'hub_arrival' }), { term: 'hub_arrival', days: null });
  assert.deepEqual(readTerm({ paymentTerm: 'days_after_shipping', paymentTermDays: 10 }), { term: 'days_after_shipping', days: 10 });
  assert.ok(readTerm({ paymentTerm: 'days_after_shipping', paymentTermDays: 0 }).error);
  assert.ok(readTerm({ paymentTerm: 'days_after_shipping', paymentTermDays: 31 }).error);
  assert.ok(readTerm({ paymentTerm: 'days_after_shipping' }).error);
  assert.ok(readTerm({ paymentTerm: 'weekly' }).error);
  assert.equal(termText('days_after_shipping', 1), 'Pay 1 day after shipping');
  assert.equal(termText('after_return_window'), 'Pay after the return window');
});
