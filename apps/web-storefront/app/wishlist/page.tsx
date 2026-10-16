"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "@/components/LocLink";
import SignInPrompt from "@/components/SignInPrompt";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useT } from "@/components/LangProvider";
import { Price } from "@/components/Price";
import { COMPARE_MAX, COMPARE_MIN, compareHref } from "@/lib/compare";
import { fetchWishlist, removeFromWishlist, resolveImageUrl, type ProductSummary } from "@/lib/api";

// The wishlist: the parts a buyer saved for later. Out-of-stock ones say that the buyer will be told when they are back (a real back-in-stock notice exists), and 2 to 4 saved
// parts can be compared side by side (like the app).
export default function WishlistPage() {
  const { user, isLoading: authLoading } = useAuth();
  const t = useT();
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [items, setItems] = useState<ProductSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    const token = getAuthToken();
    if (!token) return;
    let current = true;
    fetchWishlist(token).then((data) => { if (current) setItems(data); }).catch(() => { if (current) { setError(t("could_not_load_products")); setItems([]); } });
    return () => { current = false; };
  }, [authLoading, user, t]);

  const handleRemove = async (productId: string) => {
    const token = getAuthToken();
    if (!token) return;
    try { await removeFromWishlist(token, productId); setItems((prev) => prev && prev.filter((p) => p.id !== productId)); setSelected((cur) => cur.filter((id) => id !== productId)); }
    catch (err) { setError(err instanceof Error && err.message ? err.message : t("generic_error")); }
  };

  if (authLoading || (user && items === null)) return <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8 text-muted" aria-busy="true">{t("search_loading")}</div>;
  if (!user) return <SignInPrompt messageKey="login_for_wishlist" next="/wishlist" />;
  const list = items ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-navy">{t("wishlist")}</h1>
        {list.length >= COMPARE_MIN && (
          <button type="button" aria-pressed={compareMode} onClick={() => { setCompareMode((on) => !on); setSelected([]); }} className="inline-flex min-h-11 items-center rounded-[10px] border-[1.5px] border-navy px-4 text-sm font-bold text-navy hover:bg-chalk">
            {compareMode ? t("compare_cancel") : t("compare_mode")}
          </button>
        )}
      </div>
      {compareMode && <p className="mt-3 text-sm text-muted">{t("compare_pick_hint")}</p>}
      {error && <p role="alert" className="mt-4 text-sm font-semibold text-[#a12a21]">{error}</p>}

      {list.length === 0 ? (
        <div className="mt-8 rounded-[14px] border border-line bg-white p-6">
          <p className="mb-4 text-muted">{t("no_wishlist_items_yet")}</p>
          <Link href="/search" className="inline-flex min-h-12 items-center rounded-[10px] bg-signal px-6 font-bold text-on-signal hover:bg-signal-dark">{t("browse_products")}</Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {list.map((p) => (
            <li key={p.id} className="flex items-center gap-4 rounded-[14px] border border-line bg-white p-4">
              {compareMode && (
                <input type="checkbox" className="size-5 flex-none accent-[#0b3146]" aria-label={p.name} checked={selected.includes(p.id)}
                  disabled={!selected.includes(p.id) && selected.length >= COMPARE_MAX}
                  onChange={() => setSelected((cur) => (cur.includes(p.id) ? cur.filter((id) => id !== p.id) : [...cur, p.id]))} />
              )}
              <span className="relative size-16 flex-none overflow-hidden rounded-lg bg-[#e6edf2]">{p.images[0] && <Image src={resolveImageUrl(p.images[0])} alt="" fill sizes="64px" className="object-cover" unoptimized />}</span>
              <Link href={`/products/${p.id}`} className="min-w-0 flex-1">
                <p className="truncate font-bold">{p.name}</p>
                <p className="text-sm text-muted"><Price usd={p.price} /></p>
                {p.stockQuantity === 0 && <p className="mt-1 text-xs font-semibold text-[#7a4e00]">{t("out_of_stock_notify")}</p>}
              </Link>
              <button type="button" onClick={() => handleRemove(p.id)} className="flex-none text-sm font-bold text-navy underline underline-offset-4">{t("remove")}</button>
            </li>
          ))}
        </ul>
      )}
      {compareMode && (
        <div className="mt-6">
          {selected.length >= COMPARE_MIN ? (
            <Link href={compareHref(selected)} className="inline-flex min-h-12 items-center rounded-[10px] bg-signal px-6 font-bold text-on-signal hover:bg-signal-dark">{t("compare_selected", { n: selected.length })}</Link>
          ) : (
            <p className="text-sm font-semibold text-navy">{t("compare_need_two")}</p>
          )}
        </div>
      )}
    </div>
  );
}
