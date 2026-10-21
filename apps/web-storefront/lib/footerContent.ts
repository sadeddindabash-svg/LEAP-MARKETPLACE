import type { Lang } from "./i18n";

// The footer and the six pages, as the admin sets them (admin portal, Settings). The keys and addresses must match services/api/src/modules/platform-settings/footer.js.
export const PAGE_KEYS = ["about", "terms", "delivery", "refund", "privacy", "cancellation"] as const;
export type PageKey = (typeof PAGE_KEYS)[number];
/** The address of each page on the storefront (the same as on the old website; the privacy page's old, misspelled address redirects to its own). */
export const PAGE_SLUGS: Record<PageKey, string> = { about: "about-us", terms: "terms-conditions", delivery: "delivery-shipping-policy", refund: "refund-policy", privacy: "privacy-policy", cancellation: "cancellation-replacement-policy" };
export interface Pair { en: string | null; ar: string | null }
export type TitleKey = "shop" | "account" | "help" | "useful";
export interface SocialLink { id: string; name: string; url: string | null; icon: string | null }
export interface FooterContent {
  text: { tagline: Pair; copyright: Pair; titles: Record<TitleKey, Pair>; links: Record<PageKey, Pair & { shown: boolean }> };
  social: SocialLink[];
  /** Which of the six pages have text yet (a page without text is still on the old website). */
  pages: Record<PageKey, boolean>;
}
export interface LegalPageDto { key: PageKey; slug: string; title: Pair; body: Pair; updatedAt: string | null; hasContent: boolean }

/** The copyright line with {year} filled in; the website's own line when the admin has not set one. */
export function formatCopyright(pair: Pair | null | undefined, lang: Lang, year: number, fallback: string): string {
  const value = lang === "ar" ? pair?.ar : pair?.en;
  return typeof value === "string" && value.trim() !== "" ? value.replace(/\{year\}/g, String(year)) : fallback;
}
/** A page's text in the visitor's language; if there is none in that language, the other one (a page in the wrong language is better than an empty one). */
export function pageText(pair: Pair | null | undefined, lang: Lang): string {
  const own = lang === "ar" ? pair?.ar : pair?.en; const other = lang === "ar" ? pair?.en : pair?.ar;
  return (typeof own === "string" && own.trim() !== "" ? own : typeof other === "string" ? other : "") || "";
}
