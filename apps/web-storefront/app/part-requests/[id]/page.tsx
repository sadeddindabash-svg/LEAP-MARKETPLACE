"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/useAutoRefresh";
import SafeImage from "@/components/SafeImage";
import { useParams } from "next/navigation";
import Link from "@/components/LocLink";
import QuoteStatusPill from "@/components/QuoteStatusPill";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import { useLang, useT } from "@/components/LangProvider";
import { Price } from "@/components/Price";
import { useLocRouter } from "@/components/useLocRouter";
import { cancelQuoteRequest, deleteQuoteRequestItem, fetchQuoteRequest, placeQuoteRequestOrder, resolveImageUrl, updateQuoteRequestItem, type QuoteRequest, type QuoteRequestItem } from "@/lib/api";
import { formatDate } from "@/lib/orders";
import { bannerKey, canAdjustQuote, canAddItems, canCancel, canOrder, displayStatus, quoteTotal, readyItems, statusColors } from "@/lib/quotes";

const outline = "inline-flex min-h-11 items-center justify-center rounded-[10px] border-[1.5px] border-navy px-4 text-sm font-bold text-navy hover:bg-chalk disabled:opacity-50";

function Item({ item, adjustable, busy, onQuantity, onRemove }: { item: QuoteRequestItem; adjustable: boolean; busy: boolean; onQuantity: (q: number) => void; onRemove: () => void }) {
  const t = useT();
  return (
    <li className="rounded-xl border border-line bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="relative size-14 flex-none overflow-hidden rounded-lg bg-[#e6edf2]">{item.referencePhotoUrl && <SafeImage src={resolveImageUrl(item.referencePhotoUrl)} alt="" fill sizes="56px" className="object-cover" unoptimized />}</span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{item.name}</p>
          {item.description && <p className="text-sm text-muted">{item.description}</p>}
          <p className="text-xs text-muted">{t("qty_label", { n: item.quantity })}</p>
        </div>
        <div className="text-end text-sm font-bold">
          {item.status === "unavailable" ? <span className="text-[#a12a21]">{t("item_unavailable")}</span>
            : item.status === "priced" ? (item.readyToOrder ? <Price usd={(item.price ?? 0) * item.quantity} className="text-base font-extrabold text-navy" /> : <span className="text-[#7a4e00]">{t("item_pending_approval")}</span>)
            : null}
        </div>
      </div>
      {(adjustable && item.status === "priced") || (item.readyToOrder && item.productId) ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {adjustable && item.status === "priced" && (
            <>
              <div className="inline-flex items-center rounded-[10px] border-[1.5px] border-[#c5d0d8]">
                <button type="button" className="grid size-10 place-items-center text-lg font-bold text-navy disabled:text-muted" disabled={busy || item.quantity <= 1} onClick={() => onQuantity(item.quantity - 1)} aria-label={t("decrease_quantity")}>−</button>
                <span className="min-w-8 text-center font-bold">{item.quantity}</span>
                <button type="button" className="grid size-10 place-items-center text-lg font-bold text-navy disabled:text-muted" disabled={busy} onClick={() => onQuantity(item.quantity + 1)} aria-label={t("increase_quantity")}>+</button>
              </div>
              <button type="button" disabled={busy} onClick={onRemove} className="text-sm font-bold text-[#a12a21] underline underline-offset-4 disabled:opacity-50">{t("remove")}</button>
            </>
          )}
          {item.readyToOrder && item.productId && <Link href={`/products/${item.productId}`} className="text-sm font-bold text-navy underline underline-offset-4">{t("view_product")}</Link>}
        </div>
      ) : null}
    </li>
  );
}

