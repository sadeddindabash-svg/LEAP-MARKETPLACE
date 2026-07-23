"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, getAuthToken } from "@/components/AuthProvider";
import { SupportTicketSummary, fetchMyTickets, createSupportTicket } from "@/lib/api";

// Real support tickets page (new) -- closes a real, confirmed gap:
// this storefront had no support-ticket UI at all (the notification
// bell's own resolveNotificationLink deliberately returned null for
// ticket-type notifications specifically because of this). Two real
// modes, same pattern as /returns:
// - Logged in: a real list (GET /support/my-tickets), plus a form to
//   open a new one.
// - Not logged in: a real "track your ticket" lookup (ticket ID + the
//   real email it was filed under), plus a form to open a new one as
//   a guest -- mirrors the real guest-access fix in
//   services/api/src/modules/support/routes.js (GET/POST
//   /support/my-tickets/:id* were requireAuth only before this).
export default function SupportPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const [lookupTicketId, setLookupTicketId] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");

  const [showNewForm, setShowNewForm] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newGuestEmail, setNewGuestEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      Promise.resolve().then(() => setLoadState("ready"));
      return;
    }
    const token = getAuthToken();
    if (!token) return;
    fetchMyTickets(token)
      .then((data) => { setTickets(data); setLoadState("ready"); })
      .catch((err) => { setError(err.message); setLoadState("error"); });
  }, [authLoading, user]);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupTicketId.trim() || !lookupEmail.trim()) return;
    router.push(`/support/${encodeURIComponent(lookupTicketId.trim())}?guestEmail=${encodeURIComponent(lookupEmail.trim())}`);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newMessage.trim()) return;
    if (!user && !newGuestEmail.trim()) {
      setError("Please provide an email so we can reach you.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const token = getAuthToken();
      const result = await createSupportTicket(
        { subject: newSubject.trim(), message: newMessage.trim() },
        user ? { token: token || undefined } : { guestEmail: newGuestEmail.trim() }
      );
      if (user) {
        router.push(`/support/${result.id}`);
      } else {
        router.push(`/support/${result.id}?guestEmail=${encodeURIComponent(newGuestEmail.trim())}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ticket");
      setIsSubmitting(false);
    }
  };

  if (authLoading || loadState === "loading") {
    return <div className="mx-auto max-w-2xl px-6 py-16 text-muted">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-3xl">Support</h1>
        <button
          onClick={() => setShowNewForm((v) => !v)}
          className="text-sm font-semibold text-signal hover:text-signal-dark"
        >
          {showNewForm ? "Cancel" : "New ticket"}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {showNewForm && (
        <form onSubmit={handleCreate} className="mt-6 space-y-3 rounded-lg border border-line bg-white p-4">
          <input
            placeholder="Subject"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
          />
          <textarea
            placeholder="How can we help?"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
          />
          {!user && (
            <input
              type="email"
              placeholder="Your email"
              value={newGuestEmail}
              onChange={(e) => setNewGuestEmail(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
            />
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-signal px-6 py-3 text-white font-semibold hover:bg-signal-dark transition-colors disabled:opacity-60"
          >
            {isSubmitting ? "Sending…" : "Submit"}
          </button>
        </form>
      )}

      {!user ? (
        <div className="mt-8">
          <h2 className="font-display font-bold text-lg mb-2">Track an existing ticket</h2>
          <p className="text-sm text-muted mb-4">
            Enter your ticket ID (from your confirmation) and the email you used to file it.
          </p>
          <form onSubmit={handleLookup} className="space-y-3">
            <input
              placeholder="e.g. T-1234"
              value={lookupTicketId}
              onChange={(e) => setLookupTicketId(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2 text-sm font-plate uppercase"
            />
            <input
              type="email"
              placeholder="Email"
              value={lookupEmail}
              onChange={(e) => setLookupEmail(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="w-full rounded-md border border-line px-6 py-3 font-semibold hover:border-ink transition-colors"
            >
              Track ticket
            </button>
          </form>
          <p className="mt-6 text-sm text-muted">
            Have an account?{" "}
            <Link href="/login" className="text-signal font-medium">
              Log in
            </Link>{" "}
            to see all your tickets in one place.
          </p>
        </div>
      ) : (
        <div className="mt-8">
          {loadState === "ready" && tickets.length === 0 ? (
            <p className="text-muted">No support tickets yet.</p>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => (
                <Link
                  key={t.id}
                  href={`/support/${t.id}`}
                  className="flex items-center justify-between rounded-lg border border-line bg-white p-4 hover:border-signal transition-colors"
                >
                  <div>
                    <p className="font-semibold text-sm">{t.subject}</p>
                    <p className="text-xs text-muted mt-1">{t.id}{t.orderId ? ` · Order ${t.orderId}` : ""}</p>
                  </div>
                  <span className="text-xs font-semibold uppercase text-signal">
                    {t.status.replace(/_/g, " ")}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
