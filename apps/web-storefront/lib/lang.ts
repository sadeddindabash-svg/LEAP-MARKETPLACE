import { headers } from "next/headers";
import { DEFAULT_LANG, LANG_HEADER, type Lang } from "./i18n";

/** The language of the page being rendered (set by proxy.ts from the address). Server Components only. */
export async function getLang(): Promise<Lang> {
  try {
    return (await headers()).get(LANG_HEADER) === "ar" ? "ar" : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;      // outside a request (a build step, a test): English
  }
}
