"use client";

import { createContext, useCallback, useContext, useEffect } from "react";
import { setErrorLanguage } from "@/lib/serverMessages";
import { t, type DictKey, type Lang } from "@/lib/i18n";

const LangContext = createContext<Lang>("en");

/** Hands the page's language to every Client Component below it (the layout sets it from the address). */
export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  useEffect(() => { setErrorLanguage(lang); }, [lang]);                       // errors made inside API calls are written in this language
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export const useLang = (): Lang => useContext(LangContext);

/** useT()("add_to_cart"): the text in the page's language. */
export function useT() {
  const lang = useLang();
  return useCallback((key: DictKey, vars?: Record<string, string | number>) => t(lang, key, vars), [lang]);
}
