"use client";

import { useEffect, useState } from "react";
import { t, type Lang } from "@/lib/i18n";

/**
 * The product page's deal countdown: a flip clock (confirmed with the person via mockups: the flip-clock design, colour set A "Navy & gold"):
 * "⏱ Deal ends in" in navy, then days, hours, minutes and seconds on navy split tiles with gold numbers, ticking every second.
 * Shown under the price only while the discount runs; it disappears at the end. Drawn after the page has loaded in the browser,
 * so the time always comes from the buyer's own clock.
 */
export default function DealCountdown({ endsAt, lang }: { endsAt: string; lang: Lang }) {
  const end = Date.parse(endsAt);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (now === null || !Number.isFinite(end)) return null;
  const left = Math.max(0, Math.floor((end - now) / 1000));
  if (left <= 0) return null;
  const parts: [number, string][] = [
    [Math.floor(left / 86400), t(lang, "deal_days")],
    [Math.floor((left % 86400) / 3600), t(lang, "deal_hours")],
    [Math.floor((left % 3600) / 60), t(lang, "deal_minutes")],
    [left % 60, t(lang, "deal_seconds")],
  ];
  const shown = lang === "ar" ? [...parts].reverse() : parts;      // the tiles always read left to right; in Arabic the days are on the right
  return (
    <div data-testid="deal-countdown" role="timer" aria-live="off" className="mt-2 flex max-w-full flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="text-sm font-extrabold text-navy">⏱ {t(lang, "deal_ends_in")}</span>
      <span className="flex items-center gap-[3px]" dir="ltr">
        {shown.map(([n, label], i) => (
          <span key={label} className="flex items-center gap-[3px]">
            {i > 0 && <span aria-hidden="true" className="font-black text-navy">:</span>}
            <span className="relative min-w-[42px] rounded-[7px] bg-[linear-gradient(#123f5a_50%,#0b3146_50%)] px-[3px] pb-[3px] pt-1.5 text-center shadow-[0_3px_6px_rgba(11,49,70,.3)]">
              <span className="block font-display text-[21px] font-extrabold leading-none text-[#f9b317] tabular-nums">{String(n).padStart(2, "0")}</span>
              <span className="block text-[8.5px] font-semibold text-[#c9d6e0]">{label}</span>
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-black/45" />
            </span>
          </span>
        ))}
      </span>
    </div>
  );
}
