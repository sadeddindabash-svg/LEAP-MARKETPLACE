"use client";

import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/i18n";

/**
 * "Read more" at the end of the product's description (patch-product-name-band, patch-description-inline-more): the description shows its
 * first 2 lines and "… Read more" sits at the end of the 2nd line; it opens the description in full, with "Show less" at the end of the text.
 * It is placed INSIDE the description's <p> (the p is position: relative), and shows nothing when the description fits in 2 lines.
 */
const WORDS = { en: { more: "Read more", less: "Show less" }, ar: { more: "اقرأ المزيد", less: "عرض أقل" } };
const CLAMP = "line-clamp-2";

export default function DescriptionMore({ lang }: { lang: Lang }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [long, setLong] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const check = () => { if (el.classList.contains(CLAMP)) setLong(el.scrollHeight > el.clientHeight + 1); };
    check();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  const w = WORDS[lang === "ar" ? "ar" : "en"];
  const toggle = () => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const next = !open;
    el.classList.toggle(CLAMP, !next);
    setOpen(next);
  };
  const link = "font-bold text-navy underline decoration-signal decoration-2 underline-offset-4 hover:text-navy-deep";
  return (
    <span ref={ref}>
      {long && !open && (
        // over the end of the 2nd line, on the page colour, with a soft fade before it so the cut word does not show under it
        <span className="absolute bottom-0 end-0 flex items-end bg-chalk ps-1 before:pointer-events-none before:absolute before:inset-y-0 before:-start-10 before:w-10 before:bg-gradient-to-r before:from-transparent before:to-chalk rtl:before:bg-gradient-to-l">
          <span aria-hidden="true">…&#160;</span>
          <button type="button" aria-expanded={false} onClick={toggle} className={link}>{w.more}</button>
        </span>
      )}
      {long && open && <> <button type="button" aria-expanded onClick={toggle} className={link}>{w.less}</button></>}
    </span>
  );
}
