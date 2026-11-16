"use client";

import { useEffect, useState } from "react";
import Link from "@/components/LocLink";
import SignInPrompt from "@/components/SignInPrompt";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useLang, useT } from "@/components/LangProvider";
import { PARTY_KEY, fetchMyQuotations, quoteDate, quoteMoney, vehicleLabel, type QuotationSummary } from "@/lib/quotations";

const BADGE_KEY = { open: "quote_badge_open", ordered: "quote_badge_ordered", expired: "quote_badge_expired", cancelled: "quote_badge_cancelled" } as const;
const BADGE = { open: "bg-[#e8f7ef] text-[#0f6b49]", ordered: "bg-[#eaf3f9] text-navy", expired: "bg-[#fdf0ef] text-[#a12a21]", cancelled: "bg-[#f4f6f8] text-muted" } as const;

// My quotations (in the account menu): every quotation the buyer made, newest first, with its state, who it is for, the car and the total.
export default function MyQuotationsPage() {
  const { user, isLoading } = useAuth();
  const lang = useLang();
  const t = useT();
  const [list, setList] = useState<QuotationSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!user) return;
    const token = getAuthToken();
    if (!token) return;
    let current = true;
    fetchMyQuotations(token).then((l) => { if (current) setList(l); }).catch(() => { if (current) { setFailed(true); setList([]); } });
    return () => { current = false; };
  }, [user]);

  if (isLoading) return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8" aria-busy="true">{t("search_loading")}</div>;
  if (!user) return <SignInPrompt messageKey="login_for_quotations" next="/quotations" />;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-navy">{t("my_quotations")}</h1>
        <Link href="/cart" className="ms-auto inline-flex min-h-11 items-center rounded-[10px] bg-signal px-5 font-bold text-on-signal hover:bg-signal-dark">{t("get_quotation")}</Link>
      </div>
      {failed && <p role="alert" className="mb-4 font-semibold text-[#a12a21]">{t("load_error_generic")}</p>}
      {list === null ? <p className="text-muted" aria-busy="true">{t("search_loading")}</p> : list.length === 0 ? (
        <p className="rounded-[14px] border border-line bg-white p-6 text-muted">{t("quote_none_yet")}</p>
      ) : (
        <ul className="grid gap-3">
          {list.map((q) => (
            <li key={q.id}>
              <Link href={`/quotations/${encodeURIComponent(q.id)}`} className="grid gap-1 rounded-[14px] border border-line bg-white p-4 transition-colors hover:border-navy sm:grid-cols-[1fr_auto] sm:items-center">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-navy" dir="ltr">{q.id}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${BADGE[q.state]}`}>{t(BADGE_KEY[q.state])}</span>
                  </span>
                  <span className="mt-0.5 block text-sm text-muted"><bdi>{q.party.name}</bdi> · {t(PARTY_KEY[q.party.type])} · <bdi>{vehicleLabel(q.vehicle)}</bdi> · {t("quote_parts_count", { n: q.itemCount })}</span>
                  <span className="block text-xs text-muted">{t("quote_issued")} {quoteDate(q.createdAt, lang)} · {t("quote_valid_until", { date: quoteDate(q.expiresAt, lang) })}</span>
                </span>
                <span className="text-lg font-extrabold text-navy sm:text-end">{quoteMoney(q.totalUsd, q.currency, lang)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
