"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import SafeImage from "@/components/SafeImage";
import { useParams, useSearchParams } from "next/navigation";
import Link from "@/components/LocLink";
import EnglishAddressCard from "@/components/EnglishAddressCard";
import ReturnRequestForm from "@/components/ReturnRequestForm";
import StatusTimeline from "@/components/StatusTimeline";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { useLang, useT } from "@/components/LangProvider";
import { Price } from "@/components/Price";
import { cancelOrder, cancelSubOrder, fetchOrderById, fetchOrderReceipt, resolveImageUrl, type OrderDetail, type OrderWho, type SupplierSubOrder } from "@/lib/api";
import { supplierLabel } from "@/lib/cart";
import { countryName } from "@/lib/countries";
import { formatDate, isOrderCancellable, isPartiallyCancellable, isOrderFullyCancelled, isSubOrderCancellable, needsEnglishAddressCheck, reorder, reorderLines, showTrackingLink, statusLabel, subOrderStage } from "@/lib/orders";

const outline = "inline-flex min-h-11 items-center justify-center rounded-[10px] border-[1.5px] border-navy px-4 text-sm font-bold text-navy hover:bg-chalk disabled:opacity-50";
const danger = "inline-flex min-h-11 items-center justify-center rounded-[10px] border-[1.5px] border-[#a12a21] px-4 text-sm font-bold text-[#a12a21] hover:bg-[#fdf2f1] disabled:opacity-50";

