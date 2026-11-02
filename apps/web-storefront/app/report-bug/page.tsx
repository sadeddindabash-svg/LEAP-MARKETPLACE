"use client";

import { useState } from "react";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useT } from "@/components/LangProvider";
import { submitBugReport, uploadReviewPhoto } from "@/lib/api";

// Report a bug, like the app's screen: what happened (needed), and a screenshot for a signed-in buyer (it is uploaded first, like the app; a guest is told it
// needs a sign-in). The report is sent with what the browser is, then thanked. A failure keeps what was typed.
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
        <p role="status" className="mt-6 rounded-[14px] border border-line bg-white p-6 font-semibold text-navy">{t("report_bug_thanks")}</p>
      ) : (
        <form className="mt-6 grid gap-4 rounded-[14px] border border-line bg-white p-6" noValidate onSubmit={(e) => { e.preventDefault(); if (!busy) void submit(); }}>
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-ink">{t("report_bug_what_happened")}</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} placeholder={t("report_bug_hint")} className="rounded-lg border border-line px-3 py-2 text-[15px]" />
          </label>
          {user ? (
            <div className="grid gap-1.5">
              <span id="bug-shot-label" className="text-sm font-semibold text-ink">{t("report_bug_attach")}</span>
              {/* the browser's own file button speaks the browser's language ("Choose file"): this one speaks the site's */}
              <label className="flex cursor-pointer flex-wrap items-center gap-3">
                <input type="file" accept="image/*" aria-labelledby="bug-shot-label" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="sr-only" />
                <span className="rounded-lg border border-line bg-chalk px-4 py-2 text-sm font-semibold text-navy">{t("choose_file")}</span>
                <span className="min-w-0 truncate text-sm text-muted" dir="auto">{file ? file.name : t("no_file_chosen")}</span>
              </label>
              {file && <span className="text-sm font-semibold text-[#1e7a4f]">{t("report_bug_attached")}</span>}
            </div>
          ) : (
            <p className="text-sm text-muted">{t("bug_screenshot_login")}</p>
          )}
          {error && <p role="alert" className="text-sm font-semibold text-[#a12a21]">{error}</p>}
          <button type="submit" disabled={busy} className="justify-self-start rounded-lg bg-signal px-5 py-2.5 font-semibold text-on-signal disabled:opacity-60">{busy ? t("sending") : t("report_bug_submit")}</button>
        </form>
      )}
    </div>
  );
}
