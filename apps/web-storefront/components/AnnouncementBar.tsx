"use client";

import type { CSSProperties } from "react";
import { announcementTexts, tickerSeconds, type Announcement } from "@/lib/announcements";
import { useLang, useT } from "./LangProvider";

/**
 * The moving announcement line at the top of the HOME page (and only there). The English site moves it from right to left, the Arabic site from left to right
 * (see the .leap-ticker rules in globals.css). It pauses while the pointer is over it; a visitor whose device asks for less motion gets the same lines still and centred.
 * A screen reader reads the lines once (the second copy that makes the loop seamless is hidden from it). No announcements, no bar.
 */
export default function AnnouncementBar({ announcements }: { announcements: Announcement[] }) {
  const lang = useLang();
  const t = useT();
  const texts = announcementTexts(announcements, lang);
  if (texts.length === 0) return null;
  const copy = (hidden: boolean) => (
    <div className="leap-ticker-copy" aria-hidden={hidden || undefined} dir={lang === "ar" ? "rtl" : "ltr"}>
      {texts.map((text, i) => (
        <span key={i} className="contents">
          <span>{text}</span>
          <span aria-hidden="true" className="opacity-55">●</span>
        </span>
      ))}
    </div>
  );
  return (
    <section aria-label={t("announcements_region")} data-lang={lang} className="leap-ticker bg-signal text-sm font-semibold text-on-signal" style={{ "--ticker-seconds": `${tickerSeconds(texts)}s` } as CSSProperties}>
      <div className="leap-ticker-track" dir={lang === "ar" ? "rtl" : "ltr"}>
        {copy(false)}
        {copy(true)}
      </div>
      <ul className="leap-ticker-static">{texts.map((text, i) => <li key={i}>{text}</li>)}</ul>
    </section>
  );
}
