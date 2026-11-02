import React, { useLayoutEffect, useRef, useState } from "react";

/**
 * Numbers that COUNT UP: from 0 to their value in 1 second when they first show (quick at the start, slowing down as they land), and from the old value
 * to the new one when the value changes. Nothing moves for people whose system asks for less motion (they see the value straight away), nor where the
 * browser cannot tell (then the value is simply shown), so the number on the page is always the true one at the end.
 */
export const COUNT_UP_MS = 1000;

function canAnimate() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && typeof window.requestAnimationFrame === "function"
    && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The value to show now: counts from 0 (or the value before) to `target` in `ms`. */
export function useCountUp(target, ms = COUNT_UP_MS) {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  const started = useRef(false);
  useLayoutEffect(() => {
    const show = (v) => { shownRef.current = v; setShown(v); };
    const from = started.current ? shownRef.current : 0;
    started.current = true;
    if (!Number.isFinite(target) || from === target || !canAnimate()) { show(target); return undefined; }
    const start = performance.now();
    let frame = 0;
    show(from);
    const step = (now) => {
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

/** A number already written as text ("1,284" or "355"): counts up when it is a plain whole number, otherwise it is shown as it is. */
export function CountUpText({ text }) {
  const plain = typeof text === "string" && (/^\d{1,3}(,\d{3})+$/.test(text) || /^\d+$/.test(text));
  const value = plain ? Number(text.replace(/,/g, "")) : 0;
  const shown = useCountUp(value);
  if (!plain) return <>{text}</>;
  const whole = Math.round(shown);
  return <>{text.includes(",") ? whole.toLocaleString("en-US") : String(whole)}</>;
}

/** Any number with its own way of writing it (money: format = (n) => "¥1,234.00"), counting up. */
export function CountUpValue({ value, format }) {
  return <>{format(useCountUp(Number(value)))}</>;
}
