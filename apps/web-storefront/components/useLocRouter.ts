"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { localizePath } from "@/lib/i18n";
import { useLang } from "./LangProvider";

/** useRouter() whose push and replace keep the visitor's language (in Arabic, router.push("/cart") opens /ar/cart). */
export function useLocRouter() {
  const router = useRouter();
  const lang = useLang();
  return useMemo(() => ({
    ...router,
    push: (href: string, options?: Parameters<typeof router.push>[1]) => router.push(localizePath(lang, href), options),
    replace: (href: string, options?: Parameters<typeof router.replace>[1]) => router.replace(localizePath(lang, href), options),
  }), [router, lang]);
}
