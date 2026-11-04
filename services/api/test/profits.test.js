const test = require('node:test');
const assert = require('node:assert/strict');
const { startOf, step, label, totalsOf, toPart } = require('../src/modules/profits/service');

// Financial -> Profits: the periods (Riyadh time, weeks Saturday to Friday) and the formula (src/modules/profits/service.js).
const d = (s) => new Date(`${s}T00:00:00Z`);
const day = (x) => x.toISOString().slice(0, 10);

test('a week runs Saturday to Friday; months, quarters and years are calendar ones', () => {
  assert.equal(day(startOf('week', d('2026-11-10'))), '2026-11-07');           // a Tuesday -> the Saturday before
  assert.equal(day(startOf('week', d('2026-11-07'))), '2026-11-07');           // a Saturday is the first day
  assert.equal(day(startOf('week', d('2026-11-13'))), '2026-11-07');           // a Friday is the last
  assert.equal(day(step('week', d('2026-11-07'))), '2026-11-14');
  assert.equal(label('week', d('2026-11-07')), 'Sat 7 Nov – Fri 13 Nov 2026');
  assert.equal(day(startOf('quarter', d('2026-11-10'))), '2026-10-01');
  assert.equal(label('quarter', d('2026-10-01')), 'Q4 2026');
  assert.equal(day(step('quarter', d('2026-10-01'))), '2027-01-01');
  assert.equal(day(step('month', d('2026-01-01'), -1)), '2025-12-01');
  assert.equal(label('month', d('2026-11-01')), 'November 2026');
  assert.equal(label('day', d('2026-11-10')), 'Tue 10 Nov 2026');
});

const row = (over) => ({ sub_order_id: 1, order_id: 'A', root_order_id: 'A', lost_reason: null, returned: false, sales: 100, supplier_cny: 400, rate: 0.14,
  shipping_fee: 10, discount_amount: 5, order_goods: 200, delivered_local: '2026-11-03T13:00:00', final_local: '2026-11-10T13:00:00', ...over });

test('the formula: sales - supplier pay (at the order\'s rate) + its share of shipping - its share of the discount - refunds - fault costs', () => {
  const part = toPart(row());
  assert.equal(part.supplierPay.toFixed(2), '56.00');                          // 400 yuan x 0.14
  assert.equal(part.shipping, 5); assert.equal(part.discount, 2.5);           // half the order's goods: half its shipping and discount
  const returned = toPart(row({ sub_order_id: 2, order_id: 'B', root_order_id: 'B', returned: true, lost_reason: 'returned by the buyer', sales: 60, supplier_cny: 200, rate: 0.15, shipping_fee: 0, discount_amount: 0, order_goods: 60 }));
  assert.equal(returned.supplierPay, 0); assert.equal(returned.refund, 60);    // a returned part: the supplier is not paid, the buyer gets the money back
  const t = totalsOf([part, returned], [{ cost: 14 }]);
  assert.deepEqual(t, { sales: 160, supplierPay: 56, shippingPlanned: 0, partsProfit: 104, shippingResult: 0, shippingSaved: { parcels: 0, usd: 0 }, shippingOver: { parcels: 0, usd: 0 }, parcelsWithoutCost: 0,
    shipping: 5, discounts: 2.5, refunds: 60, faultCosts: 14, netProfit: 32.5, margin: 20, orders: 2 });
});

test('a replacement counts for the order the buyer paid for; nothing at all gives no margin', () => {
  const t = totalsOf([toPart(row({ order_id: 'A-R1', root_order_id: 'A' })), toPart(row({ sub_order_id: 3 }))], []);
  assert.equal(t.orders, 1);
  assert.equal(totalsOf([], []).margin, null);
});


test('real shipping (migration 127): the planned shipping comes out of the parts profit, and planned - paid is the shipping result', () => {
  const saved = toPart(row({ ship_planned_lines: 12, ship_planned_parcel: 12, ship_paid: 9, ship_state: 'cleared', ship_result: 'saved', shipped: true }));
  const over = toPart(row({ sub_order_id: 2, ship_planned_lines: 10, ship_planned_parcel: 10, ship_paid: 13, ship_state: 'approved', ship_result: 'over', shipped: true }));
  const waiting = toPart(row({ sub_order_id: 3, ship_planned_lines: 8, ship_planned_parcel: 8, ship_paid: 20, ship_state: 'waiting', ship_result: 'over', shipped: true }));
  const old = toPart(row({ sub_order_id: 4, ship_planned_lines: 0, shipped: true }));
  const t = totalsOf([saved, over, waiting, old], []);
  assert.equal(t.shippingPlanned, 30);                         // 12 + 10 + 8 (the waiting one: as planned until it is decided)
  assert.equal(t.shippingResult, 0);                           // +3 saved, -3 over
  assert.deepEqual(t.shippingSaved, { parcels: 1, usd: 3 }); assert.deepEqual(t.shippingOver, { parcels: 1, usd: 3 });
  assert.equal(t.parcelsWithoutCost, 2);
  assert.equal(t.partsProfit, r(4 * 100 - 4 * 56 - 30));
  assert.equal(t.netProfit, r(t.partsProfit + t.shippingResult + t.shipping - t.discounts));
});
const r = (n) => Math.round(n * 100) / 100;
