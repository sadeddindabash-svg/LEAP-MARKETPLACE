"use client";

import { useT } from "./LangProvider";
import { statusColors, statusKey } from "@/lib/quotes";

/** A request's status as a coloured pill, in the page's language (a status the app has no word for shows as plain words). */
export default function QuoteStatusPill({ status }: { status: string }) {
  const t = useT();
  const key = statusKey(status);
  const colors = statusColors(status);
  return <span className="rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide" style={{ backgroundColor: colors.bg, color: colors.fg }}>{key ? t(key) : status.split("_").join(" ")}</span>;
}
