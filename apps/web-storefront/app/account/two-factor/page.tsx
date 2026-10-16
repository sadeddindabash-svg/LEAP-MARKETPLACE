"use client";

import { useState } from "react";
import Link from "@/components/LocLink";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useT } from "@/components/LangProvider";
import { confirmTwoFactor, disableTwoFactor, setupTwoFactor } from "@/lib/api";
import { isSixDigitCode, normalizeCode } from "@/lib/auth";

const input = "min-h-12 w-full rounded-[10px] border-[1.5px] border-[#c5d0d8] bg-white px-3 text-[15px] text-ink";
const primary = "inline-flex min-h-12 items-center justify-center rounded-[10px] bg-signal px-6 font-bold text-on-signal hover:bg-signal-dark disabled:opacity-60";

// Two-factor authentication, like the app: turn it on (scan the code with an authenticator app, then give the 6-digit code it shows) or off (with the current password).
export default function TwoFactorPage() {
  const { user, isLoading, refreshUser } = useAuth();
  const t = useT();
  const [setup, setSetup] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  if (isLoading) return <div aria-busy="true">{t("loading_account")}</div>;
  if (!user) return <Link href="/login?next=%2Faccount%2Ftwo-factor" className="inline-flex min-h-12 items-center rounded-[10px] bg-signal px-6 font-bold text-on-signal">{t("log_in")}</Link>;

  const run = async (work: (token: string) => Promise<void>) => {
    const token = getAuthToken();
    if (!token) return;
    setBusy(true); setMessage(null);
    try { await work(token); } catch (err) { setMessage({ kind: "error", text: err instanceof Error && err.message ? err.message : t("something_went_wrong") }); } finally { setBusy(false); }
  };

  const start = () => run(async (token) => setSetup(await setupTwoFactor(token)));
  const confirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSixDigitCode(code)) return setMessage({ kind: "error", text: t("two_factor_enter_code") });
    return run(async (token) => { await confirmTwoFactor(token, normalizeCode(code)); await refreshUser(); setSetup(null); setCode(""); setMessage({ kind: "ok", text: t("two_factor_now_on") }); });
  };
  const turnOff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    return run(async (token) => { await disableTwoFactor(token, password); await refreshUser(); setPassword(""); setMessage({ kind: "ok", text: t("two_factor_now_off") }); });
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-3xl font-bold tracking-tight text-navy">{t("two_factor_title")}</h1>
      <p className="mb-5 mt-2 text-muted">{t("two_factor_description")}</p>
      <div className="grid gap-4 rounded-[14px] border border-line bg-white p-6">
        {user.twoFactorEnabled ? (
          <form onSubmit={turnOff} noValidate className="grid gap-4">
            <p className="font-bold text-[#0f6b49]">{t("two_factor_is_on")}</p>
            <div><label htmlFor="tf-pw" className="mb-1.5 block text-[13px] font-bold text-navy">{t("two_factor_enter_password_to_disable")}</label><input id="tf-pw" type="password" autoComplete="current-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <button type="submit" disabled={busy || !password} className="min-h-12 rounded-[10px] border-[1.5px] border-[#a12a21] font-bold text-[#a12a21] hover:bg-[#fdf2f1] disabled:opacity-50">{t("two_factor_turn_off")}</button>
          </form>
        ) : setup ? (
          <form onSubmit={confirm} noValidate className="grid gap-4">
            <p>{t("two_factor_scan_qr")}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qrCodeDataUrl} alt={t("qr_alt")} width={200} height={200} className="rounded-lg border border-line" />
            <p className="text-sm text-muted">{t("two_factor_manual_key")} <code className="font-plate font-semibold text-ink" dir="ltr">{setup.secret}</code></p>
            <div><label htmlFor="tf-code" className="mb-1.5 block text-[13px] font-bold text-navy">{t("two_factor_enter_code")}</label><input id="tf-code" inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={7} className={`${input} text-center font-plate text-xl tracking-[0.4em]`} value={code} onChange={(e) => setCode(e.target.value)} /></div>
            <button type="submit" disabled={busy} className={primary}>{t("two_factor_confirm_turn_on")}</button>
          </form>
        ) : (
          <button type="button" onClick={start} disabled={busy} className={primary}>{t("two_factor_turn_on")}</button>
        )}
        {message && <p role={message.kind === "error" ? "alert" : "status"} className={`text-sm font-semibold ${message.kind === "error" ? "text-[#a12a21]" : "text-[#0f6b49]"}`}>{message.text}</p>}
      </div>
    </div>
  );
}
