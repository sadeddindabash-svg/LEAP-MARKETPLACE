import { describe, it, expect, vi, afterEach } from "vitest";
import { gridQuery, parseGridQuery, type GridSource } from "./gridSource";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fetchProductsPaginated } from "./api";

// The buyer's VERSION travels with the "Parts Fit with my Car" filter: in the lazy-loaded pages, and to the shop's API.
const parse = (query: string) => parseGridQuery(new URLSearchParams(query));
const withVersion: GridSource = { kind: "search", params: { q: "disc", category: "brake", generationId: "gen_bmw_f20", year: 2017, versionId: "ver_awd_1" } };

describe("the lazily loaded list carries the version", () => {
  it("CRITICAL: what the browser asks is exactly what the website's door reads back, with a version, without one, and in both languages", () => {
    for (const source of [withVersion, { kind: "search", params: { generationId: "g", year: 2020 } } as GridSource, { kind: "search", params: {} } as GridSource]) for (const lang of ["en", "ar"] as const) {
      expect(parse(gridQuery(source, 2, 24, lang))).toEqual({ source, page: 2, limit: 24, lang });
    }
  });
  it("the address carries versionId only when there is one (a list without a version is asked for exactly as before)", () => {
    expect(gridQuery(withVersion, 1, 24, "en")).toContain("versionId=ver_awd_1");
    expect(gridQuery({ kind: "search", params: { generationId: "g", year: 2020 } }, 1, 24, "en")).not.toContain("versionId");
  });
  it("a version that is not a plain id is refused, never passed on to the shop's API", () => {
    for (const bad of ["a b", "x;drop", "a/b", "x".repeat(121)]) expect(parse(`kind=search&versionId=${encodeURIComponent(bad)}`)).toEqual({ error: "versionId is not valid" });
  });
});

describe("the shop's API is asked with the version", () => {
  afterEach(() => { vi.restoreAllMocks(); });
  const run = async (params: Parameters<typeof fetchProductsPaginated>[0]) => {
    const urls: string[] = []; vi.stubGlobal("fetch", vi.fn(async (url: string) => { urls.push(String(url)); return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json", "X-Total-Count": "0" } }); }));
    await fetchProductsPaginated(params); vi.unstubAllGlobals(); return urls[0] ?? "";
  };
  it("CRITICAL: versionId is sent with generationId and year", async () => { const url = await run({ generationId: "g1", year: 2023, versionId: "v2" }); expect(url).toContain("generationId=g1"); expect(url).toContain("year=2023"); expect(url).toContain("versionId=v2"); });
  it("without a version nothing is added (as before)", async () => { expect(await run({ generationId: "g1", year: 2023 })).not.toContain("versionId"); });
});

// The files that have no test of their own: the website's products route, the search page and the manual car filter pass the version on / drop it (read from the code).
const file = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");
describe("the version is passed along, and dropped when the car is changed by hand", () => {
  it("the website's own products route passes the version of a lazy-loaded list to the shop's API", () => {
    const s = file("app/api/products/route.ts"); expect(s).toContain("const { q, category, part, generationId, year, versionId } = source.params;"); expect(s).toContain("generationId, year, versionId, page, limit, lang, more: true");
  });
  it("the search page reads the version from the address and passes it to the first page AND the lazy-loaded pages", () => {
    const s = file("app/search/page.tsx"); expect(s).toContain("generationId, year, versionId, page } = await searchParams;"); expect(s).toContain("year: year ? Number(year) : undefined, versionId, page: pageNum,"); expect(s).toContain("year: year ? Number(year) : undefined, versionId } }}");
  });
  it("choosing another car by hand (or clearing it) drops the switch's version, which no longer belongs to the car", () => {
    const s = file("components/VehicleFilter.tsx"); expect(s.split('params.delete("versionId")').length - 1).toBe(2);
  });
});
