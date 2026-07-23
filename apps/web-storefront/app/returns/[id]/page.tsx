"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth, getAuthToken } from "@/components/AuthProvider";
import { ReturnCaseDetail, fetchReturnCase, sendReturnCaseMessage, resolveImageUrl } from "@/lib/api";

// Real return case detail + thread (new). Requires the same real
// <Suspense> boundary around useSearchParams() as the signup page and
// checkout confirmation already established (a real production build
// fails outright without one).
function ReturnCaseContent() {
  const params = useParams();
  const caseId = params.id as string;
  const searchParams = useSearchParams();
  const urlGuestEmail = searchParams.get("guestEmail");

  const { user, isLoading: authLoading } = useAuth();
  const [guestEmailInput, setGuestEmailInput] = useState(urlGuestEmail || "");
  const [activeGuestEmail, setActiveGuestEmail] = useState(urlGuestEmail);

  const [returnCase, setReturnCase] = useState<ReturnCaseDetail | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error" | "needs-email">("loading");
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const load = () => {
    const token = getAuthToken();
    if (!token && !activeGuestEmail) {
      setLoadState("needs-email");
      return;
    }
    setLoadState("loading");
    fetchReturnCase(caseId, { token: token || undefined, guestEmail: activeGuestEmail || undefined })
      .then((data) => { setReturnCase(data); setLoadState("ready"); })
      .catch((err) => { setError(err.message); setLoadState("error"); });
  };

  useEffect(() => {
    if (authLoading) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, activeGuestEmail, caseId]);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestEmailInput.trim()) return;
    setActiveGuestEmail(guestEmailInput.trim());
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setIsSending(true);
    try {
      const token = getAuthToken();
      await sendReturnCaseMessage(caseId, replyText.trim(), { token: token || undefined, guestEmail: activeGuestEmail || undefined });
      setReplyText("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  if (authLoading || loadState === "loading") {
    return <div className="mx-auto max-w-2xl px-6 py-16 text-muted">Loading…</div>;
  }

  if (loadState === "needs-email") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display font-bold text-3xl">{caseId}</h1>
        <p className="mt-2 text-muted">
          Enter the email this return was filed under to view it.
        </p>
        <form onSubmit={handleEmailSubmit} className="mt-6 flex gap-2">
          <input
            type="email"
            required
            value={guestEmailInput}
            onChange={(e) => setGuestEmailInput(e.target.value)}
            className="flex-1 rounded-md border border-line px-3 py-2 text-sm"
            placeholder="you@example.com"
          />
          <button type="submit" className="rounded-md bg-signal px-5 py-2 text-sm text-white font-semibold hover:bg-signal-dark transition-colors">
            View
          </button>
        </form>
      </div>
    );
  }

  if (loadState === "error" || !returnCase) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display font-bold text-3xl">{caseId}</h1>
        <p className="mt-4 text-sm text-red-600">{error || "Return case not found."}</p>
        <Link href="/returns" className="mt-6 inline-block text-signal font-medium">
          Back to returns
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/returns" className="text-sm text-muted hover:text-ink">
        ← Back to returns
      </Link>

      <div className="mt-4 flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl">{returnCase.reason}</h1>
        <span className="text-xs font-semibold uppercase text-signal">{returnCase.status.replace(/_/g, " ")}</span>
      </div>
      <p className="mt-1 text-sm text-muted">Order {returnCase.orderId}</p>

      {returnCase.photos.length > 0 && (
        <div className="mt-6 flex gap-2 overflow-x-auto">
          {returnCase.photos.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={resolveImageUrl(url)} alt="" className="h-20 w-20 rounded-md object-cover flex-shrink-0" />
          ))}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {returnCase.messages.map((m, i) => (
          <div key={i} className={`flex ${m.senderRole === "admin" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[75%] rounded-lg px-4 py-2 text-sm ${m.senderRole === "admin" ? "bg-chalk text-ink" : "bg-ink text-white"}`}>
              {m.message}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleReply} className="mt-6 flex gap-2">
        <input
          type="text"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 rounded-md border border-line px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isSending}
          className="rounded-md bg-signal px-5 py-2 text-sm text-white font-semibold hover:bg-signal-dark transition-colors disabled:opacity-60"
        >
          {isSending ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}

export default function ReturnCasePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl px-6 py-16 text-muted">Loading…</div>}>
      <ReturnCaseContent />
    </Suspense>
  );
}
