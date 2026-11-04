const test = require('node:test');
const assert = require('node:assert/strict');
const { checklistFor, gapsOf } = require('../src/modules/inspection/service');

// The inspection list (migration 129): the same lines for the hub portal and the hub app, and what stops "Confirm Inspected".
test('the list: part, OEM, position, each spec, and the condition line', () => {
  const list = checklistFor({ part: 'Brake pads', oemNumber: '04465-33471', position: 'Front', attributes: [{ name: 'Material', value: 'Ceramic' }] });
  assert.deepEqual(list.map((c) => c.key), ['part', 'oem', 'position', 'attr:Material', 'condition']);
  assert.equal(list[0].en, 'Part: Brake pads'); assert.equal(list[0].zh, '配件：Brake pads');
  // a "Position" spec is not shown twice; empty values are left out
  const two = checklistFor({ part: '', oemNumber: null, position: 'Front', attributes: [{ name: 'Position', value: 'Front left' }, { name: 'Colour', value: '' }] });
  assert.deepEqual(two.map((c) => c.key), ['attr:Position', 'condition']);
});

test('what is still missing: ticks, the received quantity, a different quantity', () => {
  const list = checklistFor({ part: 'Oil filter', attributes: [] });
  const item = (over) => ({ productId: 'p1', name: 'Oil filter', quantity: 2, receivedQuantity: 2, checklist: list, checkedKeys: ['part', 'condition'], ...over });
  assert.deepEqual(gapsOf([item()]), []);
  assert.equal(gapsOf([item({ checkedKeys: ['part'] })])[0].missingChecks, 1);
  assert.equal(gapsOf([item({ receivedQuantity: null })])[0].missingQuantity, true);
  assert.deepEqual(gapsOf([item({ receivedQuantity: 1 })])[0].mismatch, { ordered: 2, received: 1 });
});
