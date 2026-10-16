"use client";

import { useState } from "react";
import Link from "@/components/LocLink";
import AuthCard from "@/components/AuthCard";
import { useT } from "@/components/LangProvider";
import { forgotPassword } from "@/lib/api";
import { EMAIL_PATTERN } from "@/lib/address";

export default function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!EMAIL_PATTERN.test(email.trim())) return setError(t("please_enter_valid_email"));
    setBusy(true);
    try { await forgotPassword(email.trim()); setSent(true); }
    catch (err) { setError(err instanceof Error && err.message ? err.message : t("something_went_wrong")); }
    finally { setBusy(false); }
  };

  return (
    <AuthCard title={t("forgot_password_title")} subtitle={t("enter_email_for_reset")}>
      {sent ? (
        <div role="status" className="grid gap-3">
          <p className="rounded-xl bg-[#e8f4ee] p-4 font-semibold text-[#0f6b49]">{t("if_email_registered")}</p>
          <p className="text-sm text-muted">{t("reset_link_note")}</p>
          <Link href="/login" className="text-sm font-semibold text-navy underline underline-offset-4">{t("login_title")}</Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div><label htmlFor="fp-email" className="mb-1.5 block text-[13px] font-bold text-navy">{t("email_label")}</label><input id="fp-email" type="email" autoComplete="email" dir="ltr" className="min-h-12 w-full rounded-[10px] border-[1.5px] border-[#c5d0d8] bg-white px-3 text-[15px] text-ink" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {error && <p role="alert" className="text-sm font-semibold text-[#a12a21]">{error}</p>}
          <button type="submit" disabled={busy} className="min-h-12 w-full rounded-[10px] bg-signal text-base font-bold text-on-signal hover:bg-signal-dark disabled:opacity-60">{busy ? t("sending") : t("send_reset_link")}</button>
          <Link href="/login" className="text-center text-sm font-semibold text-navy underline underline-offset-4">{t("login_title")}</Link>
        </form>
      )}
    </AuthCard>
  );
}
