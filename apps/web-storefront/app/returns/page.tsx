"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, getAuthToken } from "@/components/AuthProvider";
import { ReturnCaseSummary, fetchMyReturnCases } from "@/lib/api";

// Real returns page (new) -- the last remaining gap from the original
// storefront list. Two real modes, not one screen pretending to cover
// both:
// - Logged in: a real list, same GET /returns/my-cases the mobile app
//   already uses.
// - Not logged in: a real "track your return" lookup (case ID + the
//   real email it was filed under) -- closes a genuine, separate gap
//   found this session: a guest who filed a return previously had NO
//   way to ever check on it again (GET /returns/my-cases/:id was
//   requireAuth only). Now guest-accessible via a matching email,
//   mirroring GET /order/:id's own established pattern exactly.
export default function ReturnsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<ReturnCaseSummary[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const [lookupCaseId, setLookupCaseId] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      Promise.resolve().then(() => setLoadState("ready"));
      return;
    }
    const token = getAuthToken();
    if (!token) return;
    fetchMyReturnCases(token)
      .then((data) => { setCases(data); setLoadState("ready"); })
      .catch((err) => { setError(err.message); setLoadState("error"); });
  }, [authLoading, user]);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupCaseId.trim() || !lookupEmail.trim()) return;
    router.push(`/returns/${encodeURIComponent(lookupCaseId.trim())}?guestEmail=${encodeURIComponent(lookupEmail.trim())}`);
  };

  if (authLoading || loadState === "loading") {
    return <div className="mx-auto max-w-2xl px-6 py-16 text-muted">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display font-bold text-3xl">Track a return</h1>
        <p className="mt-2 text-muted">
          Enter your return case ID (from your confirmation) and the email you used to file it.
        </p>
        <form onSubmit={handleLookup} className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Return case ID</label>
            <input
              type="text"
              required
              value={lookupCaseId}
              onChange={(e) => setLookupCaseId(e.target.value)}
              placeholder="e.g. RC-1234"
              className="w-full rounded-md border border-line px-3 py-2 text-sm font-plate uppercase"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={lookupEmail}
              onChange={(e) => setLookupEmail(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-signal px-6 py-3 text-white font-semibold hover:bg-signal-dark transition-colors"
          >
            Track return
          </button>
        </form>
        <p className="mt-6 text-sm text-muted">
          Have an account?{" "}
          <Link href="/login" className="text-signal font-medium">
            Log in
          </Link>{" "}
          to see all your returns in one place.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display font-bold text-3xl">My returns</h1>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {loadState === "ready" && cases.length === 0 ? (
        <p className="mt-8 text-muted">No return requests yet.</p>
      ) : (
        <div className="mt-8 space-y-3">
          {cases.map((c) => (
            <Link
              key={c.id}
              href={`/returns/${c.id}`}
              className="flex items-center justify-between rounded-lg border border-line bg-white p-4 hover:border-signal transition-colors"
            >
              <div>
                <p className="font-semibold text-sm">{c.id}</p>
                <p className="text-xs text-muted mt-1">{c.reason} · Order {c.orderId}</p>
              </div>
              <span className="text-xs font-semibold uppercase text-signal">
                {c.status.replace(/_/g, " ")}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
