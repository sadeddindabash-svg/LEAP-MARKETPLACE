"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getAuthToken } from "@/components/AuthProvider";
import { SavedSearch, fetchSavedSearches, deleteSavedSearch } from "@/lib/api";

// Real saved searches management page -- requires a real logged-in
// account, so this is a Client Component checking auth state directly
// rather than anything server-rendered (no SEO value in a buyer's own
// private list).
export default function SavedSearchesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      Promise.resolve().then(() => setLoadState("ready"));
      return;
    }
    const token = getAuthToken();
    if (!token) return;
    fetchSavedSearches(token)
      .then((data) => { setSearches(data); setLoadState("ready"); })
      .catch((err) => { setError(err.message); setLoadState("error"); });
  }, [authLoading, user]);

  const handleDelete = async (id: number) => {
    const token = getAuthToken();
    if (!token) return;
    try {
      await deleteSavedSearch(token, id);
      setSearches((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  if (authLoading || loadState === "loading") {
    return <div className="mx-auto max-w-2xl px-6 py-16 text-muted">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="font-display font-bold text-3xl">Saved searches</h1>
        <p className="mt-3 text-muted">
          Log in to save searches and get notified when new matching parts are listed.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center rounded-md bg-signal px-6 py-3 text-white font-semibold hover:bg-signal-dark transition-colors"
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display font-bold text-3xl">Saved searches</h1>
      <p className="mt-2 text-muted">
        We&apos;ll notify you when new parts match one of these.
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {searches.length === 0 ? (
        <p className="mt-8 text-muted">
          No saved searches yet.{" "}
          <Link href="/search" className="text-signal font-medium">
            Start a search
          </Link>{" "}
          and save it from there.
        </p>
      ) : (
        <div className="mt-8 space-y-3">
          {searches.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-line bg-white p-4">
              <div>
                <p className="font-semibold text-sm">{s.label}</p>
                <p className="text-xs text-muted mt-1">
                  {s.searchTerm ? `"${s.searchTerm}"` : ""}{s.searchTerm && s.category ? " · " : ""}{s.category || ""}
                </p>
              </div>
              <button
                onClick={() => handleDelete(s.id)}
                className="text-xs font-semibold text-muted hover:text-ink"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
