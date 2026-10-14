// The weight and package size the ADMIN sets for a category (backend migration 103). The shipping cost of every product in the category uses them
// automatically, so the supplier enters none of them. A category that has none yet (null) is the old case: the supplier still enters the product's own.

// { weightKg, lengthCm, widthCm, heightCm } when the category has a complete set, else null.
export function categoryShippingOf(category) {
  if (!category) return null;
  const { weightKg, lengthCm, widthCm, heightCm } = category;
  if ([weightKg, lengthCm, widthCm, heightCm].some((v) => v === null || v === undefined)) return null;
  return { weightKg, lengthCm, widthCm, heightCm };
}

// "5 kg" and "30 × 30 × 5 cm".
export function describeCategoryShipping(shipping) {
  return { weight: `${shipping.weightKg} kg`, size: `${shipping.lengthCm} × ${shipping.widthCm} × ${shipping.heightCm} cm` };
}
