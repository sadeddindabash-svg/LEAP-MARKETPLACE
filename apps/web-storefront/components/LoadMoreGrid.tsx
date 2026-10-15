"use client";

import { useState } from "react";
import ProductCard from "@/components/ProductCard";
import { fetchProductsPaginated, fetchSameBrand, type ProductSummary } from "@/lib/api";
import { useLang, useT } from "./LangProvider";

export const PAGE_SIZE = 10;

type Source = { kind: "sameBrand"; productId: string } | { kind: "newest"; excludeId: string };

/**
 * A titled grid that shows its first page at once (drawn on the server, so it is in the page's HTML) and loads the next page on request, ten at a time. Like the mobile app, there
 * are more pages exactly when the last page the SERVER sent was full: counted BEFORE the part being looked at is hidden from the newest list, otherwise a full page that happened
 * to contain it would look short and the button would disappear. A product already shown is never added twice.
 */
export default function LoadMoreGrid({ id, title, initial, source }: { id: string; title: string; initial: ProductSummary[]; source: Source }) {
  const lang = useLang();
  const t = useT();
  const exclude = source.kind === "newest" ? source.excludeId : null;
  const [items, setItems] = useState(() => initial.filter((p) => p.id !== exclude));
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initial.length >= PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  if (items.length === 0) return null;

  const loadMore = async () => {
    setLoading(true); setFailed(false);
    try {
      const next = page + 1;
      const got = source.kind === "sameBrand"
        ? await fetchSameBrand(source.productId, lang, next)
        : (await fetchProductsPaginated({ sort: "newest", page: next, limit: PAGE_SIZE, lang })).items;
      setItems((cur) => [...cur, ...got.filter((p) => p.id !== exclude && !cur.some((c) => c.id === p.id))]);
      setPage(next);
      setHasMore(got.length >= PAGE_SIZE);
    } catch { setFailed(true); } finally { setLoading(false); }
  };

  return (
    <section className="mt-14" aria-labelledby={id}>
      <h2 id={id} className="mb-5 text-2xl font-bold tracking-tight">{title}</h2>
      <ul className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {items.map((p) => <ProductCard key={p.id} product={p} lang={lang} />)}
      </ul>
      {hasMore && (
        <div className="mt-6 text-center">
          <button type="button" onClick={loadMore} disabled={loading} className="min-h-12 rounded-[10px] border-[1.5px] border-navy px-8 font-bold text-navy hover:bg-chalk disabled:opacity-60">
            {loading ? t("search_loading") : t("show_more")}
          </button>
        </div>
      )}
      {failed && <p role="alert" className="mt-3 text-center text-sm font-semibold text-[#a12a21]">{t("generic_error")}</p>}
    </section>
  );
}
