// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "./proxy";

const call = (url: string, headers: Record<string, string> = {}) => proxy(new NextRequest(`http://localhost:3001${url}`, { headers }));
const langSentOn = (res: Response) => res.headers.get("x-middleware-request-x-leap-lang");

describe("proxy: the language is part of the address", () => {
  it("CRITICAL: /ar/... is served by the normal page (a rewrite, the address in the browser stays /ar/...) and the page is told it is Arabic", () => {
    const res = call("/ar/search?category=brake");
    expect(res.headers.get("x-middleware-rewrite")).toBe("http://localhost:3001/search?category=brake");
    expect(langSentOn(res)).toBe("ar");
    expect(call("/ar").headers.get("x-middleware-rewrite")).toBe("http://localhost:3001/");
    expect(call("/ar/products/p1").headers.get("x-middleware-rewrite")).toBe("http://localhost:3001/products/p1");
  });

  it("an address without a prefix is English and is not rewritten", () => {
    const res = call("/search?q=disc");
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(langSentOn(res)).toBe("en");
    expect(langSentOn(call("/"))).toBe("en");
  });

  it("CRITICAL: a visitor cannot choose the language by sending the header themselves", () => {
    expect(langSentOn(call("/search", { "x-leap-lang": "ar" }))).toBe("en");
    expect(langSentOn(call("/ar/search", { "x-leap-lang": "en" }))).toBe("ar");
  });

  it("only real pages are handled: Next's own files, the API and files with an extension are not", () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    for (const page of ["/", "/search", "/ar/search", "/products/p1", "/ar"]) expect(matcher.test(page), page).toBe(true);
    for (const other of ["/_next/static/x.js", "/_next/image", "/api/anything", "/favicon.ico", "/robots.txt", "/sitemap.xml", "/leap-logo.png"]) expect(matcher.test(other), other).toBe(false);
  });
});
