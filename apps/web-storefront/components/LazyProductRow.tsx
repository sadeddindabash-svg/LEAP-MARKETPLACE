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
export default function LazyProductRow({ id, title, source, pageSize = 8, maxExtraPages, hiddenId }: Props) {
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
      <section aria-labelledby={id} className="mx-auto max-w-6xl px-6 pt-12">
        <h2 id={id} className="mb-6 text-2xl font-bold tracking-tight">{title}</h2>
        <InfiniteProductGrid id={`${id}-grid`} source={source} initial={first} total={null} pageSize={pageSize} hiddenId={hiddenId} maxExtraPages={maxExtraPages} gridClassName="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4" />
      </section>
    );
  }
  return (
    <div ref={anchor} className="mx-auto min-h-px max-w-6xl px-6 pt-12" aria-busy={state === "loading"}>
      {state === "loading" && <p className="py-6 text-center text-muted">{t("grid_loading")}</p>}
      {state === "error" && (
        <div role="alert" className="rounded-xl bg-white p-6 text-center text-muted">
          {t("grid_error")} <button type="button" onClick={() => void load()} className="font-bold text-navy underline underline-offset-4">{t("try_again")}</button>
        </div>
      )}
    </div>
  );
}
