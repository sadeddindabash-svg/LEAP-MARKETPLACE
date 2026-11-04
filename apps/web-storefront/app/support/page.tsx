"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/LocLink";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useLang, useT } from "@/components/LangProvider";
import { useAutoRefresh } from "@/components/useAutoRefresh";
import { useLocRouter } from "@/components/useLocRouter";
import { InAccountHeader } from "@/components/AccountHeaderSlot";
import { createSupportTicket, fetchMyTickets, type SupportTicketSummary } from "@/lib/api";
import { statusLabel } from "@/lib/orders";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OPEN = ["open", "in_progress"];
const DONE = ["resolved", "closed"];
// each status its colour: resolved gold (an answer is there), open and in progress light blue, closed grey
const PILL: Record<string, string> = { resolved: "bg-signal text-navy", closed: "bg-[#eef2f5] text-[#5b6873]" };
const CHAT = "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z";

// Support, like the app's screen, in the visitor's language: a signed-in buyer sees their tickets (how many, how many are open and resolved, and each with its
// status) and opens a new one with the button; a guest opens one with their email, or tracks one with its ID and email. A ticket about an order (?orderId=)
// opens the form at once and carries the order. In the look of the account pages: "+ New ticket" in the navy box at the top, the forms and the list in white
// cards with small gold labels, each ticket with its status in colour.
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
  const input = "w-full rounded-[10px] border-[1.5px] border-line px-3 py-2.5 text-[15px] font-normal focus:border-navy focus:outline-none";
  const label = "text-xs font-extrabold uppercase tracking-[.14em] text-[#8a6100] rtl:tracking-normal";
  const field = "grid gap-1.5 text-sm font-bold text-ink";
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-navy">{t("support_title")}</h1>
        {user && (
          <InAccountHeader>{(onNavy) => (
            <button type="button" onClick={() => setShowForm((v) => !v)} aria-expanded={showForm} className={`inline-flex min-h-10 items-center rounded-[10px] px-4 text-sm font-bold ${showForm ? (onNavy ? "border-[1.5px] border-white/50 text-white hover:bg-white/10" : "border-[1.5px] border-navy text-navy") : "bg-signal text-on-signal hover:bg-signal-dark"}`}>
              {showForm ? t("cancel") : <><span aria-hidden="true">+&nbsp;</span>{t("new_ticket_button")}</>}
            </button>
          )}</InAccountHeader>
        )}
      </div>
      <p className="mt-3 rounded-[12px] bg-[#e6eef4] px-4 py-3 text-sm font-semibold text-navy"><span aria-hidden="true">ⓘ </span>{t("support_notice")}</p>

      {formOpen && (
        <form onSubmit={create} noValidate className="mt-3 grid gap-3 rounded-[16px] border border-line bg-white p-5 sm:p-6">
          <h2 className={label}>{t("new_ticket_title")}</h2>
          <label className={field}>{t("subject_field")}<input value={subject} onChange={(e) => setSubject(e.target.value)} className={input} /></label>
          <label className={field}>{t("how_can_we_help")}<textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className={input} /></label>
          {!user && (
            <div className="grid gap-1.5"><label htmlFor="nt-email" className="text-sm font-bold text-ink">{t("email_label")}</label><input id="nt-email" type="email" dir="ltr" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className={input} /></div>
          )}
          {formError && <p role="alert" className="text-sm font-semibold text-[#a12a21]">{formError}</p>}
          <button type="submit" disabled={sending} className="inline-flex min-h-11 items-center justify-self-start rounded-[10px] bg-signal px-6 font-bold text-on-signal hover:bg-signal-dark disabled:opacity-60">{sending ? t("sending") : t("send_button")}</button>
        </form>
      )}

      {!user ? (
        <section className="mt-3 rounded-[16px] border border-line bg-white p-5 sm:p-6">
          <h2 className={label}>{t("track_a_ticket")}</h2>
          <p className="mt-1.5 text-sm text-muted">{t("track_ticket_help")}</p>
          <form onSubmit={track} noValidate className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className={field}>{t("ticket_id_field")}<input value={trackId} onChange={(e) => setTrackId(e.target.value)} dir="ltr" placeholder="T-1234" className={`${input} font-plate uppercase`} /></label>
            <div className="grid gap-1.5"><label htmlFor="tk-email" className="text-sm font-bold text-ink">{t("email_label")}</label><input id="tk-email" type="email" dir="ltr" value={trackEmail} onChange={(e) => setTrackEmail(e.target.value)} className={input} /></div>
            {trackError && <p role="alert" className="text-sm font-semibold text-[#a12a21] sm:col-span-2">{trackError}</p>}
            <button type="submit" className="inline-flex min-h-11 items-center justify-self-start rounded-[10px] border-[1.5px] border-navy px-6 font-bold text-navy hover:bg-chalk">{t("track_button")}</button>
          </form>
          <p className="mt-4 border-t border-line pt-4 text-sm text-muted">{t("tickets_login")}: <Link href="/login" className="font-bold text-navy underline underline-offset-4">{t("sign_in")}</Link></p>
        </section>
      ) : (
        <section className="mt-3">
          {loadState === "error" && <p role="alert" className="text-sm font-semibold text-[#a12a21]">{t("tickets_load_error")} {loadError}</p>}
          <div className="grid grid-cols-3 gap-3">
            {([[tickets.length, "total_tickets"], [tickets.filter((x) => OPEN.includes(x.status)).length, "open_requests"], [tickets.filter((x) => DONE.includes(x.status)).length, "status_resolved"]] as const).map(([n, key]) => (
              <div key={key} className="rounded-[16px] border border-line bg-white p-4"><p className="text-[26px] font-extrabold leading-tight text-navy">{n}</p><p className="text-[13px] font-semibold text-muted">{t(key)}</p></div>
            ))}
          </div>
          {loadState === "ready" && tickets.length === 0 ? (
            <p className="mt-3 rounded-[16px] border border-line bg-white p-5 text-muted">{t("tickets_empty")}</p>
          ) : (
            <ul className="mt-3 grid gap-3">
              {tickets.map((x) => (
                <li key={x.id}>
                  <Link href={`/support/${x.id}`} className="flex items-center gap-3 rounded-[16px] border border-line bg-white p-4 transition-colors hover:border-navy">
                    <span aria-hidden="true" className="grid size-9 flex-none place-items-center rounded-full bg-[#fdf3d6] text-[#8a6100]"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={CHAT} /></svg></span>
                    <span className="min-w-0 flex-1"><span dir="auto" className="block font-bold text-navy">{x.subject}</span><span className="block text-xs text-muted" dir="ltr">{x.id}{x.orderId ? ` · ${x.orderId}` : ""}</span></span>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold ${PILL[x.status] ?? "bg-[#e6eef4] text-navy"}`}>{statusLabel(lang, x.status)}</span>
                    <span aria-hidden="true" className="text-lg text-muted rtl:rotate-180">›</span>
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
