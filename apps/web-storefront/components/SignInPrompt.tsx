"use client";

import Link from "@/components/LocLink";
import { useT } from "./LangProvider";
import type { DictKey } from "@/lib/i18n";
import { loginHrefFor } from "@/lib/auth";

/** What a page shows a visitor who is not signed in: why signing in matters here, and a button that brings them BACK to the page afterwards. */
export default function SignInPrompt({ messageKey, next }: { messageKey: DictKey; next: string }) {
  const t = useT();
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-center sm:px-8">
      <p className="mb-5 text-lg text-muted">{t(messageKey)}</p>
      <Link href={loginHrefFor(next)} className="inline-flex min-h-12 items-center rounded-[10px] bg-signal px-6 font-bold text-on-signal hover:bg-signal-dark">{t("log_in")}</Link>
    </div>
  );
}
