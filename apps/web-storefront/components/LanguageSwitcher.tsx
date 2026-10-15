"use client";

import { usePathname, useSearchParams } from "next/navigation";
import NextLink from "next/link";
import { switchLangPath } from "@/lib/i18n";
import { useLang, useT } from "./LangProvider";

/** Opens the same page in the other language (a real link, so a search engine and a keyboard both follow it). */
export default function LanguageSwitcher() {
  const lang = useLang();
  const t = useT();
  const pathname = usePathname() || "/";
  const search = useSearchParams().toString();
  const to = lang === "ar" ? "en" : "ar";
  return (
    <NextLink href={switchLangPath(pathname, search, to)} hrefLang={to} lang={to} className="hover:underline" prefetch={false}>
      {t("other_language_name")}
    </NextLink>
  );
}
