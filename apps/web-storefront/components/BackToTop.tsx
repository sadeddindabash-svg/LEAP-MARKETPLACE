"use client";

import { useEffect, useState } from "react";
import { useLang } from "./LangProvider";

const SHOW_AFTER_PX = 400;       // about one screen of scrolling: at the top of a page the button is not needed
const LABEL = { en: "Back to top", ar: "العودة للأعلى" } as const;

/**
 * A round arrow in the bottom corner of every page that takes the buyer back to the top. It appears only after scrolling down about one screen, sits at the END side (the right in English,
 * the left in Arabic), keeps clear of a phone's bottom edge, and scrolls smoothly unless the buyer's device asks for less motion.
 */
export default function BackToTop() {
  const lang = useLang();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  if (!visible) return null;
  const toTop = () => {
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };
  return (
    <button type="button" onClick={toTop} aria-label={LABEL[lang] ?? LABEL.en}
      className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] end-6 z-40 grid size-12 place-items-center rounded-full bg-navy text-white shadow-lg hover:bg-[#0d3a52] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
    </button>
  );
}
