"use client";

import { useEffect, useState } from "react";
import SignInPrompt from "@/components/SignInPrompt";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useLang, useT } from "@/components/LangProvider";
import { fetchMyReferral, fetchReferralHistory, type ReferralHistoryEntry, type ReferralInfo } from "@/lib/api";
import { localizePath } from "@/lib/i18n";
import { formatDate } from "@/lib/orders";

const outline = "inline-flex min-h-11 items-center justify-center rounded-[10px] border-[1.5px] border-navy px-5 text-sm font-bold text-navy hover:bg-chalk";

// Refer a friend, like the app: the buyer's code (copy it, or share the sign-up link with it), what it earns, how many were referred, the reward cap, and who joined.
export default function ReferralsPage() {
  const { user, isLoading } = useAuth();
  const lang = useLang();
  const t = useT();
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [history, setHistory] = useState<ReferralHistoryEntry[]>([]);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const token = getAuthToken();
    if (!token) return;
    let current = true;
    fetchMyReferral(token).then((i) => { if (current) setInfo(i); }).catch(() => { if (current) setFailed(true); });
    fetchReferralHistory(token).then((h) => { if (current) setHistory(h); }).catch(() => {});
    return () => { current = false; };
  }, [user]);

  if (isLoading) return <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8" aria-busy="true">{t("search_loading")}</div>;
  if (!user) return <SignInPrompt messageKey="login_for_referrals" next="/referrals" />;

  // the sign-up link that carries the code (in the page's language)
  const link = info ? `${typeof window !== "undefined" ? window.location.origin : ""}${localizePath(lang, `/signup?ref=${encodeURIComponent(info.code)}`)}` : "";
  const copy = async (text: string, message: string) => {
    try { await navigator.clipboard.writeText(text); setNote(message); } catch { setNote(null); }
  };
  const share = async () => {
    const text = t("referral_share_text", { url: link });
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try { await navigator.share({ text }); return; } catch { /* the buyer closed the share sheet: nothing to do */ }
    }
    await copy(text, t("share_copied"));
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-navy">{t("referrals")}</h1>
      <p className="mb-6 mt-2 text-muted">{t("referral_explainer")}</p>
      {failed && <p role="alert" className="font-semibold text-[#a12a21]">{t("load_error_generic")}</p>}
      {!info && !failed && <p className="text-muted" aria-busy="true">{t("search_loading")}</p>}
      {info && (
        <div className="grid gap-5">
          <section className="rounded-[14px] border border-line border-t-[6px] border-t-signal bg-white p-6" aria-labelledby="ref-code">
            <h2 id="ref-code" className="text-sm font-bold uppercase tracking-wide text-muted">{t("your_referral_code")}</h2>
            <p className="my-2 font-plate text-3xl font-bold tracking-widest text-navy" dir="ltr">{info.code}</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" className={outline} onClick={() => copy(info.code, t("code_copied"))}>{t("copy_code")}</button>
              <button type="button" className="inline-flex min-h-11 items-center rounded-[10px] bg-signal px-5 text-sm font-bold text-on-signal hover:bg-signal-dark" onClick={share}>{t("share")}</button>
            </div>
            <p aria-live="polite" className="mt-3 min-h-5 text-sm font-semibold text-[#0f6b49]">{note}</p>
            <p className="break-all text-xs text-muted"><span className="font-bold">{t("referral_link_label")}: </span><span dir="ltr">{link}</span></p>
          </section>
          <ul className="grid gap-4 sm:grid-cols-2">
            <li className="rounded-[14px] border border-line bg-white p-5"><p className="text-3xl font-extrabold text-navy">{info.totalReferred}</p><p className="text-sm font-semibold text-muted">{t("people_referred")}</p></li>
            <li className="rounded-[14px] border border-line bg-white p-5"><p className="text-3xl font-extrabold text-navy">{info.rewardsEarned}<span className="text-lg font-semibold text-muted"> / {info.maxRewards}</span></p><p className="text-sm font-semibold text-muted">{t("rewards_earned")}</p></li>
          </ul>
          {info.capReached && <p role="status" className="rounded-xl bg-[#fdf1d6] p-4 font-semibold text-[#7a4e00]">{t("referral_cap_reached")}</p>}
          {history.length > 0 && (
            <section aria-labelledby="ref-history" className="rounded-[14px] border border-line bg-white p-5">
              <h2 id="ref-history" className="mb-3 text-lg font-bold">{t("referral_history")}</h2>
              <ul className="grid gap-2.5">
                {history.map((h, i) => (
                  <li key={`${h.joinedAt}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold">{h.firstName ? t("referral_member_joined", { name: h.firstName }) : t("referral_new_member")}</span>
                    <span className="flex items-center gap-2 text-muted">{formatDate(lang, h.joinedAt)}{h.rewardGranted && <span role="img" aria-label={t("reward_earned_mark")} className="font-bold text-[#0f6b49]">✓</span>}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
