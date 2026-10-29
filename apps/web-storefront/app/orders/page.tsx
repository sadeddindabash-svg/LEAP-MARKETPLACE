"use client";

import { useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/useAutoRefresh";
import Link from "@/components/LocLink";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useLang, useT } from "@/components/LangProvider";
import { Price } from "@/components/Price";
import { useLocRouter } from "@/components/useLocRouter";
import { fetchAnnualSpend, fetchMyOrders, type AnnualSpend, type OrderSummary } from "@/lib/api";
import { supplierLabel } from "@/lib/cart";
import { activeShipmentCount, buyerFacingStatus, formatDate, statusLabel } from "@/lib/orders";

const input = "min-h-12 w-full rounded-[10px] border-[1.5px] border-[#c5d0d8] bg-white px-3 text-[15px] text-ink";

/** "Track an order": a guest (or anybody) looks an order up with its ID and the email it was placed with. */
function Lookup() {
  const t = useT();
  const router = useLocRouter();
  const [id, setId] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="rounded-[14px] border border-line bg-white p-6" noValidate aria-labelledby="lookup-h"
      onSubmit={(e) => {
        e.preventDefault();
        if (!id.trim() || !email.trim()) return setError(t("please_fill_both_fields"));
        router.push(`/orders/${encodeURIComponent(id.trim())}?guestEmail=${encodeURIComponent(email.trim())}`);
      }}
    >
      <h2 id="lookup-h" className="text-xl font-bold">{t("track_an_order")}</h2>
      <p className="mb-4 mt-1 text-sm text-muted">{t("track_order_help")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="lk-id" className="mb-1.5 block text-[13px] font-bold text-navy">{t("order_id_field")}</label><input id="lk-id" className={input} dir="ltr" value={id} onChange={(e) => setId(e.target.value)} /></div>
        <div><label htmlFor="lk-email" className="mb-1.5 block text-[13px] font-bold text-navy">{t("email_field")}</label><input id="lk-email" type="email" className={input} dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-[#a12a21]">{error}</p>}
      <button type="submit" className="mt-4 inline-flex min-h-12 items-center rounded-[10px] bg-signal px-6 font-bold text-on-signal hover:bg-signal-dark">{t("track_button")}</button>
    </form>
  );
}

// My orders: how many shipments are active, what was spent this year, then every order with its status; and, for a guest (or anyone), a lookup by order ID and email.
export default function OrdersPage() {
  const { user, isLoading } = useAuth();
  const lang = useLang();
  const t = useT();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [spend, setSpend] = useState<AnnualSpend | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const token = getAuthToken();
    if (!token) return;
    let current = true;
    fetchMyOrders(token).then((o) => { if (current) setOrders(o); }).catch((e) => { if (current) { setError(e instanceof Error ? e.message : ""); setOrders([]); } });
    fetchAnnualSpend(token).then((s) => { if (current) setSpend(s); }).catch(() => {});
    return () => { current = false; };
  }, [user]);
  useAutoRefresh(async () => { const token = getAuthToken(); if (!token) return; setOrders(await fetchMyOrders(token)); }, { enabled: !!user });

  if (isLoading) return <div className="mx-auto max-w-4xl px-4 py-10 sm:px-8" aria-busy="true">{t("search_loading")}</div>;
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-8">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-navy">{t("my_orders_title")}</h1>
      {!user ? (
        <div className="mb-6 rounded-[14px] border border-line bg-white p-6">
          <p className="mb-4 text-muted">{t("orders_login_history")}</p>
          <Link href="/login" className="inline-flex min-h-12 items-center rounded-[10px] bg-signal px-6 font-bold text-on-signal hover:bg-signal-dark">{t("sign_in")}</Link>
        </div>
      ) : (
        <>
          {orders && orders.length > 0 && (
            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[14px] border border-line bg-white p-5"><p className="text-3xl font-extrabold text-navy">{activeShipmentCount(orders)}</p><p className="text-sm font-semibold text-muted">{t("active_shipments")}</p></div>
              {spend && <div className="rounded-[14px] border border-line bg-white p-5"><p className="text-3xl font-extrabold text-navy"><Price usd={spend.totalSpent} /></p><p className="text-sm font-semibold uppercase text-muted">{lang === "ar" ? `${t("annual_spend_label")} ${spend.year}` : `${spend.year} ${t("annual_spend_label")}`}</p></div>}
            </div>
          )}
          {error && <p role="alert" className="mb-4 text-sm font-semibold text-[#a12a21]">{t("orders_load_error")} {error}</p>}
          {orders === null ? (
            <p className="text-muted" aria-busy="true">{t("search_loading")}</p>
          ) : orders.length === 0 ? (
            <div className="mb-6 rounded-[14px] border border-line bg-white p-6"><p className="mb-4 text-muted">{t("orders_empty")}</p><Link href="/search" className="inline-flex min-h-12 items-center rounded-[10px] bg-signal px-6 font-bold text-on-signal hover:bg-signal-dark">{t("browse_products")}</Link></div>
          ) : (
            <ul className="mb-6 grid gap-3">
              {orders.map((o) => {
                const shown = buyerFacingStatus(o.displayStatus || o.status);
                return (
                  <li key={o.id}>
                    <Link href={`/orders/${encodeURIComponent(o.id)}`} className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line bg-white p-4 transition-colors hover:border-navy">
                      <div className="min-w-48">
                        <p className="font-plate font-semibold">{o.id}</p>
                        <p className="text-sm text-muted">{formatDate(lang, o.placedAt)}{o.supplierNames?.length ? ` · ${o.supplierNames.map((n) => supplierLabel(n, t("supplier_word"))).join(", ")}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Price usd={o.total} className="text-lg font-extrabold text-navy" />
                        <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide ${shown === "delivered" ? "bg-[#e3f2ea] text-[#0f6b49]" : "bg-[#fdf1d6] text-[#7a4e00]"}`}>{statusLabel(lang, shown)}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      <Lookup />
    </div>
  );
}
