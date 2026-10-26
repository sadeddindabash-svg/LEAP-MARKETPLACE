// The discount shown beside a price: only when the server sends an original price that is really higher than the price. The percentage is rounded, and a difference that rounds to 0% is not shown as a discount.
export function discountPercent(price: number, original: number | null | undefined): number | null {
  if (original == null || !Number.isFinite(original) || !Number.isFinite(price) || !(original > price)) return null;
  const percent = Math.round(((original - price) / original) * 100);
  return percent >= 1 ? percent : null;
}
/** The colour of the "-N% off" tag: the bigger the discount, the stronger the colour. */
export function discountTierClasses(percent: number): string {
  if (percent >= 30) return "bg-red-100 text-red-800";
  if (percent >= 15) return "bg-orange-100 text-orange-900";
  return "bg-amber-100 text-amber-900";
}
