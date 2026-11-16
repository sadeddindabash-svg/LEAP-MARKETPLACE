import { t, type Lang } from "./i18n";

// The delivery DATE shown instead of "N days", as the mobile app does ("Delivery: Oct. 29"): today plus the number of days the server estimates, counted on the calendar of the shop's own time zone so that everyone sees the same date.
export const SHOP_TIME_ZONE = "Asia/Riyadh";
const MONTHS_EN = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

/** Today's calendar date in the shop's time zone. */
function shopToday(now: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: SHOP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}
/** "Oct. 29" / "29 أكتوبر": the date `days` days from today, or null when there is no estimate. */
export function deliveryDateLabel(days: number | null | undefined, lang: Lang, now: Date = new Date()): string | null {
  if (days == null || !Number.isFinite(days) || days < 0) return null;
  const { y, m, d } = shopToday(now);
  const date = new Date(Date.UTC(y, m - 1, d + Math.round(days)));
  const day = date.getUTCDate(); const month = date.getUTCMonth();
  return lang === "ar" ? `${day} ${MONTHS_AR[month]}` : `${MONTHS_EN[month]} ${day}`;
}
/** "Delivery: Oct. 29" / "التسليم: 29 أكتوبر", or null when there is no estimate. */
export function deliveryLine(days: number | null | undefined, lang: Lang, now?: Date): string | null {
  const date = deliveryDateLabel(days, lang, now);
  return date ? t(lang, "delivery_date", { date }) : null;
}
