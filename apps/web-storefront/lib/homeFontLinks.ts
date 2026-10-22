import type { HomeFont } from "./homeText";

// The fonts an admin can give the home page's headline and sub-headline, and where each comes from. They are NOT built into the site (that needs a download from Google while the site is built, which fails with Next 16's Turbopack when
// Google answers with its newer font addresses, and would stop the whole site from starting): a page that really uses one links to Google Fonts for it, and a page that uses none loads nothing. "default" is the website's own font
// (Outfit in English, IBM Plex Sans Arabic in Arabic): no style and no link.
export const GOOGLE_FONT: Record<Exclude<HomeFont, "default">, { family: string }> = {
  inter: { family: "Inter" }, poppins: { family: "Poppins" }, montserrat: { family: "Montserrat" }, cairo: { family: "Cairo" }, tajawal: { family: "Tajawal" },
};
const WEIGHTS = "500;700";

/** The one stylesheet address that gives the fonts a page really uses (each once), or null when it uses none. */
export function homeFontHref(fonts: Array<HomeFont | undefined>): string | null {
  const used = [...new Set(fonts.filter((f): f is Exclude<HomeFont, "default"> => Boolean(f) && f !== "default" && f! in GOOGLE_FONT))];
  if (used.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${used.map((f) => `family=${encodeURIComponent(GOOGLE_FONT[f].family)}:wght@${WEIGHTS}`).join("&")}&display=swap`;
}
