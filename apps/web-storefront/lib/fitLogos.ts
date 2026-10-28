import { pickName, type Lang } from "./i18n";
import type { ProductDetail } from "./api";

export interface FitLogo { name: string; url: string }

/** How many brand logos the chip shows before "+N". */
export const MAX_FIT_LOGOS = 3;

/**
 * The brand logos for the "FITS ..." chip on a product page: one per DIFFERENT brand the part fits, in the order the supplier added them (a brand without a logo is skipped), at most [max], and how many other brands there are ("+2").
 * From an older server (no groups) it is the single logo of the first car, when it has one. A part with no fitment at all (universal) has none.
 */
export function fitBrandLogos(p: Pick<ProductDetail, "fitGroups" | "brand" | "brandLogoUrl">, lang: Lang, max = MAX_FIT_LOGOS): { shown: FitLogo[]; extra: number } {
  if (!p.fitGroups) return p.brandLogoUrl && p.brand ? { shown: [{ name: p.brand, url: p.brandLogoUrl }], extra: 0 } : { shown: [], extra: 0 };
  const seen = new Set<string>();
  const brands: Array<{ key: string; name: string; url: string | null }> = [];
  for (const g of p.fitGroups) {
    const key = g.brand.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    brands.push({ key, name: pickName(lang, g.brand, g.brandAr), url: g.brandLogoUrl || null });
  }
  const withLogo = brands.filter((b) => b.url);
  const shown = withLogo.slice(0, max).map((b) => ({ name: b.name, url: b.url as string }));
  return { shown, extra: Math.max(brands.length - shown.length, 0) };
}
