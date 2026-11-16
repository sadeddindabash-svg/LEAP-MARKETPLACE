"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "@/components/LocLink";
import { getAuthToken } from "@/components/AuthProvider";
import { useLang, useT } from "@/components/LangProvider";
import { fetchOrderTracking, type OrderTracking } from "@/lib/api";
import { formatDate } from "@/lib/orders";

const POLL_MS = 5_000;                    // like the app: the page refreshes itself while it is open

function Tracking({ orderId }: { orderId: string }) {
  const lang = useLang();
  const t = useT();
  const guestEmail = useSearchParams().get("guestEmail");
  const [data, setData] = useState<OrderTracking | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    const load = () => {
      if (typeof document !== "undefined" && document.hidden) return;                 // nobody is looking: do not ask
      fetchOrderTracking(orderId, { token: getAuthToken(), guestEmail }, lang)
        .then((d) => { if (current) { setData(d); setFailed(false); } })
        .catch(() => { if (current) setFailed(true); });
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => { current = false; clearInterval(timer); };
  }, [orderId, guestEmail, lang]);

  const back = `/orders/${encodeURIComponent(orderId)}${guestEmail ? `?guestEmail=${encodeURIComponent(guestEmail)}` : ""}`;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <p className="mb-2"><Link href={back} className="text-sm font-semibold text-navy underline underline-offset-4">{t("order_word")} {orderId}</Link></p>
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-navy">{t("track_your_package")}</h1>
      {failed && !data && <p role="alert" className="font-semibold text-[#a12a21]">{t("tracking_load_error")}</p>}
      {!data && !failed && <p className="text-muted" aria-busy="true">{t("search_loading")}</p>}
      {data && data.subOrders.length === 0 && <p className="text-muted">{t("no_shipments")}</p>}
      <div className="grid gap-5">
        {data?.subOrders.map((so) => {
          const number = so.hubTrackingNumber || so.supplierTrackingNumber;
          return (
            <section key={so.subOrderId} className="rounded-[14px] border border-line bg-white p-5" aria-label={`${t("order_word")} ${orderId} #${so.subOrderId}`}>
              {number && <p className="mb-3 text-sm"><span className="text-muted">{t("tracking_number")}: </span><span className="font-plate font-semibold" dir="ltr">{number}</span></p>}
              {so.isDelayed && <p role="status" className="mb-3 rounded-lg bg-[#fdf1d6] px-3 py-2 text-sm font-semibold text-[#7a4e00]">{t("tracking_delayed")}</p>}
              {so.timeline.length === 0 ? (
                <p className="text-sm text-muted">{t("no_tracking_updates")}</p>
              ) : (
                <ol className="grid gap-3 border-s-2 border-line ps-4">
                  {so.timeline.map((step, i) => (
                    <li key={`${step.time}-${i}`} className="relative">
                      <span aria-hidden="true" className={`absolute -start-[23px] top-1.5 size-3 rounded-full ${i === so.timeline.length - 1 ? "bg-signal" : "bg-[#b9c6d0]"}`} />
                      <p className="font-semibold">{step.description}</p>
                      <p className="text-xs text-muted">{formatDate(lang, step.time)}{step.location ? ` · ${step.location}` : ""}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted">{t("updating_live")}</p>
    </div>
  );
}

export default function TrackingPage() {
  const { id } = useParams<{ id: string }>();
  return <Suspense fallback={null}><Tracking orderId={id} /></Suspense>;
}
