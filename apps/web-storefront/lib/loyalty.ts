// The loyalty card, with the rules of the mobile app (apps/mobile/lib/features/account/loyalty_card.dart): the tier names, colours and icons, and how the member label reads.
import type { LoyaltyStatus, LoyaltyTier } from "./api";
import { pickName, type Lang } from "./i18n";

/** The tier's name in the page's language (Arabic when the server has one). */
export const tierName = (lang: Lang, tier: Pick<LoyaltyTier, "name" | "nameAr">): string => pickName(lang, tier.name, tier.nameAr);

/** The server names a colour ("amber"); these are the app's colours. Anything it does not know is the muted grey, like the app. */
const COLORS: Record<string, string> = { amber: "#d98e04", blue: "#1d5fb0", purple: "#8b5cf6", teal: "#0f766e" };
export const tierColor = (name: string): string => COLORS[name] ?? "#53636f";

export type TierIcon = "award" | "diamond" | "crown" | "star" | "medal";
export const tierIcon = (name: string): TierIcon => (["award", "diamond", "crown", "star"].includes(name) ? (name as TierIcon) : "medal");

/** "Gold Member" in English, "العضوية / ذهبي" in Arabic (the word first, then a slash, like the app). */
export function memberLabel(lang: Lang, tier: string, word: string): string {
  return lang === "ar" ? `${word} / ${tier}` : `${tier} ${word}`;
}

/** The progress bar's fill, kept between 0 and 1 (the server sends a percent). */
export const progressFraction = (status: Pick<LoyaltyStatus, "progressPercent">): number => Math.min(Math.max((Number(status.progressPercent) || 0) / 100, 0), 1);
