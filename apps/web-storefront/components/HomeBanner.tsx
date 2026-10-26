"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/LocLink";
import SafeImage from "@/components/SafeImage";
import { useT } from "@/components/LangProvider";
import { SLIDE_MS } from "@/lib/searchHints";
import type { ViewSlide } from "@/lib/homeBanner";

const SWIPE_PX = 40;

/**
 * The home page banner: the advertisement photos side by side in a strip that slides one photo to the left (to the right in Arabic) after each photo's own number of seconds, round and round (the first photo is repeated at the
 * end so after the last one it slides on to the first and then jumps back without moving). It holds still while the mouse is over it, while something inside it has the keyboard focus, while a finger is on it and while the browser tab
 * is in the background; a visitor who asked for less movement gets no automatic sliding at all (the dots and arrows still work). Dots and arrows appear when there is more than one photo; a swipe changes photo.
 * A photo that has a link is a link (a part page, a category search, or a web page in a new tab).
 */
export default function HomeBanner({ slides, rtl = false }: { slides: ViewSlide[]; rtl?: boolean }) {
  const t = useT();
  const count = slides.length;
  const [index, setIndex] = useState(0);                       // 0..count-1 are the photos; `count` is the repeated first one
  const [animate, setAnimate] = useState(true);
  const [held, setHeld] = useState(false);                     // the mouse, the keyboard focus or a finger is on it
  const [away, setAway] = useState(false);                     // the browser tab is in the background
  const [calm, setCalm] = useState(false);                     // the visitor asked for less movement
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    const query = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    if (query) setCalm(query.matches);
    const onChange = (e: MediaQueryListEvent) => setCalm(e.matches);
    query?.addEventListener?.("change", onChange);
    const onVisible = () => setAway(document.hidden);
    document.addEventListener("visibilitychange", onVisible);
    return () => { query?.removeEventListener?.("change", onChange); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  const at = useRef(0); at.current = index;                   // where the strip is now (so the buttons and the timer never act on an old value)
  const go = useCallback((to: number) => { setAnimate(true); setIndex(to); }, []);
  const next = useCallback(() => {
    if (at.current >= count) { setAnimate(false); setIndex(1); return; }       // on the repeated first photo (about to jump back): carry on from the real first one
    setAnimate(true); setIndex(at.current + 1);
  }, [count]);
  const prev = useCallback(() => { setAnimate(true); setIndex(at.current === 0 ? count - 1 : at.current - 1); }, [count]);

  // Each photo stays for ITS OWN seconds, then the strip slides to the next one. Anything that holds it (or a change of photo) starts the wait again. The wait follows the photo that is ON SHOW (the repeated first photo counts
  // as the first), so the quiet jump back from the repeat to the real first photo does not start it again: the first photo stays exactly its own seconds, every round.
  const shown = index >= count ? 0 : index;
  useEffect(() => {
    if (count < 2 || calm || held || away) return;
    const id = setTimeout(next, slides[shown].seconds * 1000);
    return () => clearTimeout(id);
  }, [shown, count, calm, held, away, slides, next]);
  useEffect(() => {                                           // arrived on the repeated first photo: jump back to the real one, without moving
    if (index < count) return;
    const id = setTimeout(() => { setAnimate(false); setIndex(0); }, SLIDE_MS + 100);
    return () => clearTimeout(id);
  }, [index, count]);

  if (count === 0) return null;
  const strip = count > 1 ? [...slides, slides[0]] : slides;
  const sign = rtl ? 1 : -1;
  const onPointerDown = (e: React.PointerEvent) => { if (e.pointerType !== "mouse") { touchStart.current = e.clientX; setHeld(true); } };
  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    const start = touchStart.current; touchStart.current = null; setHeld(false);
    if (start === null || count < 2) return;
    const dx = e.clientX - start;
    if (Math.abs(dx) >= SWIPE_PX) { const forward = rtl ? dx > 0 : dx < 0; if (forward) next(); else prev(); }
  };

  return (
    <div
      role="region" aria-roledescription="carousel" aria-label={t("banner_label")}
      data-testid="home-banner"
      className="group relative aspect-[5/2] w-full touch-pan-y select-none overflow-hidden rounded-[14px] bg-line lg:aspect-auto lg:h-full lg:min-h-[241px]"
      onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false); }}
      onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { touchStart.current = null; setHeld(false); }}
    >
      <div data-testid="home-banner-strip" className="flex h-full w-full" style={{ transform: `translateX(${sign * index * 100}%)`, transition: animate && !calm ? `transform ${SLIDE_MS}ms cubic-bezier(0.65, 0, 0.25, 1)` : "none" }}>
        {strip.map((s, i) => {
          const isShown = i === shown || (i === count && shown === 0 && index >= count);
          const photo = <SafeImage src={s.src} alt={s.alt} fill sizes="(min-width: 1024px) 50vw, 100vw" priority={i === 0} className="object-cover" unoptimized draggable={false} />;
          return (
            <div key={`${s.id}-${i}`} role="group" aria-roledescription="slide" aria-label={`${(i >= count ? 0 : i) + 1} / ${count}`} aria-hidden={!isShown} className="relative h-full w-full flex-none" data-slide={i}>
              {s.href ? (
                s.external
                  ? <a href={s.href} target="_blank" rel="noopener noreferrer" tabIndex={isShown ? 0 : -1} className="absolute inset-0 block">{photo}</a>
                  : <Link href={s.href} tabIndex={isShown ? 0 : -1} className="absolute inset-0 block">{photo}</Link>
              ) : photo}
            </div>
          );
        })}
      </div>
      {count > 1 && (
        <>
          <button type="button" onClick={prev} aria-label={t("banner_prev")} className="absolute start-2 top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-lg font-bold text-ink opacity-0 shadow transition-opacity focus:opacity-100 group-hover:opacity-100 sm:grid">
            <span aria-hidden="true" className="rtl:rotate-180">‹</span>
          </button>
          <button type="button" onClick={() => next()} aria-label={t("banner_next")} className="absolute end-2 top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-lg font-bold text-ink opacity-0 shadow transition-opacity focus:opacity-100 group-hover:opacity-100 sm:grid">
            <span aria-hidden="true" className="rtl:rotate-180">›</span>
          </button>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {slides.map((s, i) => (
              <button key={s.id} type="button" onClick={() => go(i)} aria-label={t("banner_go_to", { n: i + 1 })} aria-current={i === shown ? "true" : undefined}
                className={`h-2 rounded-full transition-all ${i === shown ? "w-5 bg-white" : "w-2 bg-white/60 hover:bg-white/90"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
