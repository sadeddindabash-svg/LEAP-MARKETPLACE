import type { Lang } from "./i18n";

// The moving announcement line at the top of the HOME page, edited by an admin (Settings > Home page announcements).
export const MAX_ANNOUNCEMENTS = 5;
export interface Announcement { en: string; ar: string }

/** The texts to show in a language: Arabic uses its own text and falls back to the English where it has none; a line with no English at all is dropped. */
export function announcementTexts(list: Announcement[], lang: Lang): string[] {
  return list
    .filter((a) => typeof a?.en === "string" && a.en.trim() !== "")
    .slice(0, MAX_ANNOUNCEMENTS)
    .map((a) => (lang === "ar" && typeof a.ar === "string" && a.ar.trim() !== "" ? a.ar.trim() : a.en.trim()));
}

/** How long one full trip of the line takes: proportional to how much there is to read (about 0.3 s a character), never faster than 20 s or slower than 2 minutes. */
export function tickerSeconds(texts: string[]): number {
  const characters = texts.reduce((sum, t) => sum + t.length + 4, 0);          // 4 for the dot and the gaps between lines
  return Math.min(Math.max(Math.round(characters * 0.3), 20), 120);
}
