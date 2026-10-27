import { t, pickName, type Lang } from "./i18n";
import type { FitGroup, ProductDetail } from "./api";

/** The years of one model as the server grouped them: [[2022, 2024], [2026, 2026]] reads "2022–2024, 2026". */
export function formatRanges(ranges: Array<[number, number]>): string {
  return ranges.map(([from, to]) => (from === to ? String(from) : `${from}–${to}`)).join(", ");
}

/** "BYD Seal", with the Arabic names when the page is Arabic and they exist. */
export function fitGroupName(lang: Lang, g: Pick<FitGroup, "brand" | "brandAr" | "model" | "modelAr">): string {
  return [pickName(lang, g.brand, g.brandAr), pickName(lang, g.model, g.modelAr)].filter(Boolean).join(" ");
}

/**
 * The chip at the top of a product page. A part that fits several models: its first model and years and how many more models ("FITS BYD Seal 2022–2024 +4 more models"); a part with no fitment at all says it fits every vehicle;
 * from an older server (no groups) it is the single car the page always showed ("FITS 2022 BYD Seal"). null: nothing to show.
 */
export function fitChipText(lang: Lang, p: Pick<ProductDetail, "brand" | "model" | "year" | "fitGroups" | "fitGroupCount">): string | null {
  if (p.fitGroups) {
    if (p.fitGroups.length === 0) return t(lang, "fits_universal_chip");
    const first = p.fitGroups[0];
    const more = Math.max((p.fitGroupCount ?? p.fitGroups.length) - 1, 0);
    const moreText = more === 0 ? "" : ` ${more === 1 ? t(lang, "fits_chip_more_one") : t(lang, "fits_chip_more", { n: more })}`;
    return `${t(lang, "fits_label")} ${fitGroupName(lang, first)} ${formatRanges(first.ranges)}${moreText}`;
  }
  if (!p.brand) return null;
  return `${t(lang, "fits_label")} ${p.year ? `${p.year} ` : ""}${p.brand} ${p.model || ""}`;
}
