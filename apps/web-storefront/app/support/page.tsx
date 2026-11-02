"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/LocLink";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useLang, useT } from "@/components/LangProvider";
import { useAutoRefresh } from "@/components/useAutoRefresh";
import { useLocRouter } from "@/components/useLocRouter";
import { createSupportTicket, fetchMyTickets, type SupportTicketSummary } from "@/lib/api";
import { statusLabel } from "@/lib/orders";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OPEN = ["open", "in_progress"];
const DONE = ["resolved", "closed"];

// Support, like the app's screen, in the visitor's language: a signed-in buyer sees their tickets (how many, how many are open and resolved, and each with its
// status) and opens a new one with the button; a guest opens one with their email, or tracks one with its ID and email. A ticket about an order (?orderId=)
// opens the form at once and carries the order.
function Support() {
  const { user, isLoading: authLoading } = useAuth();
  const lang = useLang();
  const t = useT();
  const router = useLocRouter();
  const orderId = useSearchParams().get("orderId");
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(!!orderId);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [trackId, setTrackId] = useState("");
  const [trackEmail, setTrackEmail] = useState("");
  const [trackError, setTrackError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { Promise.resolve().then(() => setLoadState("ready")); return; }
    const token = getAuthToken();
    if (!token) return;
    fetchMyTickets(token).then((data) => { setTickets(data); setLoadState("ready"); }).catch((err: Error) => { setLoadError(err.message); setLoadState("error"); });
  }, [authLoading, user]);
  useAutoRefresh(async () => { const token = getAuthToken(); if (!token) return; setTickets(await fetchMyTickets(token)); }, { enabled: !authLoading && !!user && loadState === "ready" });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) { setFormError(t("ticket_fill_both")); return; }
    if (!user && !guestEmail.trim()) { setFormError(t("ticket_need_email")); return; }
    if (!user && !EMAIL.test(guestEmail.trim())) { setFormError(t("please_enter_valid_email")); return; }
    setFormError(null); setSending(true);
    try {
      const token = getAuthToken();
      const input = { subject: subject.trim(), message: message.trim(), ...(orderId ? { orderId } : {}) };
      const result = await createSupportTicket(input, user ? { token: token ?? undefined } : { guestEmail: guestEmail.trim() });
      router.push(user ? `/support/${result.id}` : `/support/${result.id}?guestEmail=${encodeURIComponent(guestEmail.trim())}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("ticket_load_error"));
      setSending(false);
    }
  }

  function track(e: React.FormEvent) {
    e.preventDefault();
    if (!trackId.trim() || !trackEmail.trim()) { setTrackError(t("ticket_fill_both")); return; }
    setTrackError(null);
    router.push(`/support/${encodeURIComponent(trackId.trim())}?guestEmail=${encodeURIComponent(trackEmail.trim())}`);
  }

  if (authLoading || loadState === "loading") return <div className="mx-auto max-w-2xl px-4 py-10 text-muted sm:px-8" aria-busy="true">{t("search_loading")}</div>;
  const formOpen = showForm || !user;      // a guest gets the form straight away (there is no list to look at first)
  const input = "w-full rounded-lg border border-line px-3 py-2 text-[15px]";
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-navy">{t("support_title")}</h1>
        {user && <button type="button" onClick={() => setShowForm((v) => !v)} className="rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-on-signal">{showForm ? t("cancel") : t("new_ticket_button")}</button>}
      </div>
      <p className="mt-2 text-sm text-muted">{t("support_notice")}</p>

      {formOpen && (
        <form onSubmit={create} noValidate className="mt-6 grid gap-3 rounded-[14px] border border-line bg-white p-5">
          <h2 className="text-lg font-bold text-navy">{t("new_ticket_title")}</h2>
          <label className="grid gap-1 text-sm font-semibold">{t("subject_field")}<input value={subject} onChange={(e) => setSubject(e.target.value)} className={input} /></label>
          <label className="grid gap-1 text-sm font-semibold">{t("how_can_we_help")}<textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className={input} /></label>
          {!user && (
            <div className="grid gap-1"><label htmlFor="nt-email" className="text-sm font-semibold">{t("email_label")}</label><input id="nt-email" type="email" dir="ltr" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className={input} /></div>
          )}
          {formError && <p role="alert" className="text-sm font-semibold text-[#a12a21]">{formError}</p>}
          <button type="submit" disabled={sending} className="justify-self-start rounded-lg bg-signal px-5 py-2.5 font-semibold text-on-signal disabled:opacity-60">{sending ? t("sending") : t("send_button")}</button>
        </form>
      )}

      {!user ? (
        <section className="mt-8 rounded-[14px] border border-line bg-white p-5">
          <h2 className="text-lg font-bold text-navy">{t("track_a_ticket")}</h2>
          <p className="mt-1 text-sm text-muted">{t("track_ticket_help")}</p>
          <form onSubmit={track} noValidate className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm font-semibold">{t("ticket_id_field")}<input value={trackId} onChange={(e) => setTrackId(e.target.value)} dir="ltr" placeholder="T-1234" className={`${input} font-plate uppercase`} /></label>
            <div className="grid gap-1"><label htmlFor="tk-email" className="text-sm font-semibold">{t("email_label")}</label><input id="tk-email" type="email" dir="ltr" value={trackEmail} onChange={(e) => setTrackEmail(e.target.value)} className={input} /></div>
            {trackError && <p role="alert" className="text-sm font-semibold text-[#a12a21]">{trackError}</p>}
            <button type="submit" className="justify-self-start rounded-lg border border-line px-5 py-2.5 font-semibold hover:border-ink">{t("track_button")}</button>
          </form>
          <p className="mt-4 text-sm text-muted">{t("tickets_login")}: <Link href="/login" className="font-semibold text-navy underline underline-offset-4">{t("sign_in")}</Link></p>
        </section>
      ) : (
        <section className="mt-8">
          {loadState === "error" && <p role="alert" className="text-sm font-semibold text-[#a12a21]">{t("tickets_load_error")} {loadError}</p>}
          <div className="grid grid-cols-3 gap-3">
            {([[tickets.length, "total_tickets"], [tickets.filter((x) => OPEN.includes(x.status)).length, "open_requests"], [tickets.filter((x) => DONE.includes(x.status)).length, "status_resolved"]] as const).map(([n, key]) => (
              <div key={key} className="rounded-[14px] border border-line bg-white p-4"><p className="text-2xl font-extrabold text-navy">{n}</p><p className="text-sm font-semibold text-muted">{t(key)}</p></div>
            ))}
          </div>
          {loadState === "ready" && tickets.length === 0 ? (
            <p className="mt-6 text-muted">{t("tickets_empty")}</p>
          ) : (
            <ul className="mt-6 grid gap-3">
              {tickets.map((x) => (
                <li key={x.id}>
                  <Link href={`/support/${x.id}`} className="flex items-center justify-between gap-3 rounded-[14px] border border-line bg-white p-4 hover:border-navy">
                    <span className="min-w-0"><span dir="auto" className="block font-semibold">{x.subject}</span><span className="block text-xs text-muted" dir="ltr">{x.id}{x.orderId ? ` · ${x.orderId}` : ""}</span></span>
                    <span className="shrink-0 rounded-full bg-[#fff4d6] px-3 py-1 text-xs font-bold text-navy">{statusLabel(lang, x.status)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

export default function SupportPage() {
  return <Suspense fallback={null}><Support /></Suspense>;
}
