"use client";

import { useEffect, useState } from "react";
import Link from "@/components/LocLink";
import SignInPrompt from "@/components/SignInPrompt";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useLang, useT } from "@/components/LangProvider";
import { deleteSavedSearch, fetchSavedSearches, type SavedSearch } from "@/lib/api";
import { savedSearchHref } from "@/lib/savedSearch";
import { timeAgo } from "@/lib/time";

const outline = "inline-flex min-h-10 items-center justify-center rounded-[10px] border-[1.5px] border-navy px-4 text-sm font-bold text-navy hover:bg-chalk";

// Saved searches: each one is checked for new matches (the buyer gets a notification), shown with when it was last checked; it opens the search, and can be deleted (asked first).
export default function SavedSearchesPage() {
  const { user, isLoading } = useAuth();
  const lang = useLang();
  const t = useT();
  const [items, setItems] = useState<SavedSearch[] | null>(null);
  const [confirm, setConfirm] = useState<SavedSearch | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const token = getAuthToken();
    if (!token) return;
    let current = true;
    fetchSavedSearches(token).then((s) => { if (current) setItems(s); }).catch(() => { if (current) { setError(t("load_error_generic")); setItems([]); } });
    return () => { current = false; };
  }, [user, t]);

  if (isLoading) return <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8" aria-busy="true">{t("search_loading")}</div>;
  if (!user) return <SignInPrompt messageKey="login_for_saved_searches" next="/saved-searches" />;

  const remove = async (s: SavedSearch) => {
    const token = getAuthToken();
    if (!token) return;
    try { await deleteSavedSearch(token, s.id); setItems((cur) => cur && cur.filter((x) => x.id !== s.id)); setConfirm(null); }
    catch (e) { setError(e instanceof Error && e.message ? e.message : t("generic_error")); }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-navy">{t("saved_searches")}</h1>
      {error && <p role="alert" className="mb-4 text-sm font-semibold text-[#a12a21]">{error}</p>}
      {items === null ? <p className="text-muted" aria-busy="true">{t("search_loading")}</p> : items.length === 0 ? (
        <p className="rounded-[14px] border border-line bg-white p-6 text-muted">{t("saved_searches_empty")}</p>
      ) : (
        <ul className="grid gap-3">
          {items.map((s) => (
            <li key={s.id} className="rounded-[14px] border border-line bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-48 flex-1">
                  <Link href={savedSearchHref(s)} className="font-bold hover:underline">{s.label}</Link>
                  <p className="text-sm text-muted">{[s.searchTerm, s.category].filter(Boolean).join(" · ")}</p>
                  <p className="text-xs text-muted">{s.lastCheckedAt ? `${t("last_checked")} ${timeAgo(lang, s.lastCheckedAt)}` : t("not_checked_yet")}</p>
                </div>
                <button type="button" className="text-sm font-bold text-[#a12a21] underline underline-offset-4" onClick={() => setConfirm(s)} aria-label={`${t("delete")}: ${s.label}`}>{t("delete")}</button>
              </div>
              {confirm?.id === s.id && (
                <div role="alertdialog" aria-label={t("delete_saved_search_q", { label: s.label })} className="mt-3 rounded-xl border border-[#e6b8b3] bg-[#fdf2f1] p-4">
                  <p className="mb-3 font-semibold">{t("delete_saved_search_q", { label: s.label })}</p>
                  <div className="flex flex-wrap gap-3"><button type="button" className={outline} onClick={() => setConfirm(null)}>{t("cancel")}</button><button type="button" className="inline-flex min-h-10 items-center rounded-[10px] bg-[#a12a21] px-5 text-sm font-bold text-white" onClick={() => remove(s)}>{t("delete")}</button></div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
