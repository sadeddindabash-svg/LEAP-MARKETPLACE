/** The flags the site can draw faithfully (components/CountryFlag.tsx). Any other country keeps the globe. */
export type FlagCode = "CN" | "JP" | "DE" | "FR" | "IT" | "AE" | "TR" | "VN" | "TH" | "IN" | "US" | "GB";

// A country is recognised by its name in English or Arabic as the supplier's profile has it ("China", "China Warehouse", "الصين"), or by its two-letter code ("CN"). Whole words only ("India" never matches "Indiana").
const NAMES: Array<[FlagCode, RegExp]> = [
  ["CN", /\bchina\b|\bprc\b|الصين/i],
  ["JP", /\bjapan\b|اليابان/i],
  ["DE", /\bgermany\b|\bdeutschland\b|ألمانيا|المانيا/i],
  ["FR", /\bfrance\b|فرنسا/i],
  ["IT", /\bitaly\b|إيطاليا|ايطاليا/i],
  ["AE", /\bunited arab emirates\b|\buae\b|الإمارات|الامارات/i],
  ["TR", /\bturkey\b|\bt[uü]rkiye\b|تركيا/i],
  ["VN", /\bvietnam\b|\bviet nam\b|فيتنام/i],
  ["TH", /\bthailand\b|تايلاند/i],
  ["IN", /\bindia\b|الهند/i],
  ["US", /\bunited states\b|\busa\b|\bu\.s\.a?\b|الولايات المتحدة|أمريكا|امريكا/i],
  ["GB", /\bunited kingdom\b|\bgreat britain\b|\bengland\b|المملكة المتحدة|بريطانيا/i],
];
const CODES = new Set<string>(NAMES.map(([c]) => c));

/** The flag for a supplier's country, given the name(s) the site has for it; null when there is no flag to draw (the globe stays). */
export function flagCodeFor(...names: Array<string | null | undefined>): FlagCode | null {
  for (const raw of names) {
    const name = (raw ?? "").trim();
    if (!name) continue;
    const upper = name.toUpperCase();
    if (CODES.has(upper)) return upper as FlagCode;
    for (const [code, pattern] of NAMES) if (pattern.test(name)) return code;
  }
  return null;
}
