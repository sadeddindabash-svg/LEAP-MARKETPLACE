"use client";

import { createContext, useCallback, useContext } from "react";
import { t, type DictKey, type Lang } from "@/lib/i18n";

const LangContext = createContext<Lang>("en");

/** Hands the page's language to every Client Component below it (the layout sets it from the address). */
export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export const useLang = (): Lang => useContext(LangContext);

/** useT()("add_to_cart"): the text in the page's language. */
export function useT() {
  const lang = useLang();
  return useCallback((key: DictKey, vars?: Record<string, string | number>) => t(lang, key, vars), [lang]);
}
