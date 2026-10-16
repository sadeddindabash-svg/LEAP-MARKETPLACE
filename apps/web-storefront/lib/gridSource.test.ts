import { describe, it, expect } from "vitest";
import { gridQuery, parseGridQuery, GRID_MAX_PAGE_SIZE, type GridSource } from "./gridSource";

const parse = (query: string) => parseGridQuery(new URLSearchParams(query));
const SOURCES: GridSource[] = [
  { kind: "search", params: { q: "brake disc", category: "brake", part: "disc", generationId: "gen_bmw_1_series_f20", year: 2017 } },
  { kind: "search", params: {} },
  { kind: "sameBrand", productId: "p_1791364564926" },
  { kind: "newest" },
];

describe("how a lazily loaded list is asked for, and checked", () => {
  it("CRITICAL: what the browser asks is exactly what the website's door reads back (every kind of list, both languages)", () => {
    for (const source of SOURCES) for (const lang of ["en", "ar"] as const) {
      const back = parse(gridQuery(source, 3, 24, lang));
      expect(back).toEqual({ source, page: 3, limit: 24, lang });
    }
  });
  it("only the words the source needs are sent", () => {
    expect(gridQuery({ kind: "newest" }, 2, 10, "en")).toBe("kind=newest&page=2&limit=10");
    expect(gridQuery({ kind: "search", params: { q: "a b" } }, 1, 24, "ar")).toBe("kind=search&page=1&limit=24&lang=ar&q=a+b");
  });
  it("defaults: a search for page 1 of 24 in English", () => {
    expect(parse("")).toEqual({ source: { kind: "search", params: {} }, page: 1, limit: 24, lang: "en" });
  });
  it("CRITICAL: anything unexpected is refused with a reason, never passed on", () => {
    for (const bad of ["page=0", "page=1001", "page=abc", "page=1.5", "page=-1", "page=%20", "limit=0", `limit=${GRID_MAX_PAGE_SIZE + 1}`, "limit=1000000", "kind=admin", "kind=sameBrand",
      "kind=sameBrand&productId=a%20b", "kind=sameBrand&productId=../secret", "category=../../etc", "category=a/b", "part=%3Cscript%3E", "generationId=x%0Ay", "year=1800", "year=abc", `q=${"x".repeat(201)}`]) {
      expect("error" in parse(bad), bad).toBe(true);
    }
  });
  it("a search text of up to 200 characters, and real ids with letters, digits, _ - . : are fine; an unknown language is English; extra words are ignored", () => {
    expect("error" in parse(`q=${"x".repeat(200)}`)).toBe(false);
    expect("error" in parse("category=test_cat_shipapi_1791961195212&generationId=gen_toyota_camry_xv70&year=2019")).toBe(false);
    expect(parse("lang=fr")).toMatchObject({ lang: "en" });
    expect(parse("sneaky=1&limit=10")).toMatchObject({ limit: 10 });
  });
});
