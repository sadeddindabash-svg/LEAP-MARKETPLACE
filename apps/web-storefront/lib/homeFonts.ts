import type { HomeFont } from "./homeText";
import { GOOGLE_FONT } from "./homeFontLinks";

/** The inline style for a chosen font (Arabic letters fall back to the website's Arabic font for the Latin-only fonts), or nothing for the default. The font itself is linked by components/HomeFontLink.tsx. */
export function homeFontStyle(font: HomeFont | undefined): { fontFamily: string } | undefined {
  if (!font || font === "default" || !(font in GOOGLE_FONT)) return undefined;
  return { fontFamily: `"${GOOGLE_FONT[font].family}", var(--font-arabic), sans-serif` };
}
