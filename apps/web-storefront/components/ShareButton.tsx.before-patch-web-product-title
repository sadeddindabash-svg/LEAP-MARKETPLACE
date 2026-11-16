"use client";

import { useState } from "react";
import { useT } from "./LangProvider";

/** Shares the page: the phone's or the browser's own share sheet when there is one, otherwise the link is copied (and it says so). */
export default function ShareButton({ title }: { title: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* the buyer closed the share sheet, or the browser refused: nothing to report */ }
  };
  return (
    <button type="button" onClick={share} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-bold text-navy underline underline-offset-4 hover:bg-chalk">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 11l7.6-4M8.2 13l7.6 4" /></svg>
      {t("share")}
      <span role="status" className="text-[#0f6b49]">{copied ? t("link_copied") : ""}</span>
    </button>
  );
}
