"use client";

import { useEffect } from "react";

/**
 * Keeps the header on top while the page scrolls (computer screens): the thin top line scrolls away, the main bar (logo, search, account, cart) and the menu stay.
 * The header itself is `sticky` with a top of minus the thin line's height; this measures that line (--topbar-h) and the part that stays (--header-h, 0 when it
 * does not stay, on a phone), so other things that stay on screen (the account menu, the product page's buy box) sit just under it. Once the page is scrolled the
 * header is marked data-scrolled (it gets a little shorter, with a shadow); the two thresholds differ so it cannot flicker between the two at one spot.
 * Draws nothing.
 */
export default function HeaderPin() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("header[data-pin]");
    if (!header) return;
    const root = document.documentElement;
    const topbar = header.querySelector<HTMLElement>("[data-topbar]");
    const measure = () => {
      const tb = topbar?.offsetHeight ?? 0;
      root.style.setProperty("--topbar-h", `${tb}px`);
      const pinned = getComputedStyle(header).position === "sticky";
      root.style.setProperty("--header-h", pinned ? `${Math.max(header.offsetHeight - tb, 0)}px` : "0px");
    };
    let scrolled = false;
    const onScroll = () => {
      const next = scrolled ? window.scrollY > 40 : window.scrollY > 120;
      if (next !== scrolled) { scrolled = next; header.dataset.scrolled = String(next); }
    };
    measure(); onScroll();
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    ro?.observe(header);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { ro?.disconnect(); window.removeEventListener("resize", measure); window.removeEventListener("scroll", onScroll); };
  }, []);
  return null;
}
