// The supplier's own price. A supplier enters their price in RMB (yuan); the buyer's price is calculated from it by the pricing engine. The supplier portal shows, and the supplier is paid, THIS price (x quantity).
// A product that is not priced in RMB has no RMB price: null, never a guess.
function supplierUnitPriceCny(product) {
  if (!product || product.currency_code !== 'CNY') return null;
  if (product.price === null || product.price === undefined || product.price === '') return null;      // no price is no price, not 0
  const n = Number(product.price);
  return Number.isFinite(n) && n >= 0 ? Number(n.toFixed(2)) : null;
}

module.exports = { supplierUnitPriceCny };