function RequestView() {
  const { user, isLoading } = useAuth();
  const { cart, refreshCart } = useCart();
  const lang = useLang();
  const t = useT();
  const router = useLocRouter();
  const { id } = useParams<{ id: string }>();
  const [request, setRequest] = useState<QuoteRequest | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "notfound" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const [reloads, setReloads] = useState(0);
  const reload = useCallback(() => setReloads((n) => n + 1), []);
  useEffect(() => {
    if (!user) return;
    const token = getAuthToken();
    if (!token) return;
    let current = true;
    fetchQuoteRequest(token, id).then((r) => { if (current) { setRequest(r); setState("ok"); } })
      .catch((e) => { if (current) setState(/not found|غير موجود/i.test(e instanceof Error ? e.message : "") ? "notfound" : "error"); });
    return () => { current = false; };
  }, [user, id, reloads]);
  useAutoRefresh(async () => { const token = getAuthToken(); if (!token) return; setRequest(await fetchQuoteRequest(token, id)); }, { enabled: !!user && state === "ok" });

  const run = async (work: (token: string) => Promise<void>) => {
    const token = getAuthToken();
    if (!token) return;
    setBusy(true); setError(null);
    try { await work(token); } catch (e) { setError(e instanceof Error && e.message ? e.message : t("something_went_wrong")); } finally { setBusy(false); }
  };

  if (isLoading || (user && state === "loading")) return <div aria-busy="true">{t("search_loading")}</div>;
  if (!user) return <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8"><p className="mb-4 text-lg text-muted">{t("quote_login_needed")}</p><Link href="/login?next=%2Fpart-requests" className="inline-flex min-h-12 items-center rounded-[10px] bg-signal px-6 font-bold text-on-signal">{t("log_in")}</Link></div>;
  if (state === "error") return <p role="alert" className="font-semibold text-[#a12a21]">{t("load_error_generic")}</p>;
  if (state === "notfound" || !request) return <div><h1 className="text-2xl font-bold">{t("order_not_found")}</h1><p className="mt-3"><Link href="/part-requests" className="font-bold text-navy underline underline-offset-4">{t("my_requests_title")}</Link></p></div>;

  const status = displayStatus(request);
  const banner = bannerKey(status);
  const colors = statusColors(status);
  const ready = readyItems(request);
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-navy">{t("quote_request_title")}</h1>
          <p className="mt-1 text-muted">{t("request_for_car", { car: [request.brand, request.model].filter(Boolean).join(" ") + ` · ${request.year}` })} · {formatDate(lang, request.createdAt)}</p>
        </div>
        <QuoteStatusPill status={status} />
      </div>
      {banner && <p role="status" className="rounded-xl p-4 font-semibold" style={{ backgroundColor: colors.bg, color: colors.fg }}>{t(banner)}{status === "quoted" && request.expiresAt ? ` ${t("quote_valid_until", { date: formatDate(lang, request.expiresAt) })}` : ""}</p>}
      {error && <p role="alert" className="text-sm font-semibold text-[#a12a21]">{error}</p>}

      <ul className="grid gap-3" aria-label={t("quote_step_items")}>
        {request.items.map((item) => (
          <Item key={item.id} item={item} busy={busy} adjustable={canAdjustQuote(request)}
            onQuantity={(q) => run(async (token) => { await updateQuoteRequestItem(token, request.id, item.id, { quantity: q }); reload(); })}
            onRemove={() => run(async (token) => { await deleteQuoteRequestItem(token, request.id, item.id); reload(); })} />
        ))}
      </ul>

      {ready.length > 0 && <p className="flex justify-between text-xl font-extrabold"><span>{t("total")}</span><Price usd={quoteTotal(request)} /></p>}

      <div className="flex flex-wrap gap-3">
        {canOrder(request) && (
          <button type="button" disabled={busy || !cart} className="inline-flex min-h-12 items-center justify-center rounded-[10px] bg-signal px-6 font-bold text-on-signal hover:bg-signal-dark disabled:opacity-50"
            onClick={() => run(async (token) => { await placeQuoteRequestOrder(token, request.id, (cart as { cartId: string }).cartId); await refreshCart(); router.push("/cart"); })}>
            {busy ? t("adding") : t("add_to_cart")}
          </button>
        )}
        {canAddItems(request) && <Link href={`/part-requests/new?draft=${encodeURIComponent(request.id)}`} className={outline}>{t("continue_request")}</Link>}
        {canCancel(request) && <button type="button" className={`${outline} !border-[#a12a21] !text-[#a12a21]`} disabled={busy} onClick={() => setConfirmCancel(true)}>{t("cancel_this_request")}</button>}
      </div>

      {confirmCancel && (
        <div role="alertdialog" aria-label={t("cancel_request_title")} className="rounded-[14px] border border-[#e6b8b3] bg-[#fdf2f1] p-5">
          <p className="mb-4 font-bold">{t("cancel_request_title")}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={outline} onClick={() => setConfirmCancel(false)}>{t("back")}</button>
            <button type="button" disabled={busy} className="inline-flex min-h-11 items-center rounded-[10px] bg-[#a12a21] px-5 text-sm font-bold text-white disabled:opacity-50"
              onClick={() => run(async (token) => { await cancelQuoteRequest(token, request.id); setConfirmCancel(false); reload(); })}>{t("cancel_request_button")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RequestDetailPage() {
  return <Suspense fallback={null}><RequestView /></Suspense>;
}
