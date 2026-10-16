"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/LocLink";
import AuthCard from "@/components/AuthCard";
import { useAuth } from "@/components/AuthProvider";
import { useT } from "@/components/LangProvider";
import { useLocRouter } from "@/components/useLocRouter";
import { isSixDigitCode, normalizeCode, safeNext } from "@/lib/auth";

const input = "min-h-12 w-full rounded-[10px] border-[1.5px] border-[#c5d0d8] bg-white px-3 text-[15px] text-ink";
const label = "mb-1.5 block text-[13px] font-bold text-navy";
const primary = "mt-2 min-h-12 w-full rounded-[10px] bg-signal text-base font-bold text-on-signal hover:bg-signal-dark disabled:opacity-60";

function LoginForm() {
  const { login, completeTwoFactor } = useAuth();
  const t = useT();
  const router = useLocRouter();
  const next = safeNext(useSearchParams().get("next")) ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [awaiting, setAwaiting] = useState<string | null>(null);        // the userId, once the password was right and a code is needed
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (awaiting) {
      if (!isSixDigitCode(code)) return setError(t("two_factor_login_prompt"));
      setBusy(true);
      try { await completeTwoFactor(awaiting, normalizeCode(code)); router.push(next); }
      catch (err) { setError(err instanceof Error && err.message ? err.message : t("login_failed")); }
      finally { setBusy(false); }
      return;
    }
    setBusy(true);
    try {
      const result = await login(email.trim(), password);
      if (result.status === "two_factor") setAwaiting(result.userId);
      else router.push(next);
    } catch (err) { setError(err instanceof Error && err.message ? err.message : t("login_failed")); }
    finally { setBusy(false); }
  };

  return (
    <AuthCard title={awaiting ? t("two_factor_title") : t("login_title")} subtitle={awaiting ? t("two_factor_login_prompt") : t("login_subtitle")}>
      <form onSubmit={submit} noValidate className="grid gap-4">
        {awaiting ? (
          <div>
            <label htmlFor="lg-code" className={label}>{t("code_six_digits")}</label>
            <input id="lg-code" className={`${input} text-center font-plate text-xl tracking-[0.4em]`} inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={7} autoFocus value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
        ) : (
          <>
            <div><label htmlFor="lg-email" className={label}>{t("email_label")}</label><input id="lg-email" type="email" autoComplete="email" dir="ltr" className={input} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><label htmlFor="lg-password" className={label}>{t("password_label")}</label><input id="lg-password" type="password" autoComplete="current-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          </>
        )}
        {error && <p role="alert" className="text-sm font-semibold text-[#a12a21]">{error}</p>}
        <button type="submit" disabled={busy} className={primary}>{busy ? t("signing_in") : awaiting ? t("verify_label") : t("login_title")}</button>
        {awaiting ? (
          <button type="button" className="text-sm font-semibold text-navy underline underline-offset-4" onClick={() => { setAwaiting(null); setCode(""); setError(null); }}>{t("back")}</button>
        ) : (
          <div className="flex flex-wrap justify-between gap-3 text-sm font-semibold text-navy">
            <Link href="/forgot-password" className="underline underline-offset-4">{t("forgot_password_q")}</Link>
            <Link href={next === "/" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`} className="underline underline-offset-4">{t("no_account_signup")}</Link>
          </div>
        )}
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>;
}
