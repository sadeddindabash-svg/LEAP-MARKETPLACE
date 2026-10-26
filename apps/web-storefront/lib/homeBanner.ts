import type { Lang } from "./i18n";

// The home page banner as the server sends it (services/api/src/modules/platform-settings/homeBanner.js): which of the headline / the banner to show, and the slides.
export interface BannerSlide {
  id: string;
  imageEn: string | null;
  imageAr: string | null;
  altEn: string;
  altAr: string;
  link: { type: "none" | "part" | "category" | "url"; value: string };
  seconds: number;
}
export interface HomeBanner { mode: "headline" | "banner"; slides: BannerSlide[]; width: number; height: number }
/** One slide as the carousel draws it: the photo for the visitor's language, its description, where it leads, and how long it stays. */
export interface ViewSlide { id: string; src: string; alt: string; href: string | null; external: boolean; seconds: number }

export const MIN_SECONDS = 2;
export const MAX_SECONDS = 30;
export const DEFAULT_SECONDS = 5;

/** The photo for the language, and the other language's photo when this one is missing (an ad is never left blank because only one language was uploaded). */
export function slideImage(slide: Pick<BannerSlide, "imageEn" | "imageAr">, lang: Lang): string | null {
  const first = lang === "ar" ? slide.imageAr : slide.imageEn;
  const second = lang === "ar" ? slide.imageEn : slide.imageAr;
  return (first && first.trim()) || (second && second.trim()) || null;
}
/** The description of the photo for the language (the other language's when this one is empty; "" when neither has one, which marks the photo as decoration). */
export function slideAlt(slide: Pick<BannerSlide, "altEn" | "altAr">, lang: Lang): string {
  const first = lang === "ar" ? slide.altAr : slide.altEn;
  const second = lang === "ar" ? slide.altEn : slide.altAr;
  return (first && first.trim()) || (second && second.trim()) || "";
}
/** Where a slide leads: a part page, a category's search, or a web page (opened in a new tab). Nothing for "no link", and nothing for an address that is not http(s) (never a script). */
export function slideLink(link: BannerSlide["link"] | null | undefined): { href: string; external: boolean } | null {
  if (!link || typeof link.value !== "string" || link.value.trim() === "") return null;
  const value = link.value.trim();
  if (link.type === "part") return { href: `/products/${encodeURIComponent(value)}`, external: false };
  if (link.type === "category") return { href: `/search?category=${encodeURIComponent(value)}`, external: false };
  if (link.type === "url") { try { const u = new URL(value); return u.protocol === "https:" || u.protocol === "http:" ? { href: value, external: true } : null; } catch { return null; } }
  return null;
}
/** How long a slide stays, in seconds: whole seconds from 2 to 30 (anything else is brought into that range). */
export const slideSeconds = (seconds: number): number => { const n = Math.round(Number(seconds)); return Number.isFinite(n) ? Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, n)) : DEFAULT_SECONDS; };

/** The slides to draw for a language: those with a usable photo, in the admin's order, photo addresses made absolute by `resolve`. */
export function viewSlides(banner: Pick<HomeBanner, "slides"> | null | undefined, lang: Lang, resolve: (url: string) => string): ViewSlide[] {
  const out: ViewSlide[] = [];
  for (const slide of banner?.slides ?? []) {
    const image = slideImage(slide, lang);
    if (!image) continue;
    const link = slideLink(slide.link);
    out.push({ id: slide.id, src: resolve(image), alt: slideAlt(slide, lang), href: link ? link.href : null, external: link ? link.external : false, seconds: slideSeconds(slide.seconds) });
  }
  return out;
}
