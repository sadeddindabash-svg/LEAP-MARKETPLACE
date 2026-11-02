"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useCurrency } from "./CurrencyProvider";

/**
 * Numbers that COUNT UP: from 0 to their value in 1 second when they first show (quick at the start, slowing down as they land), and from the old value
 * to the new one when the value changes. Nothing moves for people whose system asks for less motion (they see the value straight away), nor where the
 * browser cannot tell (then the value is simply shown), so the number on the page is always the true one at the end.
 */
export const COUNT_UP_MS = 1000;
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function canAnimate(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && typeof window.requestAnimationFrame === "function"
    && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The value to show now: counts from 0 (or the value before) to `target` in `ms`. */
export function useCountUp(target: number, ms: number = COUNT_UP_MS): number {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  const started = useRef(false);
  useIsoLayoutEffect(() => {
    const show = (v: number) => { shownRef.current = v; setShown(v); };
    const from = started.current ? shownRef.current : 0;
    started.current = true;
    if (!Number.isFinite(target) || from === target || !canAnimate()) { show(target); return undefined; }
    const start = performance.now();
    let frame = 0;
    show(from);
    const step = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / ms));      // (the first frame's time can be a moment before the start)
      const eased = 1 - Math.pow(1 - p, 3);
      show(p >= 1 ? target : from + (target - from) * eased);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return shown;
}

const whole = (v: number) => Math.round(v).toLocaleString("en-US");      // Western digits in both languages, like the rest of the site

/** A whole number that counts up (shown with thousands separators: 1,284). */
export function CountUp({ value }: { value: number }) {
  return <>{whole(useCountUp(value))}</>;
}

/** A number already written as text ("1,284"): counts up when it is a plain number, otherwise it is shown as it is. */
export function CountUpText({ text }: { text: string }) {
  const plain = /^\d{1,3}(,\d{3})*$|^\d+$/.test(text);
  const value = plain ? Number(text.replace(/,/g, "")) : 0;
  const shown = useCountUp(value);
  return <>{plain ? whole(shown) : text}</>;
}

/** A price in US dollars, shown in the visitor's currency, that counts up. */
export function CountUpPrice({ usd, className }: { usd: number; className?: string }) {
  const { format } = useCurrency();
  return <span className={className}>{format(useCountUp(usd))}</span>;
}
