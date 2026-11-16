"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useLang } from "@/components/LangProvider";
import type { Lang } from "@/lib/i18n";

/**
 * The product's title in parts (patch-name-car-part, confirmed with the person via mockup):
 *   name · brand model · version (years) or All versions (years) · Part No.
 * variant "card" (product cards, basket lines): 2 rows. When it does not fit, the first row stays and the second row slides to its end
 * (to the left in English, to the right in Arabic), pauses, and slides back, again and again; "reduce motion" shows "…" instead.
 * variant "full" (the product page): everything, on as many rows as it needs.
 * Without a fitTitle (an older server) the plain name is shown, as before.
 */
export interface FitTitle {
  name: string;
  partNumber?: string | null;
  allCars?: boolean;
  brand?: string | null;
  model?: string | null;
  allVersions?: boolean;
  versions?: string[];
  versionCount?: number;
  yearFrom?: number | null;
  yearTo?: number | null;
  moreCars?: number;
  forYourCar?: boolean;
}

type Tok = { k: "n" | "fit" | "yr" | "more" | "sep" | "pn"; s: string };

const WORDS = {
  en: { allVersions: "All versions", allCars: "All cars", versions: (n: number) => `${n} versions`, more: (n: number) => (n === 1 ? "+ 1 more car" : `+ ${n} more cars`), pn: "Part No." },
  ar: { allVersions: "جميع الفئات", allCars: "جميع السيارات", versions: (n: number) => `${n} فئات`, more: (n: number) => (n === 1 ? "+ سيارة أخرى" : n === 2 ? "+ سيارتان أخريان" : `+ ${n} سيارات أخرى`), pn: "رقم القطعة" },
};

const words = (text: string | null | undefined, k: Tok["k"]): Tok[] => (text ?? "").split(/\s+/).filter(Boolean).map((s) => ({ k, s }));

export function titleTokens(title: FitTitle | null | undefined, name: string, lang: Lang): Tok[] {
  if (!title) return words(name, "n");
  const w = WORDS[lang === "ar" ? "ar" : "en"];
  const sep: Tok = { k: "sep", s: "·" };
  const out: Tok[] = [...words(title.name || name, "n")];
  if (title.allCars) {
    out.push(sep, ...words(w.allCars, "fit"));
  } else if (title.brand || title.model) {
    out.push(sep, ...words([title.brand, title.model].filter(Boolean).join(" "), "fit"), sep);
    const listed = title.versions ?? [];
    const count = title.versionCount ?? listed.length;
    const version = title.allVersions || count === 0 ? w.allVersions : count > listed.length ? w.versions(count) : listed.join(" / ");
    out.push(...words(version, "fit"));
    if (title.yearFrom) out.push({ k: "yr", s: title.yearTo && title.yearTo !== title.yearFrom ? `(${title.yearFrom}–${title.yearTo})` : `(${title.yearFrom})` });
    if ((title.moreCars ?? 0) > 0) out.push(...words(w.more(title.moreCars!), "more"));
  }
  if (title.partNumber) out.push(sep, { k: "pn", s: title.partNumber });
  return out;
}

/** The whole title as one line of text (hover text, screen readers, sharing). */
export function titleText(title: FitTitle | null | undefined, name: string, lang: Lang): string {
  const w = WORDS[lang === "ar" ? "ar" : "en"];
  return titleTokens(title, name, lang).map((t) => (t.k === "pn" ? `${w.pn} ${t.s}` : t.s)).join(" ");
}

function Token({ t, lang }: { t: Tok; lang: Lang }) {
  if (t.k === "sep") return <span aria-hidden="true" className="px-0.5 font-bold text-[#c9a24a]">·</span>;
  if (t.k === "yr") return <bdi dir="ltr" className="inline-block whitespace-nowrap font-medium">{t.s}</bdi>;
  if (t.k === "pn") {
    return (
      <span className="inline-block whitespace-nowrap rounded-[5px] bg-[#f1ece0] px-1.5 align-baseline text-[0.86em] font-medium leading-[inherit] text-[#5b4a1d]">
        <span className="me-1 text-[#8a7440]">{WORDS[lang === "ar" ? "ar" : "en"].pn}</span>
        <bdi dir="ltr" className="font-plate">{t.s}</bdi>
      </span>
    );
  }
  if (t.k === "more") return <span className="font-medium text-muted">{t.s}</span>;
  return <span className={t.k === "n" ? "font-bold" : "font-medium"}>{t.s}</span>;
}

