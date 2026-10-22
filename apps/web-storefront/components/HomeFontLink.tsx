import type { HomeFont } from "@/lib/homeText";
import { homeFontHref } from "@/lib/homeFontLinks";

/** Links the page to Google Fonts for the home page fonts it really uses (nothing at all when it uses the website's own font). display=swap: the text shows at once in the website's font and changes when the chosen one has arrived. */
export default function HomeFontLink({ fonts }: { fonts: Array<HomeFont | undefined> }) {
  const href = homeFontHref(fonts);
  return href ? <link rel="stylesheet" href={href} /> : null;
}
