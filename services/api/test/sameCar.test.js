// One product per supplier + OE number + car (src/modules/supplier/sameCar.js), with a stand-in database.
const test = require('node:test');
const assert = require('node:assert');
const { oeKey, findSameCarProducts } = require('../src/modules/supplier/sameCar');

const fakeDb = (rows) => ({ query: async (sql, params) => ({ rows: rows.filter((r) => params[1].includes(r.k)) }) });

test('OE numbers ignore spaces at the ends and letter case, but not dashes', () => {
  assert.strictEqual(oeKey(' bi-1 '), 'BI-1');
  assert.notStrictEqual(oeKey('BI-1'), oeKey('BI1'));
});
test('the same car with all versions finds the product; a narrowed product is another car', async () => {
  const db = fakeDb([{ id: 'p1', k: 'BI-1', versions: [] }, { id: 'p2', k: 'BI-1', versions: ['v1'] }]);
  assert.deepStrictEqual([...(await findSameCarProducts(db, 's1', ['bi-1'], 'g1', 2021, [])).entries()], [['BI-1', ['p1']]]);
});
test('the same set of versions, in any order, is the same car; another set is another car', async () => {
  const db = fakeDb([{ id: 'p2', k: 'BI-1', versions: ['v2', 'v1'] }]);
  assert.deepStrictEqual([...(await findSameCarProducts(db, 's1', ['BI-1'], 'g1', 2021, ['v1', 'v2'])).keys()], ['BI-1']);
  assert.strictEqual((await findSameCarProducts(db, 's1', ['BI-1'], 'g1', 2021, ['v1'])).size, 0);
  assert.strictEqual((await findSameCarProducts(db, 's1', ['BI-1'], 'g1', 2021, [])).size, 0);
});
test('nothing to look for: nothing found', async () => {
  assert.strictEqual((await findSameCarProducts(fakeDb([]), 's1', [], 'g1', 2021, [])).size, 0);
  assert.strictEqual((await findSameCarProducts(fakeDb([]), 's1', ['X'], null, 2021, [])).size, 0);
});
