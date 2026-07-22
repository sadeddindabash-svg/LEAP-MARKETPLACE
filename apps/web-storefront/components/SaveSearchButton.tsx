"use client";

import { useState } from "react";
import { useAuth, getAuthToken } from "@/components/AuthProvider";
import { createSavedSearch } from "@/lib/api";

interface Props {
  searchTerm?: string;
  category?: string;
}

// Real "Save this search" action -- a Client Component embedded in
// the otherwise server-rendered search page (Server Components can
// render Client Components with plain props), since saving requires
// a real logged-in account and has no SEO value itself.
export function SaveSearchButton({ searchTerm, category }: Props) {
  const { user } = useAuth();
  const [status, setStatus] = useState<"idle" | "prompting" | "saving" | "saved" | "error">("idle");
  const [label, setLabel] = useState(searchTerm || category || "");
  const [error, setError] = useState<string | null>(null);

  if (!searchTerm && !category) return null;
  if (!user) return null;

  const handleSave = async () => {
    const token = getAuthToken();
    if (!token) return;
    setStatus("saving");
    setError(null);
    try {
      await createSavedSearch(token, { searchTerm, category, label: label.trim() || "My search" });
      setStatus("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setStatus("error");
    }
  };

  if (status === "prompting") {
    return (
      <div className="flex items-center gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Name this search"
          className="rounded-md border border-line px-2 py-1 text-xs"
        />
        <button onClick={handleSave} className="text-xs font-semibold text-signal">
          Save
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setStatus("prompting")}
        disabled={status === "saving" || status === "saved"}
        className="text-xs font-semibold text-muted hover:text-ink"
      >
        {status === "saved" ? "✓ Saved — we'll notify you of new matches" : "Save this search"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
