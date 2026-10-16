import type { SavedSearch } from "./api";

/** The search page a saved search opens: its words and its category, whichever it has. */
export function savedSearchHref(s: Pick<SavedSearch, "searchTerm" | "category">): string {
  const params = new URLSearchParams();
  if (s.searchTerm) params.set("q", s.searchTerm);
  if (s.category) params.set("category", s.category);
  return `/search${params.toString() ? `?${params.toString()}` : ""}`;
}
