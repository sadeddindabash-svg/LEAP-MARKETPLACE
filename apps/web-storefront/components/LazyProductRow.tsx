"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import InfiniteProductGrid from "./InfiniteProductGrid";
import { useLang, useT } from "./LangProvider";
import { gridQuery, type GridSource } from "@/lib/gridSource";
import type { ProductSummary } from "@/lib/api";

interface Props {
  id: string;
  title: string;
  source: GridSource;
  pageSize?: number;
  /** At most this many more batches load by scrolling after the first one (so a row cannot swallow the rows below it); none = it never ends. */
  maxExtraPages?: number;
  /** A part that must not be shown in its own row. */
  hiddenId?: string;
}

/**
 * A row of parts under a product page that is only asked for when the buyer scrolls close to it (so the page opens faster and the shop is not asked for three lists nobody may reach).
 * Once it is near, its first batch is fetched and drawn, and the rest load as the buyer keeps scrolling. A row with nothing to show leaves no heading and no gap.
 */
// fullRows (same model, same brand; confirmed with the person via mockup): only full lines are shown. Tablet and computer: 4 per line and a
// multiple of 4 (an unfinished last line is hidden); phone: 2 per line and a multiple of 2 (an odd last card is hidden). Fewer than one line
// shows nothing. Done by the page's styles, so it also holds for the batches that load while scrolling.
const FULL_ROWS_GRID = "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 max-md:[&>*:last-child:nth-child(odd)]:hidden md:[&>*:nth-child(4n+1):nth-last-child(-n+3)]:hidden md:[&>*:nth-child(4n+1):nth-last-child(-n+3)~*]:hidden";
const NORMAL_GRID = "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4";

export default function LazyProductRow({ id, title, source, pageSize = 8, maxExtraPages, hiddenId, fullRows = false }: Props & { fullRows?: boolean }) {
  const lang = useLang();
  const t = useT();
  const anchor = useRef<HTMLDivElement>(null);
  const started = useRef(false);            // the first batch is asked for ONCE, however many times the scroll watcher reports
  const [state, setState] = useState<"waiting" | "loading" | "ready" | "empty" | "error">("waiting");
  const [first, setFirst] = useState<ProductSummary[]>([]);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch(`/api/products?${gridQuery(source, 1, pageSize, lang)}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { items: ProductSummary[] };
      const items = Array.isArray(data.items) ? data.items : [];
      setFirst(items);
      setState(items.some((p) => p.id !== hiddenId) ? "ready" : "empty");
    } catch {
      setState("error");
    }
  }, [source, pageSize, lang, hiddenId]);

  useEffect(() => {
    const el = anchor.current;
    if (!el) return;
    const start = () => { if (started.current) return; started.current = true; void load(); };
    if (typeof IntersectionObserver === "undefined") { start(); return; }
    const watcher = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { watcher.disconnect(); start(); } }, { rootMargin: "500px 0px" });
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [load]);

  if (state === "empty") return null;
  if (state === "ready") {
    return (
      <section aria-labelledby={id} className="pt-3 sm:pt-4">
        {/* No title on the page (confirmed with the person via mockup): the rows follow each other as one list. It stays for screen readers. */}
        <h2 id={id} className="sr-only">{title}</h2>
        <InfiniteProductGrid id={`${id}-grid`} source={source} initial={first} total={null} pageSize={pageSize} hiddenId={hiddenId} maxExtraPages={maxExtraPages} gridClassName={fullRows ? FULL_ROWS_GRID : NORMAL_GRID} />
      </section>
    );
  }
  return (
    <div ref={anchor} className="min-h-px pt-3 sm:pt-4" aria-busy={state === "loading"}>
      {state === "loading" && <p className="py-6 text-center text-muted">{t("grid_loading")}</p>}
      {state === "error" && (
        <div role="alert" className="rounded-xl bg-white p-6 text-center text-muted">
          {t("grid_error")} <button type="button" onClick={() => void load()} className="font-bold text-navy underline underline-offset-4">{t("try_again")}</button>
        </div>
      )}
    </div>
  );
}
