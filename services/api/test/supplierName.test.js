// The supplier's product name rule by language (src/modules/shared/productValidation.js). No database needed.
const test = require('node:test');
const assert = require('node:assert');
const { validateSupplierName, nameLanguageOf, supplierNameMinimums } = require('../src/modules/shared/productValidation');

const MIN = { en: 15, zh: 5, ar: 15 };
test('the language is found from the name', () => {
  assert.strictEqual(nameLanguageOf('前刹车盘 300mm'), 'zh');
  assert.strictEqual(nameLanguageOf('قرص فرامل أمامي'), 'ar');
  assert.strictEqual(nameLanguageOf('Front Brake Disc'), 'en');
});
test('English: at least 15 characters, spaces and digits count', () => {
  assert.strictEqual(validateSupplierName('Front Brake Disc', 'itemName', MIN), null);             // 16
  assert.match(validateSupplierName('Brake Disc 30', 'itemName', MIN), /in English must be at least 15 characters \(got 13\)/);
});
test('Chinese: at least 5 characters', () => {
  assert.strictEqual(validateSupplierName('前刹车盘总成', 'itemName', MIN), null);
  assert.match(validateSupplierName('刹车盘', 'itemName', MIN), /in Chinese must be at least 5 characters \(got 3\)/);
});
test('Arabic: at least 15 characters', () => {
  assert.strictEqual(validateSupplierName('قرص فرامل أمامي كامل', 'itemName', MIN), null);
  assert.match(validateSupplierName('قرص فرامل', 'itemName', MIN), /in Arabic must be at least 15/);
});
test('at most 100 characters, whatever the language', () => {
  assert.match(validateSupplierName('x'.repeat(101), 'nameZh', MIN), /at most 100/);
});
test('the admin numbers are used; missing or broken ones fall back to 15 / 5 / 15', () => {
  assert.deepStrictEqual(supplierNameMinimums({ name_min_en: 20, name_min_zh: 8, name_min_ar: 12 }), { en: 20, zh: 8, ar: 12 });
  assert.deepStrictEqual(supplierNameMinimums({}), { en: 15, zh: 5, ar: 15 });
  assert.deepStrictEqual(supplierNameMinimums(undefined), { en: 15, zh: 5, ar: 15 });
  assert.match(validateSupplierName('刹车盘总成', 'nameZh', supplierNameMinimums({ name_min_zh: 8 })), /at least 8/);
});
