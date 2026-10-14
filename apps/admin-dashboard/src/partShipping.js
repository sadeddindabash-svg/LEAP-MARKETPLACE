// The weight and package size of a PART (the sub-category, e.g. "Front Brake Disc" under "Brake System"), set by the admin and used automatically in the shipping cost of every
// product with that part (backend migration 104).
// Four numbers, each above zero, always together.
export const SHIPPING_FIELDS = [
  { key: "weightKg", label: "Weight (kg)" },
  { key: "lengthCm", label: "Length (cm)" },
  { key: "widthCm", label: "Width (cm)" },
  { key: "heightCm", label: "Height (cm)" },
];

export const emptyShipping = () => ({ weightKg: "", lengthCm: "", widthCm: "", heightCm: "" });

// True when none of the four has anything in it (a category edited by name only).
export const isShippingEmpty = (values) => SHIPPING_FIELDS.every(({ key }) => String(values?.[key] ?? "").trim() === "");

// Checks what the admin typed. Returns { error } or { values: { weightKg, lengthCm, widthCm, heightCm } } as numbers.
// Numbers typed with Arabic digits are accepted too (the admin team types in both).
export function parseShipping(values) {
  const out = {};
  for (const { key, label } of SHIPPING_FIELDS) {
    const text = toEnglishDigits(String(values?.[key] ?? "")).trim().replace(",", ".");
    if (text === "") return { error: `${label} is required.` };
    const n = Number(text);
    if (!Number.isFinite(n) || n <= 0) return { error: `${label} must be a number above zero.` };
    out[key] = n;
  }
  return { values: out };
}

const toEnglishDigits = (text) => text
  .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
  .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));

// How a part's set reads at the end of its row: { weight: "5 kg", size: "30 × 30 × 5 cm" }, or null when it has none yet.
export function describeShipping(part) {
  const { weightKg, lengthCm, widthCm, heightCm } = part || {};
  if ([weightKg, lengthCm, widthCm, heightCm].some((v) => v === null || v === undefined)) return null;
  return { weight: `${weightKg} kg`, size: `${lengthCm} × ${widthCm} × ${heightCm} cm` };
}
