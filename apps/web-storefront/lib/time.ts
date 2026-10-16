import { t, type Lang } from "./i18n";

/** "just now", "5m ago", "3h ago", "2d ago" (the app's saved-searches wording), in the page's language. */
export function timeAgo(lang: Lang, iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.floor((now - then) / 60000);
  if (minutes < 1) return t(lang, "time_just_now");
  if (minutes < 60) return t(lang, "time_minutes_ago", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t(lang, "time_hours_ago", { n: hours });
  return t(lang, "time_days_ago", { n: Math.floor(hours / 24) });
}
