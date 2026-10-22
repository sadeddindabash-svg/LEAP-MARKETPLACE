"use client";

import { useEffect, useState } from "react";
import { useLocRouter } from "@/components/useLocRouter";
import { useT } from "@/components/LangProvider";
import RotatingPlaceholder from "@/components/RotatingPlaceholder";
import { searchSuggestions } from "@/lib/searchHints";

/**
 * The search box in the header: part name, part number or VIN. Opens the search page (in the visitor's language).
 * While it is empty, suggestions slide up one at a time (see RotatingPlaceholder); typing hides them. For a visitor who asked for less movement (or before the page is ready) it shows the plain sentence as a normal placeholder.
 */
export default function HeaderSearch() {
  const router = useLocRouter();
  const t = useT();
  const [q, setQ] = useState("");
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReady(true);
    const query = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    if (!query) return;
    setReduced(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);
  const animated = ready && !reduced;
  return (
    <form
      role="search"
      className="flex min-h-12 w-full items-stretch rounded-[10px] border-[1.5px] border-white bg-white"
      onSubmit={(e) => {
        e.preventDefault();
        const value = q.trim();
        router.push(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
      }}
    >
      <label htmlFor="site-search" className="sr-only">{t("search_label")}</label>
      <span id="site-search-hint" className="sr-only">{t("search_placeholder")}</span>
      <div className="relative flex min-w-0 flex-1 items-stretch">
        <input
          id="site-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={animated ? "" : t("search_placeholder")}
          aria-describedby="site-search-hint"
          className="min-w-0 flex-1 bg-transparent px-4 text-[15px] text-ink placeholder:text-muted focus:outline-none"
        />
        {animated && q === "" && <RotatingPlaceholder suggestions={searchSuggestions(t)} />}
      </div>
      <button type="submit" className="m-1 rounded-lg bg-signal px-6 text-[15px] font-bold text-on-signal hover:bg-signal-dark">{t("search_button")}</button>
    </form>
  );
}
