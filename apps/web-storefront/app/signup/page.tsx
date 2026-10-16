"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/LocLink";
import AuthCard from "@/components/AuthCard";
import { useAuth } from "@/components/AuthProvider";
import { useT } from "@/components/LangProvider";
import { useLocRouter } from "@/components/useLocRouter";
import { PASSWORD_MIN, safeNext } from "@/lib/auth";
import { EMAIL_PATTERN } from "@/lib/address";

const input = "min-h-12 w-full rounded-[10px] border-[1.5px] border-[#c5d0d8] bg-white px-3 text-[15px] text-ink";
const label = "mb-1.5 block text-[13px] font-bold text-navy";

function SignupForm() {
  const { signup } = useAuth();
  const t = useT();
  const router = useLocRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next")) ?? "/";
  const [email, setEmail] = useState(params.get("email") || "");          // the checkout's "create an account" step passes the guest's email
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [referralCode, setReferralCode] = useState(params.get("ref") || "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!EMAIL_PATTERN.test(email.trim())) return setError(t("please_enter_valid_email"));
    if (password.length < PASSWORD_MIN) return setError(t("password_too_short"));
    setBusy(true);
    try { await signup(email.trim(), password, referralCode.trim() || undefined, name.trim() || undefined); router.push(next); }
    catch (err) { setError(err instanceof Error && err.message ? err.message : t("something_went_wrong")); }
    finally { setBusy(false); }
  };

  return (
    <AuthCard title={t("create_account")} subtitle={t("signup_subtitle")}>
      <form onSubmit={submit} noValidate className="grid gap-4">
        <div><label htmlFor="su-email" className={label}>{t("email_label")}</label><input id="su-email" type="email" autoComplete="email" dir="ltr" className={input} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label htmlFor="su-password" className={label}>{t("password_label")}</label><input id="su-password" type="password" autoComplete="new-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} /><p className="mt-1 text-xs text-muted">{t("at_least_8_chars")}</p></div>
        <div><label htmlFor="su-name" className={label}>{t("name_optional")}</label><input id="su-name" autoComplete="name" className={input} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label htmlFor="su-ref" className={label}>{t("referral_code_optional")}</label><input id="su-ref" dir="ltr" className={`${input} font-plate`} value={referralCode} onChange={(e) => setReferralCode(e.target.value)} /></div>
        {error && <p role="alert" className="text-sm font-semibold text-[#a12a21]">{error}</p>}
        <button type="submit" disabled={busy} className="mt-2 min-h-12 w-full rounded-[10px] bg-signal text-base font-bold text-on-signal hover:bg-signal-dark disabled:opacity-60">{busy ? t("creating_account") : t("create_account")}</button>
        <Link href={next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`} className="text-center text-sm font-semibold text-navy underline underline-offset-4">{t("already_have_account")}</Link>
      </form>
    </AuthCard>
  );
}

export default function SignupPage() {
  return <Suspense fallback={null}><SignupForm /></Suspense>;
}
