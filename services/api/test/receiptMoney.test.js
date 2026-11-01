const test = require('node:test');
const assert = require('node:assert/strict');
const { moneyFormatter } = require('../src/modules/order/receiptPdf');

// The receipt shows the buyer's currency (migration 123).
test('amounts in the buyer\'s currency, English and Arabic', () => {
  assert.equal(moneyFormatter({ code: 'SAR', rate: 3.75 }, false)(100), 'SAR 375.00');
  assert.equal(moneyFormatter({ code: 'SAR', rate: 3.75 }, true)(100), '375.00 ر.س');
  assert.equal(moneyFormatter({ code: 'USD', rate: 1 }, false)(12.5), '$12.50');
  assert.equal(moneyFormatter({ code: 'KWD', rate: 0.307 }, false)(10), 'KWD 3.070');
});
