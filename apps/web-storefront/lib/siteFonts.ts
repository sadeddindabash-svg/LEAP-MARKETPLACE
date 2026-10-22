import type { CSSProperties } from "react";

// The website's own fonts: Outfit (English), IBM Plex Sans Arabic (Arabic) and JetBrains Mono (part numbers). They are NOT downloaded while the site is built (that step fails with Next 16's Turbopack when Google answers with its
// newer font addresses, and it stops the whole site from starting): every page links to Google Fonts for them, and the stylesheet's font variables name them. display=swap: text shows at once in the system font and changes when the font arrives.
export const SITE_FONTS_HREF = "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap";
/** The three variables globals.css uses for its font stacks (--font-body, --font-display, --font-plate). */
export const SITE_FONT_VARS = { "--font-outfit": '"Outfit"', "--font-arabic": '"IBM Plex Sans Arabic"', "--font-jetbrains-mono": '"JetBrains Mono"' } as CSSProperties;
