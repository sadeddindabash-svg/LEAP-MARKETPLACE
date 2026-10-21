import type { Lang } from "./i18n";

// The editable texts of the home page (set in the admin portal, Settings -> "Home page text"): the top bar message, the headline and the sub-headline, in English and Arabic; the headline and the
// sub-headline also have a FONT and a SIZE. An empty text means "use the website's own wording". The lists below must match services/api/src/modules/platform-settings/homeText.js.
export const HOME_FONTS = ["default", "inter", "poppins", "montserrat", "cairo", "tajawal"] as const;
export const HOME_SIZES = ["small", "medium", "large", "xlarge"] as const;
export type HomeFont = (typeof HOME_FONTS)[number];
export type HomeSize = (typeof HOME_SIZES)[number];
export interface HomeTextPair { en: string | null; ar: string | null }
export interface HomeTextBlock extends HomeTextPair { font: HomeFont; size: HomeSize }
export interface HomeText { topBar: HomeTextPair; headline: HomeTextBlock; subheadline: HomeTextBlock }

/** The text sizes: each steps down by itself on a narrower screen. "large" (headline) and "medium" (sub-headline) are what the website had before the sizes could be chosen. */
export const HEADLINE_SIZE_CLASS: Record<HomeSize, string> = {
  small: "text-[clamp(26px,3.4vw,40px)]", medium: "text-[clamp(30px,4vw,48px)]", large: "text-[clamp(34px,4.6vw,56px)]", xlarge: "text-[clamp(40px,5.6vw,68px)]",
};
export const SUBHEADLINE_SIZE_CLASS: Record<HomeSize, string> = { small: "text-base", medium: "text-lg", large: "text-xl", xlarge: "text-2xl" };

/** The admin's text for this language, or the website's own wording when there is none. */
export function pickHomeText(pair: HomeTextPair | null | undefined, lang: Lang, fallback: string): string {
  const value = lang === "ar" ? pair?.ar : pair?.en;
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}
