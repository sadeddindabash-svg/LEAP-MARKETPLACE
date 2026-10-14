// The weight and package size the ADMIN sets for a PART (the sub-category, e.g. "Front Brake Disc" under "Brake System"; backend migration 104). The shipping cost
// of every product with that part uses them automatically, so the supplier enters none of them. A part that has none yet (null) is the old case: the supplier
// still enters the product's own.

// { weightKg, lengthCm, widthCm, heightCm } when the part has a complete set, else null.
export function partShippingOf(part) {
  if (!part) return null;
  const { weightKg, lengthCm, widthCm, heightCm } = part;
  if ([weightKg, lengthCm, widthCm, heightCm].some((v) => v === null || v === undefined)) return null;
  return { weightKg, lengthCm, widthCm, heightCm };
}