function Part({ order, so, who, canCancelPart, onCancel, busy }: { order: OrderDetail; so: SupplierSubOrder; who: OrderWho; canCancelPart: boolean; onCancel: () => void; busy: boolean }) {
  const t = useT();
  const lang = useLang();
  const [returning, setReturning] = useState(false);
  const proof = so.hubShipment?.deliveryProof?.photos ?? [];
  return (
    <li className="rounded-[14px] border border-line bg-white p-5">
      <p className="mb-3 font-bold">{supplierLabel(so.supplierName, t("supplier_word"))}</p>
      <StatusTimeline status={subOrderStage(so)} lang={lang} />
      {so.trackingNumber && <p className="mt-3 text-sm text-muted">{t("tracking_label")} <span className="font-plate font-semibold text-ink" dir="ltr">{so.trackingNumber}</span></p>}
      <ul className="mt-4 grid gap-3">
        {so.items.map((i) => (
          <li key={`${i.productId}`} className="flex items-center gap-3">
            <span className="relative size-14 flex-none overflow-hidden rounded-lg bg-[#e6edf2]">{i.imageUrl && <SafeImage src={resolveImageUrl(i.imageUrl)} alt="" fill sizes="56px" className="object-cover" unoptimized />}</span>
            <Link href={`/products/${i.productId}`} className="min-w-0 flex-1 font-semibold hover:underline">{i.name} <span className="font-normal text-muted">× {i.quantity}</span></Link>
            <Price usd={i.unitPrice * i.quantity} className="font-bold" />
          </li>
        ))}
      </ul>
      {proof.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-bold">{t("delivery_proof_title")}</p>
          <div className="flex flex-wrap gap-2">
            {proof.map((p) => <a key={p.url} href={resolveImageUrl(p.url)} target="_blank" rel="noreferrer" className="relative block size-20 overflow-hidden rounded-lg bg-[#e6edf2]"><SafeImage src={resolveImageUrl(p.url)} alt={t("delivery_proof_title")} fill sizes="80px" className="object-cover" unoptimized /></a>)}
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {canCancelPart && <button type="button" className={danger} disabled={busy} onClick={onCancel}>{t("cancel_this_part")}</button>}
        {order.status !== "cancelled" && <button type="button" className={outline} aria-expanded={returning} onClick={() => setReturning((v) => !v)}>{t("request_a_return")}</button>}
      </div>
      {returning && <ReturnRequestForm subOrderId={so.subOrderId} who={who} onClose={() => setReturning(false)} />}
    </li>
  );
}

function OrderView({ orderId }: { orderId: string }) {
  const { user, isLoading: authLoading } = useAuth();
  const { addItem } = useCart();
  const { format } = useCurrency();
  const lang = useLang();
  const t = useT();
  const guestEmail = useSearchParams().get("guestEmail");
  const token = user ? getAuthToken() : null;
  const who: OrderWho = { token, guestEmail: token ? null : guestEmail };
  const canSee = !!token || !!guestEmail;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "notfound" | "error">("loading");
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "order" } | { kind: "part"; subOrderId: number } | null>(null);

  const [reloads, setReloads] = useState(0);
  const reload = useCallback(() => setReloads((n) => n + 1), []);
  useEffect(() => {
    if (authLoading || !canSee) return;
    let current = true;
    fetchOrderById(token, orderId, token ? null : guestEmail, lang)
      .then((o) => { if (current) { setOrder(o); setState("ok"); } })
      .catch((e) => {
        if (!current) return;
        const message = e instanceof Error ? e.message : "";
        setServerError(message);
        setState(/not found|غير موجود/i.test(message) ? "notfound" : "error");
      });
    return () => { current = false; };
  }, [authLoading, canSee, token, orderId, guestEmail, reloads, lang]);

  const act = async (work: () => Promise<void>, okText: string) => {
    setBusy(true); setNotice(null);
    try { await work(); reload(); setNotice({ kind: "ok", text: okText }); }
    catch (e) { setNotice({ kind: "error", text: e instanceof Error && e.message ? e.message : t("something_went_wrong") }); }
    finally { setBusy(false); setConfirm(null); }
  };

  const downloadReceipt = async () => {
    setBusy(true); setNotice(null);
    try {
      const blob = await fetchOrderReceipt(orderId, who, lang);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `receipt-${orderId}.pdf`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) { setNotice({ kind: "error", text: e instanceof Error && e.message ? e.message : t("something_went_wrong") }); }
    finally { setBusy(false); }
  };

  const doReorder = async () => {
    if (!order) return;
    setBusy(true); setNotice(null);
    const { added, failed } = await reorder(reorderLines(order), addItem);
    setBusy(false);
    if (added === 0) return setNotice({ kind: "error", text: t("reorder_none") });
    setNotice({ kind: "ok", text: failed.length === 0 ? t("items_added_to_cart", { n: added }) : t("items_added_partial", { n: added, names: failed.join(lang === "ar" ? "، " : ", ") }) });
  };

  if (authLoading) return <div className="mx-auto max-w-4xl px-4 py-10 sm:px-8" aria-busy="true">{t("search_loading")}</div>;
  if (!canSee) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
        <p className="mb-4 text-lg text-muted">{t("orders_login_history")}</p>
        <div className="flex flex-wrap gap-3"><Link href="/login" className="inline-flex min-h-12 items-center rounded-[10px] bg-signal px-6 font-bold text-on-signal">{t("sign_in")}</Link><Link href="/orders" className={outline}>{t("track_an_order")}</Link></div>
      </div>
    );
  }
  if (state === "loading") return <div className="mx-auto max-w-4xl px-4 py-10 sm:px-8 text-muted" aria-busy="true">{t("search_loading")}</div>;
  if (state === "error") return <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8"><p role="alert" className="font-semibold text-[#a12a21]">{t("order_load_error")} {serverError}</p></div>;
  if (state === "notfound" || !order) return <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8"><h1 className="text-2xl font-bold">{t("order_not_found")}</h1><p className="mt-3"><Link href="/orders" className="font-bold text-navy underline underline-offset-4">{t("my_orders_title")}</Link></p></div>;

  const partial = isPartiallyCancellable(order);
  const guestQuery = !token && guestEmail ? `?guestEmail=${encodeURIComponent(guestEmail)}` : "";
  const cancelled = isOrderFullyCancelled(order);
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-navy">{t("order_word")} <span className="font-plate" dir="ltr">{order.id}</span></h1>
          <p className="mt-1 text-muted">{t("order_placed_on", { date: formatDate(lang, order.placedAt) })}</p>
          {order.isGuestOrder && <p className="text-sm text-muted">{t("guest_order_note")}</p>}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide ${cancelled ? "bg-[#fdf2f1] text-[#a12a21]" : order.displayStatus === "delivered" ? "bg-[#e3f2ea] text-[#0f6b49]" : "bg-[#fdf1d6] text-[#7a4e00]"}`}>{statusLabel(lang, cancelled ? "cancelled" : order.displayStatus || order.status)}</span>
      </div>

      <p aria-live="polite" role={notice?.kind === "error" ? "alert" : "status"} className={`mb-4 text-sm font-semibold ${notice?.kind === "error" ? "text-[#a12a21]" : "text-[#0f6b49]"}`}>{notice?.text}</p>

      {needsEnglishAddressCheck(order) && order.addressEnglish && <div className="mb-6"><EnglishAddressCard orderId={order.id} english={order.addressEnglish} who={who} onConfirmed={reload} /></div>}

      <ul className="mb-6 grid gap-4">
        {order.supplierSubOrders.map((so) => (
          <Part key={so.subOrderId} order={order} so={so} who={who} busy={busy}
            canCancelPart={partial && isSubOrderCancellable(so)} onCancel={() => setConfirm({ kind: "part", subOrderId: so.subOrderId })} />
        ))}
      </ul>

      <div className="mb-6 grid gap-5 sm:grid-cols-2">
        {order.address && (
          <section className="rounded-[14px] border border-line bg-white p-5" aria-labelledby="ship-to">
            <h2 id="ship-to" className="mb-2 text-lg font-bold">{t("shipping_to")}</h2>
            <p>{order.address.recipientName}</p>
            <p className="text-muted"><bdi>{order.address.streetAddress}, {order.address.city}</bdi>, {countryName(lang, order.address.country)}</p>
            <p className="text-sm text-muted" dir="ltr">{order.address.phone}</p>
            {order.waitForAllShipments && <p className="mt-2 text-sm font-semibold text-navy">{t("wait_ship_together_note")}</p>}
          </section>
        )}
        <section className="rounded-[14px] border border-line bg-white p-5" aria-labelledby="order-sum">
          <h2 id="order-sum" className="mb-2 text-lg font-bold">{t("order_summary")}</h2>
          {order.discountAmount > 0 && <p className="flex justify-between font-semibold text-[#0f6b49]"><span>{t("discount")}{order.promoCode ? ` (${order.promoCode})` : ""}</span><span>−{format(order.discountAmount)}</span></p>}
          {order.shippingFee ? <p className="flex justify-between"><span>{t("shipping_fees")}</span><span>+<Price usd={order.shippingFee} /></span></p> : null}
          <p className="flex justify-between text-xl font-extrabold"><span>{t("order_total_line")}</span><Price usd={order.total} /></p>
        </section>
      </div>

      <div className="flex flex-wrap gap-3">
        {showTrackingLink(order) && <Link href={`/orders/${encodeURIComponent(order.id)}/tracking${guestQuery}`} className={outline}>{t("track_your_package")}</Link>}
        {!cancelled && <button type="button" className={outline} disabled={busy} onClick={downloadReceipt}>{t("download_receipt")}</button>}
        <button type="button" className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-signal px-5 text-sm font-bold text-on-signal hover:bg-signal-dark disabled:opacity-50" disabled={busy} onClick={doReorder}>{busy ? t("adding") : t("reorder")}</button>
        {isOrderCancellable(order) && <button type="button" className={danger} disabled={busy} onClick={() => setConfirm({ kind: "order" })}>{t("cancel_order")}</button>}
        {notice?.kind === "ok" && /\d/.test(notice.text) && notice.text !== t("order_cancelled") && <Link href="/cart" className={outline}>{t("view_cart")}</Link>}
      </div>

      {confirm && (
        <div role="alertdialog" aria-label={confirm.kind === "order" ? t("cancel_order_title") : t("cancel_part_title")} className="mt-5 rounded-[14px] border border-[#e6b8b3] bg-[#fdf2f1] p-5">
          <p className="font-bold">{confirm.kind === "order" ? t("cancel_order_title") : t("cancel_part_title")}</p>
          <p className="mb-4 text-sm text-muted">{t("cannot_be_undone")}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={outline} disabled={busy} onClick={() => setConfirm(null)}>{t("back")}</button>
            <button type="button" className={danger} disabled={busy} onClick={() => act(confirm.kind === "order" ? async () => { await cancelOrder(order.id, who); } : async () => { await cancelSubOrder(order.id, confirm.subOrderId, who); }, confirm.kind === "order" ? t("order_cancelled") : t("part_cancelled"))}>{confirm.kind === "order" ? t("cancel_order") : t("cancel_this_part")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  return <Suspense fallback={null}><OrderView orderId={id} /></Suspense>;
}
