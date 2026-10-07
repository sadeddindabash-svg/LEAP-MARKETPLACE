// What a receipt shows for a free REPLACEMENT order (migration 095).
//
// A replacement's lines keep the ORIGINAL unit prices, because that is how the supplier gets paid for the unit the buyer finally receives; the buyer
// paid nothing for it and must never be shown those prices (the order page already hides them). The receipt used to list them next to a total of $0.00.
// An admin still sees the real figures.

function receiptItemsFor({ order, isAdmin, items }) {
  if (order.replacement_of && !isAdmin) return items.map((i) => ({ ...i, unit_price: 0 }));
  return items;
}

function receiptTitleFor({ order, isAr, defaultTitle, shapeArabic }) {
  if (!order.replacement_of) return defaultTitle;
  return isAr ? shapeArabic('إيصال طلب بديل مجاني') : 'Replacement order receipt (no charge)';
}

module.exports = { receiptItemsFor, receiptTitleFor };
