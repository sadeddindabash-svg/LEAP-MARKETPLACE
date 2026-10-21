// What a lazily loaded list is a list OF, and how the browser asks the website's own server (app/api/products/route.ts) for its next page. The browser never calls the shop's
// API for this itself: the website's server does, exactly as it does for the first page, so every page of one list is made the same way (same cache, same delivery
// estimates, nothing else exposed). This file is used by BOTH sides so the asking and the checking cannot drift apart.
import type { Lang } from "./i18n";

export type GridSource =
  | { kind: "search"; params: { q?: string; category?: string; part?: string; generationId?: string; year?: number } }
  | { kind: "sameBrand"; productId: string }
  | { kind: "newest" };

export const GRID_DEFAULT_PAGE_SIZE = 24;
export const GRID_MAX_PAGE_SIZE = 48;
const MAX_PAGE = 1000;

/** The address query for one page of a list: only what the source needs. */
export function gridQuery(source: GridSource, page: number, pageSize: number, lang: Lang): string {
  const q = new URLSearchParams({ kind: source.kind, page: String(page), limit: String(pageSize) });
  if (lang === "ar") q.set("lang", "ar");
  if (source.kind === "sameBrand") q.set("productId", source.productId);
  if (source.kind === "search") {
    const { q: text, category, part, generationId, year } = source.params;
    if (text) q.set("q", text);
    if (category) q.set("category", category);
    if (part) q.set("part", part);
    if (generationId) q.set("generationId", generationId);
    if (year) q.set("year", String(year));
  }
  return q.toString();
}

export type ParsedGrid = { source: GridSource; page: number; limit: number; lang: Lang };
const ID = /^[\w.:\-]{1,120}$/;                                    // product, category, part and generation ids look like p_123, brake, gen_bmw_1_series_f20

/** Reads and CHECKS what the browser asked for. Anything unexpected is refused with a reason (never passed on to the shop's API). */
export function parseGridQuery(sp: URLSearchParams): ParsedGrid | { error: string } {
  const kind = sp.get("kind") ?? "search";
  const whole = (value: string | null, fallback: number, min: number, max: number): number | null => {
    if (value === null) return fallback;
    if (!/^\d{1,6}$/.test(value)) return null;
    const n = Number(value);
    return n >= min && n <= max ? n : null;
  };
  const page = whole(sp.get("page"), 1, 1, MAX_PAGE);
  const limit = whole(sp.get("limit"), GRID_DEFAULT_PAGE_SIZE, 1, GRID_MAX_PAGE_SIZE);
  if (page === null) return { error: "page must be a whole number from 1 to 1000" };
  if (limit === null) return { error: `limit must be a whole number from 1 to ${GRID_MAX_PAGE_SIZE}` };
  const lang: Lang = sp.get("lang") === "ar" ? "ar" : "en";
  if (kind === "newest") return { source: { kind: "newest" }, page, limit, lang };
  if (kind === "sameBrand") {
    const productId = sp.get("productId") ?? "";
    return ID.test(productId) ? { source: { kind: "sameBrand", productId }, page, limit, lang } : { error: "productId is missing or not valid" };
  }
  if (kind !== "search") return { error: "kind must be search, sameBrand or newest" };
  const params: { q?: string; category?: string; part?: string; generationId?: string; year?: number } = {};
  const text = sp.get("q");
  if (text) { if (text.length > 200) return { error: "q is too long" }; params.q = text; }
  for (const name of ["category", "part", "generationId"] as const) {
    const value = sp.get(name);
    if (value) { if (!ID.test(value)) return { error: `${name} is not valid` }; params[name] = value; }
  }
  const year = sp.get("year");
  if (year) { const y = whole(year, 0, 1900, 2100); if (!y) return { error: "year is not valid" }; params.year = y; }
  return { source: { kind: "search", params }, page, limit, lang };
}
