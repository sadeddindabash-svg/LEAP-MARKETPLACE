"use client";

import { useT } from "@/components/LangProvider";

// What a buyer sees if a page fails to render (most often because the shop's server cannot be reached): a plain explanation and a button to try again, never a bare
// "Internal Server Error". Next hides the technical cause from visitors; it stays in the server's log.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-navy">{t("error_page_title")}</h1>
      <p className="mb-6 mt-3 text-lg text-muted">{t("error_page_body")}</p>
      <button type="button" onClick={reset} className="inline-flex min-h-12 items-center rounded-[10px] bg-signal px-6 font-bold text-on-signal hover:bg-signal-dark">{t("try_again")}</button>
    </div>
  );
}
