// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { receiptItemsFor, receiptTitleFor } = require('../../../services/api/src/modules/order/receiptHelpers.js');

const ITEMS = [{ quantity: 2, unit_price: '34.90', name: 'Brake disc', name_ar: null }, { quantity: 1, unit_price: '12.00', name: 'Pads', name_ar: null }];
const NORMAL = { id: 'LP-200934', replacement_of: null, total: '81.80' };
const REPLACEMENT = { id: 'LP-200934-R1', replacement_of: 'LP-200934', total: '0.00' };
const shapeArabic = (text) => `[shaped]${text}`;

describe('what a receipt shows for a free replacement order', () => {
  it('CRITICAL: the BUYER never sees the replacement\'s prices (they are kept only so the supplier can be paid), and the real list is not altered', () => {
    const shown = receiptItemsFor({ order: REPLACEMENT, isAdmin: false, items: ITEMS });
    expect(shown.map((i) => Number(i.unit_price))).toEqual([0, 0]);
    expect(shown.map((i) => i.quantity)).toEqual([2, 1]);          // quantities and names are untouched
    expect(shown.map((i) => i.name)).toEqual(['Brake disc', 'Pads']);
    expect(ITEMS.map((i) => Number(i.unit_price))).toEqual([34.9, 12]); // the input was not mutated
  });

  it('an ADMIN still sees the real figures, and an ordinary order is untouched for everyone', () => {
    expect(receiptItemsFor({ order: REPLACEMENT, isAdmin: true, items: ITEMS })).toBe(ITEMS);
    expect(receiptItemsFor({ order: NORMAL, isAdmin: false, items: ITEMS })).toBe(ITEMS);
    expect(receiptItemsFor({ order: NORMAL, isAdmin: true, items: ITEMS })).toBe(ITEMS);
  });

  it('a replacement\'s receipt says what it is, in English and Arabic; an ordinary one keeps its normal title', () => {
    expect(receiptTitleFor({ order: REPLACEMENT, isAr: false, defaultTitle: 'Order receipt', shapeArabic })).toBe('Replacement order receipt (no charge)');
    expect(receiptTitleFor({ order: REPLACEMENT, isAr: true, defaultTitle: '[shaped]إيصال الطلب', shapeArabic })).toBe('[shaped]إيصال طلب بديل مجاني');
    expect(receiptTitleFor({ order: NORMAL, isAr: false, defaultTitle: 'Order receipt', shapeArabic })).toBe('Order receipt');
    expect(receiptTitleFor({ order: NORMAL, isAr: true, defaultTitle: '[shaped]إيصال الطلب', shapeArabic })).toBe('[shaped]إيصال الطلب');
  });
});