function Tokens({ toks, lang }: { toks: Tok[]; lang: Lang }) {
  return <>{toks.map((t, i) => <span key={i} data-tok=""><Token t={t} lang={lang} />{i < toks.length - 1 ? " " : ""}</span>)}</>;
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

let stylesAdded = false;
function addStyles() {
  if (stylesAdded || typeof document === "undefined") return;
  stylesAdded = true;
  const el = document.createElement("style");
  el.setAttribute("data-product-title", "");
  el.textContent = `
@keyframes lptL{0%,18%{transform:translateX(0)}50%,68%{transform:translateX(calc(var(--lpt-d) * -1px))}100%{transform:translateX(0)}}
@keyframes lptR{0%,18%{transform:translateX(0)}50%,68%{transform:translateX(calc(var(--lpt-d) * 1px))}100%{transform:translateX(0)}}
.lpt-l2{overflow:hidden;white-space:nowrap}
.lpt-l2.lpt-move{-webkit-mask-image:linear-gradient(to var(--lpt-end),#000 85%,transparent);mask-image:linear-gradient(to var(--lpt-end),#000 85%,transparent)}
.lpt-l2.lpt-move .lpt-mq{display:inline-block;animation:var(--lpt-anim) var(--lpt-dur) ease-in-out infinite}
.lpt-l2.lpt-move:hover .lpt-mq{animation-play-state:paused}
.lpt-l2.lpt-still{text-overflow:ellipsis}
@media (prefers-reduced-motion:reduce){.lpt-l2.lpt-move .lpt-mq{animation:none}}`;
  document.head.appendChild(el);
}

export default function ProductTitle({ title, name, lang: langProp, variant = "card", className = "" }: { title?: FitTitle | null; name: string; lang?: Lang; variant?: "card" | "full"; className?: string }) {
  const ctxLang = useLang();
  const lang = langProp ?? ctxLang;
  const toks = titleTokens(title, name, lang);
  const full = titleText(title, name, lang);
  const box = useRef<HTMLSpanElement>(null);
  const [split, setSplit] = useState<number | null>(null);       // how many tokens are on the first row, when the title needs more than 2 rows
  const [move, setMove] = useState<{ d: number; rtl: boolean } | null>(null);
  const lastWidth = useRef(0);

  // the width changed (a turned phone, a resized window) or the title changed: measure again from the plain 2-row layout
  useEffect(() => {
    if (variant !== "card" || !box.current || typeof ResizeObserver === "undefined") return;
    const el = box.current;
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0 && lastWidth.current > 0 && w !== lastWidth.current) { setSplit(null); setMove(null); }
      if (w > 0) lastWidth.current = w;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [variant]);
  const lastFull = useRef(full);
  useEffect(() => { if (lastFull.current !== full) { lastFull.current = full; setSplit(null); setMove(null); } }, [full]);

  useIsoLayoutEffect(() => {
    if (variant !== "card" || split !== null || !box.current) return;
    const spans = Array.from(box.current.querySelectorAll<HTMLElement>(":scope > span > [data-tok]"));
    if (spans.length < 2) return;
    const lines: number[] = [];
    const tops = spans.map((s) => Math.round(s.getBoundingClientRect().top));
    for (const v of [...tops].sort((a, b) => a - b)) if (!lines.length || v - lines[lines.length - 1] > 6) lines.push(v);
    if (lines.length <= 2) return;
    const first = tops.filter((v) => v - lines[0] <= 6).length;
    if (first > 0 && first < spans.length) setSplit(first);
  });

  useIsoLayoutEffect(() => {
    if (split === null || !box.current) return;
    const l2 = box.current.querySelector<HTMLElement>(".lpt-l2");
    const mq = box.current.querySelector<HTMLElement>(".lpt-mq");
    if (!l2 || !mq) return;
    const d = Math.ceil(mq.scrollWidth - l2.clientWidth) + 6;
    setMove(d > 6 ? { d, rtl: getComputedStyle(box.current).direction === "rtl" } : null);
  }, [split]);

  useIsoLayoutEffect(() => { if (split !== null) addStyles(); }, [split]);

  if (variant === "full") {
    return <span className={`[overflow-wrap:anywhere] ${className}`}><Tokens toks={toks} lang={lang} /></span>;
  }
  const style = move ? ({ "--lpt-d": move.d, "--lpt-anim": move.rtl ? "lptR" : "lptL", "--lpt-dur": `${(4 + move.d / 25).toFixed(1)}s`, "--lpt-end": move.rtl ? "left" : "right" } as CSSProperties) : undefined;
  return (
    <span ref={box} title={full} className={`block ${className}`}>
      {split === null ? (
        <span className="line-clamp-2"><Tokens toks={toks} lang={lang} /></span>
      ) : (
        <>
          <span className="sr-only">{full}</span>
          <span aria-hidden="true" className="block overflow-hidden whitespace-nowrap"><Tokens toks={toks.slice(0, split)} lang={lang} /></span>
          <span aria-hidden="true" className={`lpt-l2 block ${move ? "lpt-move" : "lpt-still"}`} style={style}><span className="lpt-mq inline-block whitespace-nowrap"><Tokens toks={toks.slice(split)} lang={lang} /></span></span>
        </>
      )}
    </span>
  );
}
