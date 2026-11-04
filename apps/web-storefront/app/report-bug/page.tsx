"use client";

import { useState } from "react";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useT } from "@/components/LangProvider";
import { submitBugReport, uploadReviewPhoto } from "@/lib/api";

// Report a bug, like the app's screen: what happened (needed), and a screenshot for a signed-in buyer (it is uploaded first, like the app; a guest is told it
// needs a sign-in). The report is sent with what the browser is, then thanked. A failure keeps what was typed. In the look of the account pages: a white card
// with a small gold label, the screenshot in a light gold box, and the thanks in a card with a gold tick.
export default function ReportBugPage() {
  const { user } = useAuth();
  const t = useT();
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit() {
    const text = description.trim();
    if (!text) { setError(t("fill_every_field")); return; }
    setBusy(true); setError(null);
    const token = getAuthToken();
    let screenshotUrl: string | null = null;
    if (user && file && token) {
      // the server's own reason when it refuses the picture (too small, not an image); nothing is sent without it
      try { screenshotUrl = await uploadReviewPhoto(token, file); } catch (err) { setError(err instanceof Error ? err.message : t("report_bug_submit_error")); setBusy(false); return; }
    }
    try {
      const deviceInfo = `Web · ${typeof navigator !== "undefined" ? navigator.userAgent : ""}`.trim();
      await submitBugReport({ description: text, screenshotUrl, deviceInfo }, token ?? null);
      setSent(true);
    } catch {
      setError(t("report_bug_submit_error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-navy">{t("report_bug_title")}</h1>
      {sent ? (
        <p role="status" className="mt-6 flex items-center gap-4 rounded-[16px] border border-line bg-white p-6 font-bold text-navy">
          <span aria-hidden="true" className="grid size-11 flex-none place-items-center rounded-full bg-white text-lg font-black text-navy ring-[3px] ring-signal">✓</span>
          <span>{t("report_bug_thanks")}</span>
        </p>
      ) : (
        <form className="mt-6 grid gap-4 rounded-[16px] border border-line bg-white p-5 sm:p-6" noValidate onSubmit={(e) => { e.preventDefault(); if (!busy) void submit(); }}>
          <label className="grid gap-2">
            <span className="text-xs font-extrabold uppercase tracking-[.14em] text-[#8a6100] rtl:tracking-normal">{t("report_bug_what_happened")}</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} placeholder={t("report_bug_hint")} className="rounded-[10px] border-[1.5px] border-line px-3 py-2.5 text-[15px] focus:border-navy focus:outline-none" />
          </label>
          {user ? (
            <div className="grid gap-1.5">
              {/* the browser's own file button speaks the browser's language ("Choose file"): this one speaks the site's */}
              <label className="flex cursor-pointer flex-wrap items-center gap-3 rounded-[12px] border-[1.5px] border-dashed border-signal bg-[#fffaeb] p-4 transition-colors hover:bg-[#fff4d6]">
                <input type="file" accept="image/*" aria-labelledby="bug-shot-label" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="sr-only" />
                <span aria-hidden="true" className="grid size-10 flex-none place-items-center rounded-full bg-white text-[#8a6100] ring-1 ring-signal"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7-7l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9" /></svg></span>
                <span className="min-w-0 flex-1">
                  <span id="bug-shot-label" className="block text-sm font-bold text-navy">{t("report_bug_attach")}</span>
                  <span className="block truncate text-xs text-muted" dir="auto">{file ? file.name : t("no_file_chosen")}</span>
                </span>
                <span className="rounded-[10px] border-[1.5px] border-navy bg-white px-4 py-2 text-sm font-bold text-navy">{t("choose_file")}</span>
              </label>
              {file && <span className="text-sm font-semibold text-[#1e7a4f]">{t("report_bug_attached")}</span>}
            </div>
          ) : (
            <p className="rounded-[12px] bg-[#e6eef4] px-4 py-3 text-sm font-semibold text-navy">{t("bug_screenshot_login")}</p>
          )}
          {error && <p role="alert" className="text-sm font-semibold text-[#a12a21]">{error}</p>}
          <button type="submit" disabled={busy} className="inline-flex min-h-11 items-center justify-self-start rounded-[10px] bg-signal px-6 font-bold text-on-signal hover:bg-signal-dark disabled:opacity-60">{busy ? t("sending") : t("report_bug_submit")}</button>
        </form>
      )}
    </div>
  );
}
