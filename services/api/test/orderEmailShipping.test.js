// The order confirmation email shows the shipping fee on its own line (English and Arabic) when one was charged; the Total already includes it. Pure: no database.
//   node --test test/orderEmailShipping.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { orderConfirmationEmail } = require('../src/modules/email/templates');

const base = { recipientName: 'Sam', orderId: 'LP-1', items: [{ name: 'Brake disc', quantity: 1, price: 20 }], total: 25, currencyCode: 'USD' };
test('a fee is its own line before the Total, in the html and in the plain text (English)', () => {
  const { html, text } = orderConfirmationEmail({ ...base, shippingFee: 5, lang: 'en' });
  assert.ok(html.includes('Shipping fees: +5.00 USD'), html); assert.ok(html.indexOf('Shipping fees') < html.indexOf('Total: 25.00 USD'), 'the fee comes before the total');
  assert.match(text, /Shipping fees: \+5\.00 USD\. Total: 25\.00 USD/);
});
test('the same in Arabic', () => {
  const { html, text } = orderConfirmationEmail({ ...base, shippingFee: 5, lang: 'ar' });
  assert.ok(html.includes('رسوم الشحن: +5.00 USD'), html); assert.ok(html.indexOf('رسوم الشحن') < html.indexOf('الإجمالي: 25.00 USD'));
  assert.ok(text.includes('رسوم الشحن: +5.00 USD. الإجمالي: 25.00 USD'), text);
});
test('no fee (0, nothing, or a bad value) means no shipping line at all: the email is as it always was', () => {
  for (const shippingFee of [0, undefined, null, -3, 'abc', NaN]) {
    const { html, text } = orderConfirmationEmail({ ...base, total: 20, shippingFee, lang: 'en' });
    assert.ok(!html.includes('Shipping fees'), String(shippingFee)); assert.ok(!text.includes('Shipping fees')); assert.ok(html.includes('Total: 20.00 USD'));
  }
});
