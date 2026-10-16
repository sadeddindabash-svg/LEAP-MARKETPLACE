"use client";

import { useState } from "react";
import Link from "@/components/LocLink";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useT } from "@/components/LangProvider";
import { changeEmail } from "@/lib/api";
import { EMAIL_PATTERN } from "@/lib/address";

const input = "min-h-12 w-full rounded-[10px] border-[1.5px] border-[#c5d0d8] bg-white px-3 text-[15px] text-ink";

// Change email, like the app: the new email and the current password. The server answers with a NEW sign-in token for the new email, which is adopted at once, so the buyer
// stays signed in and everything keeps working.
export default function ChangeEmailPage() {
  const { user, isLoading, adoptSession } = useAuth();
  const t = useT();
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  if (isLoading) return <div aria-busy="true">{t("loading_account")}</div>;
  if (!user) return <Link href="/login?next=%2Faccount%2Fchange-email" className="inline-flex min-h-12 items-center rounded-[10px] bg-signal px-6 font-bold text-on-signal">{t("log_in")}</Link>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!newEmail.trim() || !password) return setMessage({ kind: "error", text: t("please_fill_all_fields") });
    if (!EMAIL_PATTERN.test(newEmail.trim())) return setMessage({ kind: "error", text: t("please_enter_valid_email") });
    const token = getAuthToken();
    if (!token) return;
    setBusy(true);
    try {
      const done = await changeEmail(token, newEmail.trim(), password);
      adoptSession(done.token, { ...user, ...done.user });
      setNewEmail(""); setPassword("");
      setMessage({ kind: "ok", text: t("email_changed_success") });
    } catch (err) { setMessage({ kind: "error", text: err instanceof Error && err.message ? err.message : t("something_went_wrong") }); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-3xl font-bold tracking-tight text-navy">{t("change_email")}</h1>
      <p className="mb-5 mt-2 text-muted">{t("current_email_label")} <strong className="text-ink" dir="ltr">{user.email}</strong></p>
      <form onSubmit={submit} noValidate className="grid gap-4 rounded-[14px] border border-line bg-white p-6">
        <div><label htmlFor="ce-new" className="mb-1.5 block text-[13px] font-bold text-navy">{t("new_email_label")}</label><input id="ce-new" type="email" autoComplete="email" dir="ltr" className={input} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
        <div><label htmlFor="ce-pw" className="mb-1.5 block text-[13px] font-bold text-navy">{t("current_password_label")}</label><input id="ce-pw" type="password" autoComplete="current-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <p className="text-sm text-muted">{t("email_unchanged_hint")}</p>
        {message && <p role={message.kind === "error" ? "alert" : "status"} className={`text-sm font-semibold ${message.kind === "error" ? "text-[#a12a21]" : "text-[#0f6b49]"}`}>{message.text}</p>}
        <button type="submit" disabled={busy} className="min-h-12 rounded-[10px] bg-signal font-bold text-on-signal hover:bg-signal-dark disabled:opacity-60">{busy ? t("saving_changes") : t("save_changes")}</button>
      </form>
    </div>
  );
}
