import { NextResponse, type NextRequest } from "next/server";
import { LANG_HEADER, splitLang } from "@/lib/i18n";

// The language is part of the address: /ar/search is the Arabic search page, /search the English one. This turns /ar/... into the normal route (so every page
// exists once) and tells the page which language was asked for in a header. The header is ALWAYS set here, overwriting anything the visitor sent, so it cannot be spoofed.
export function proxy(request: NextRequest) {
  const { lang, path } = splitLang(request.nextUrl.pathname);
  const headers = new Headers(request.headers);
  headers.set(LANG_HEADER, lang);
  if (lang === "ar") {
    const url = request.nextUrl.clone();
    url.pathname = path;
    return NextResponse.rewrite(url, { request: { headers } });
  }
  return NextResponse.next({ request: { headers } });
}

// Pages only: not Next's own files, the API, or files with an extension (favicon, robots.txt, sitemap.xml, images).
export const config = { matcher: ["/((?!_next/|api/|.*\\..*).*)"] };
