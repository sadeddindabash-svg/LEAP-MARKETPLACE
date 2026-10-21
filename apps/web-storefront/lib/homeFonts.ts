import { Cairo, Inter, Montserrat, Poppins, Tajawal } from "next/font/google";
import type { HomeFont } from "./homeText";

// The fonts an admin can give the home page's headline and sub-headline. preload is OFF for all of them: a font is only downloaded by a visitor whose page really uses it, so choosing one
// costs nothing for the pages that do not. "default" is the website's own font (Outfit in English, IBM Plex Sans Arabic in Arabic): no style is added.
const inter = Inter({ subsets: ["latin"], weight: ["500", "700"], display: "swap", preload: false });
const poppins = Poppins({ subsets: ["latin"], weight: ["500", "700"], display: "swap", preload: false });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["500", "700"], display: "swap", preload: false });
const cairo = Cairo({ subsets: ["arabic", "latin"], weight: ["500", "700"], display: "swap", preload: false });
const tajawal = Tajawal({ subsets: ["arabic", "latin"], weight: ["500", "700"], display: "swap", preload: false });

const FAMILY: Record<Exclude<HomeFont, "default">, string> = { inter: inter.style.fontFamily, poppins: poppins.style.fontFamily, montserrat: montserrat.style.fontFamily, cairo: cairo.style.fontFamily, tajawal: tajawal.style.fontFamily };
/** The inline style for a chosen font (Arabic letters fall back to the website's Arabic font for the Latin-only fonts), or nothing for the default. */
export function homeFontStyle(font: HomeFont | undefined): { fontFamily: string } | undefined {
  if (!font || font === "default") return undefined;
  return { fontFamily: `${FAMILY[font]}, var(--font-arabic), sans-serif` };
}
