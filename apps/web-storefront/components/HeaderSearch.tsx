"use client";

import { useState } from "react";
import { useLocRouter } from "@/components/useLocRouter";
import { useT } from "@/components/LangProvider";

/** The search box in the header: part name, part number or VIN. Opens the search page (in the visitor's language). */
export default function HeaderSearch() {
  const router = useLocRouter();
  const t = useT();
  const [q, setQ] = useState("");
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
      <input
        id="site-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("search_placeholder")}
        className="min-w-0 flex-1 bg-transparent px-4 text-[15px] text-ink placeholder:text-muted focus:outline-none"
      />
      <button type="submit" className="m-1 rounded-lg bg-signal px-6 text-[15px] font-bold text-on-signal hover:bg-signal-dark">{t("search_button")}</button>
    </form>
  );
}
