"use client";

import { useEffect, useState } from "react";
import { ROTATE_MS, SLIDE_MS } from "@/lib/searchHints";

/**
 * The words that stand in for a placeholder in the search box: each suggestion stays for a few seconds, then the next one slides up from below while the old one slides out above. A strip of one line per suggestion moves up
 * (the first suggestion is repeated at the end, so after the last one it slides on to the first and then jumps back to it without any movement). Hidden from screen readers (the box keeps its real label and a hidden hint).
 * It does not run while the browser tab is in the background. The caller shows it only while the box is empty and the visitor has not asked for less movement.
 */
export default function RotatingPlaceholder({ suggestions }: { suggestions: string[] }) {
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const count = suggestions.length;
  useEffect(() => {
    if (count < 2) return;
    const id = setInterval(() => { if (typeof document !== "undefined" && document.hidden) return; setAnimate(true); setIndex((i) => (i >= count ? 1 : i + 1)); }, ROTATE_MS);
    return () => clearInterval(id);
  }, [count]);
  useEffect(() => {                                   // arrived on the repeated first one: jump back to the real first one, without moving
    if (index < count) return;
    const id = setTimeout(() => { setAnimate(false); setIndex(0); }, SLIDE_MS + 60);
    return () => clearTimeout(id);
  }, [index, count]);
  if (count === 0) return null;
  const items = [...suggestions, suggestions[0]];
  return (
    <span aria-hidden="true" data-testid="rotating-placeholder" className="pointer-events-none absolute inset-y-0 start-4 end-2 flex items-center overflow-hidden text-[15px] text-muted">
      <span className="block h-6 w-full overflow-hidden">
        <span style={{ display: "block", transform: `translateY(${index * -1.5}rem)`, transition: animate ? `transform ${SLIDE_MS}ms cubic-bezier(0.65, 0, 0.25, 1)` : "none" }}>
          {items.map((s, i) => <span key={i} className="block h-6 truncate leading-6">{s}</span>)}
        </span>
      </span>
    </span>
  );
}
