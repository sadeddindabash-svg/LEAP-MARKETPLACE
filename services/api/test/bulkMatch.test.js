// Bulk upload: the category and part class found from the item name (src/modules/supplier/bulkMatch.js). No database needed.
const test = require('node:test');
const assert = require('node:assert');
const { matchName, positionFromPartName } = require('../src/modules/supplier/bulkMatch');

const PARTS = [
  { categoryId: 'brake', nameEn: 'Front Brake Disc', nameZh: '前刹车盘' },
  { categoryId: 'brake', nameEn: 'Rear Brake Disc', nameZh: '后刹车盘' },
  { categoryId: 'brake', nameEn: 'Brake Disc', nameZh: '刹车盘' },
  { categoryId: 'brake', nameEn: 'Rear Brake Pad Set', nameZh: '后刹车片' },
  { categoryId: 'engine', nameEn: 'Oil Filter', nameZh: '机油滤清器' },
  { categoryId: 'lights', nameEn: 'Headlight Left', nameZh: '大灯总成' },
  { categoryId: 'body', nameEn: 'Headlight Trim', nameZh: '大灯总成' },
];

test('a Chinese name finds its part; the longest matching name wins', () => {
  assert.deepStrictEqual(matchName('前刹车盘 300mm', PARTS), { state: 'found', category: 'brake', part: 'Front Brake Disc', candidates: [] });
  assert.strictEqual(matchName('刹车盘 通用', PARTS).part, 'Brake Disc');
  assert.strictEqual(matchName('后刹车片 陶瓷', PARTS).part, 'Rear Brake Pad Set');
});
test('an English name finds its part, whatever the case, spaces or dashes', () => {
  assert.strictEqual(matchName('FRONT-BRAKE  disc 312mm', PARTS).part, 'Front Brake Disc');
  assert.strictEqual(matchName('oil filter (OEM)', PARTS).category, 'engine');
});
test('two parts with the same best match: the supplier chooses', () => {
  const r = matchName('大灯总成 左', PARTS);
  assert.strictEqual(r.state, 'many');
  assert.deepStrictEqual(r.candidates.map((c) => c.category).sort(), ['body', 'lights']);
});
test('no part in the name: nothing is guessed', () => {
  assert.deepStrictEqual(matchName('装饰条', PARTS), { state: 'none', category: null, part: null, candidates: [] });
  assert.strictEqual(matchName('', PARTS).state, 'none');
});
test('the position comes from the part name only when it says so', () => {
  assert.strictEqual(positionFromPartName('Front Brake Disc'), 'Front');
  assert.strictEqual(positionFromPartName('Rear Left Lamp'), 'Rear-Left');
  assert.strictEqual(positionFromPartName('Rear-Right Mirror'), 'Rear-Right');
  assert.strictEqual(positionFromPartName('Oil Filter'), null);
  assert.strictEqual(positionFromPartName('Frontier Cap'), null);
});
