"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "@/components/LocLink";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useLang, useT } from "@/components/LangProvider";
import { useLocRouter } from "@/components/useLocRouter";
import { fetchSupportTicket, sendSupportTicketMessage, submitTicketFeedback, type SupportTicketDetail } from "@/lib/api";
import { statusLabel } from "@/lib/orders";

const REFRESH_MS = 5_000;      // the conversation refreshes every 5 seconds while it is open, like the app

// One support ticket, like the app's screen, in the visitor's language: the conversation (the Leap team's messages on one side, the buyer's on the other),
// a reply box, and once the ticket is resolved or closed, "Was this resolution helpful?" (asked once). A guest without the email in the address is asked for it.
function Ticket({ ticketId }: { ticketId: string }) {
  const { user, isLoading: authLoading } = useAuth();
  const lang = useLang();
  const t = useT();
  const router = useLocRouter();
  const guestEmail = useSearchParams().get("guestEmail");
  const token = user ? getAuthToken() : null;
  const canSee = !!token || !!guestEmail;
  const auth = { token: token ?? undefined, guestEmail: token ? undefined : guestEmail ?? undefined };
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [gateEmail, setGateEmail] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [thanked, setThanked] = useState(false);

  const load = useCallback(async () => {
    try { setTicket(await fetchSupportTicket(ticketId, { token: token ?? undefined, guestEmail: token ? undefined : guestEmail ?? undefined })); setError(null); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setLoading(false); }
  }, [ticketId, token, guestEmail]);
  useEffect(() => {
    if (authLoading || !canSee) return undefined;
    void load();
    const timer = setInterval(() => { void load(); }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [authLoading, canSee, load]);

  if (authLoading) return <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8" aria-busy="true">{t("search_loading")}</div>;
  if (!canSee) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
        <h1 className="mb-4 text-2xl font-bold text-navy">{t("ticket_word")} {ticketId}</h1>
        <form noValidate onSubmit={(e) => { e.preventDefault(); if (gateEmail.trim()) router.push(`/support/${encodeURIComponent(ticketId)}?guestEmail=${encodeURIComponent(gateEmail.trim())}`); }} className="grid max-w-md gap-3 rounded-[14px] border border-line bg-white p-5">
          <p className="text-sm text-muted">{t("ticket_email_prompt")}</p>
          <label className="grid gap-1 text-sm font-semibold">{t("email_label")}<input type="email" dir="ltr" value={gateEmail} onChange={(e) => setGateEmail(e.target.value)} className="rounded-lg border border-line px-3 py-2 text-[15px]" /></label>
          <button type="submit" className="justify-self-start rounded-lg bg-signal px-5 py-2 font-semibold text-on-signal">{t("view_button")}</button>
        </form>
      </div>
    );
  }
  if (loading && !ticket) return <div className="mx-auto max-w-3xl px-4 py-10 text-muted sm:px-8" aria-busy="true">{t("search_loading")}</div>;
  if (!ticket) {
    const notFound = /not found|غير موجود/i.test(error ?? "");
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
        {notFound ? <h1 className="text-2xl font-bold">{t("order_not_found")}</h1> : <p role="alert" className="font-semibold text-[#a12a21]">{t("ticket_load_error")} {error}</p>}
        <p className="mt-3"><Link href="/support" className="font-bold text-navy underline underline-offset-4">{t("back_to_tickets")}</Link></p>
      </div>
    );
  }
  const askFeedback = (ticket.status === "resolved" || ticket.status === "closed") && (ticket.resolutionHelpful === null || ticket.resolutionHelpful === undefined) && !thanked;
  async function answer(helpful: boolean) {
    setFeedbackError(null);
    try { await submitTicketFeedback(ticketId, helpful, auth); setThanked(true); void load(); }
    catch (err) { setFeedbackError(err instanceof Error ? err.message : String(err)); }
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = reply.trim();
    if (!text || sending) return;
    setSending(true); setReplyError(null);
    try { await sendSupportTicketMessage(ticketId, text, auth); setReply(""); await load(); }
    catch (err) { setReplyError(err instanceof Error ? err.message : String(err)); }
    finally { setSending(false); }
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <p className="mb-2"><Link href="/support" className="text-sm font-semibold text-navy underline underline-offset-4">{t("back_to_tickets")}</Link></p>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 dir="auto" className="text-2xl font-bold tracking-tight text-navy">{ticket.subject}</h1>
          {ticket.orderId && <p className="text-sm text-muted">{t("for_order")} <span className="font-plate font-semibold" dir="ltr">{ticket.orderId}</span></p>}
        </div>
        <span className="rounded-full bg-[#fff4d6] px-3 py-1 text-xs font-bold text-navy">{statusLabel(lang, ticket.status)}</span>
      </div>
      <ul className="grid gap-3">
        {ticket.messages.map((msg, i) => (
          <li key={i} className={`flex ${msg.senderRole === "buyer" ? "justify-end" : "justify-start"}`}>
            <p dir="auto" className={`max-w-[75%] whitespace-pre-wrap rounded-[14px] px-4 py-2.5 text-[15px] ${msg.senderRole === "buyer" ? "bg-navy text-white" : "border border-line bg-white text-ink"}`}>{msg.message}</p>
          </li>
        ))}
      </ul>
      {askFeedback && (
        <div className="mt-6 rounded-[14px] border border-line bg-white p-4">
          <p className="font-semibold text-navy">{t("was_resolution_helpful")}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => void answer(true)} className="rounded-lg bg-signal px-5 py-2 font-semibold text-on-signal">{t("yes")}</button>
            <button type="button" onClick={() => void answer(false)} className="rounded-lg border border-line px-5 py-2 font-semibold">{t("no_word")}</button>
          </div>
          {feedbackError && <p role="alert" className="mt-2 text-sm font-semibold text-[#a12a21]">{feedbackError}</p>}
        </div>
      )}
      {thanked && <p role="status" className="mt-6 font-semibold text-[#1e7a4f]">{t("thanks_feedback")}</p>}
      <form onSubmit={send} className="mt-6 flex gap-2">
        <input aria-label={t("type_message")} placeholder={t("type_message")} value={reply} onChange={(e) => setReply(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-[15px]" />
        <button type="submit" disabled={sending} className="rounded-lg bg-signal px-5 py-2 font-semibold text-on-signal disabled:opacity-60">{sending ? t("sending") : t("send_button")}</button>
      </form>
      {replyError && <p role="alert" className="mt-2 text-sm font-semibold text-[#a12a21]">{replyError}</p>}
    </div>
  );
}

export default function SupportTicketPage() {
  const { id } = useParams<{ id: string }>();
  return <Suspense fallback={null}><Ticket ticketId={id} /></Suspense>;
}
