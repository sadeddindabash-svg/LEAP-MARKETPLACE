"use client";

import { useEffect, useState } from "react";
import Link from "@/components/LocLink";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useLang, useT } from "@/components/LangProvider";
import { useAutoRefresh } from "@/components/useAutoRefresh";
import { useLocRouter } from "@/components/useLocRouter";
import { fetchMyReturnCases, type ReturnCaseSummary } from "@/lib/api";
import { statusLabel } from "@/lib/orders";

// My returns, like the app's screen, in the visitor's language: a signed-in buyer sees every return request with its reason, its order and its status; a guest
// tracks one with its case ID and the email it was filed under (and is told that signing in shows them all).
export default function ReturnsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const lang = useLang();
  const t = useT();
  const router = useLocRouter();
  const [cases, setCases] = useState<ReturnCaseSummary[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [caseId, setCaseId] = useState("");
  const [email, setEmail] = useState("");
  const [trackError, setTrackError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { Promise.resolve().then(() => setLoadState("ready")); return; }
    const token = getAuthToken();
    if (!token) return;
    fetchMyReturnCases(token).then((data) => { setCases(data); setLoadState("ready"); }).catch((err: Error) => { setLoadError(err.message); setLoadState("error"); });
  }, [authLoading, user]);
  useAutoRefresh(async () => { const token = getAuthToken(); if (!token) return; setCases(await fetchMyReturnCases(token)); }, { enabled: !authLoading && !!user && loadState === "ready" });

  function track(e: React.FormEvent) {
    e.preventDefault();
    if (!caseId.trim() || !email.trim()) { setTrackError(t("ticket_fill_both")); return; }
    setTrackError(null);
    router.push(`/returns/${encodeURIComponent(caseId.trim())}?guestEmail=${encodeURIComponent(email.trim())}`);
  }

  if (authLoading || loadState === "loading") return <div className="mx-auto max-w-2xl px-4 py-10 text-muted sm:px-8" aria-busy="true">{t("search_loading")}</div>;
  const input = "w-full rounded-lg border border-line px-3 py-2 text-[15px]";

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-navy">{t("track_a_return")}</h1>
        <p className="mt-2 text-muted">{t("track_return_help")}</p>
        <form onSubmit={track} noValidate className="mt-6 grid gap-3 rounded-[14px] border border-line bg-white p-5">
          <label className="grid gap-1 text-sm font-semibold">{t("return_case_id_field")}<input value={caseId} onChange={(e) => setCaseId(e.target.value)} dir="ltr" placeholder="RC-1234" className={`${input} font-plate uppercase`} /></label>
          <label className="grid gap-1 text-sm font-semibold">{t("email_label")}<input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className={input} /></label>
          {trackError && <p role="alert" className="text-sm font-semibold text-[#a12a21]">{trackError}</p>}
          <button type="submit" className="justify-self-start rounded-lg bg-signal px-5 py-2.5 font-semibold text-on-signal">{t("track_button")}</button>
        </form>
        <p className="mt-6 text-sm"><Link href="/login" className="font-semibold text-navy underline underline-offset-4">{t("returns_login")}</Link></p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-navy">{t("my_returns_title")}</h1>
      {loadState === "error" && <p role="alert" className="mt-4 text-sm font-semibold text-[#a12a21]">{t("returns_load_error")} {loadError}</p>}
      {loadState === "ready" && cases.length === 0 ? (
        <p className="mt-6 text-muted">{t("returns_empty")}</p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {cases.map((c) => (
            <li key={c.id}>
              <Link href={`/returns/${c.id}`} className="flex items-center justify-between gap-3 rounded-[14px] border border-line bg-white p-4 hover:border-navy">
                <span className="min-w-0">
                  <span dir="auto" className="block font-semibold">{c.reason}</span>
                  <span className="block text-xs text-muted"><span dir="ltr">{c.id}</span> · {t("for_order")} <span className="font-plate" dir="ltr">{c.orderId}</span></span>
                </span>
                <span className="shrink-0 rounded-full bg-[#fff4d6] px-3 py-1 text-xs font-bold text-navy">{statusLabel(lang, c.status)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
