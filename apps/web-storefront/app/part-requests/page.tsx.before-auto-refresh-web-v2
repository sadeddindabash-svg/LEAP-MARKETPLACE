"use client";

import { useEffect, useState } from "react";
import Link from "@/components/LocLink";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useLang, useT } from "@/components/LangProvider";
import { fetchMyQuoteRequests, type QuoteRequest } from "@/lib/api";
import QuoteStatusPill from "@/components/QuoteStatusPill";
import { displayStatus } from "@/lib/quotes";
import { formatDate } from "@/lib/orders";

// My requests: the parts the buyer asked the Leap team to find, with where each request stands.
export default function MyRequestsPage() {
  const { user, isLoading } = useAuth();
  const lang = useLang();
  const t = useT();
  const [requests, setRequests] = useState<QuoteRequest[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!user) return;
    const token = getAuthToken();
    if (!token) return;
    let current = true;
    fetchMyQuoteRequests(token).then((r) => { if (current) setRequests(r); }).catch(() => { if (current) { setFailed(true); setRequests([]); } });
    return () => { current = false; };
  }, [user]);

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8" aria-busy="true">{t("search_loading")}</div>;
  if (!user) return <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8"><p className="mb-4 text-lg text-muted">{t("quote_login_needed")}</p><Link href="/login?next=%2Fpart-requests" className="inline-flex min-h-12 items-center rounded-[10px] bg-signal px-6 font-bold text-on-signal">{t("log_in")}</Link></div>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-navy">{t("my_requests_title")}</h1>
        <Link href="/part-requests/new" className="inline-flex min-h-11 items-center rounded-[10px] bg-signal px-5 font-bold text-on-signal hover:bg-signal-dark">{t("new_request")}</Link>
      </div>
      {failed && <p role="alert" className="mb-4 text-sm font-semibold text-[#a12a21]">{t("load_error_generic")}</p>}
      {requests === null ? <p className="text-muted" aria-busy="true">{t("search_loading")}</p> : requests.length === 0 ? (
        <p className="rounded-[14px] border border-line bg-white p-6 text-muted">{t("no_requests_yet")}</p>
      ) : (
        <ul className="grid gap-3">
          {requests.map((r) => (
            <li key={r.id}>
              <Link href={`/part-requests/${encodeURIComponent(r.id)}`} className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line bg-white p-4 transition-colors hover:border-navy">
                <div className="min-w-48">
                  <p className="font-bold">{t("request_for_car", { car: [r.brand, r.model].filter(Boolean).join(" ") + ` · ${r.year}` })}</p>
                  <p className="text-sm text-muted">{r.items.length === 1 ? t("request_items_one") : t("request_items_many", { n: r.items.length })} · {formatDate(lang, r.createdAt)}</p>
                </div>
                <QuoteStatusPill status={displayStatus(r)} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
