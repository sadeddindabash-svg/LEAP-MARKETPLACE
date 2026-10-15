import { describe, it, expect } from "vitest";
import { DICTIONARIES, languageAlternates, localizePath, pickName, splitLang, switchLangPath, t, type DictKey } from "./i18n";

describe("addresses carry the language", () => {
  it("CRITICAL: splitLang reads the language from the address, and only a real /ar prefix counts", () => {
    expect(splitLang("/ar")).toEqual({ lang: "ar", path: "/" });
    expect(splitLang("/ar/search")).toEqual({ lang: "ar", path: "/search" });
    expect(splitLang("/ar/products/p1")).toEqual({ lang: "ar", path: "/products/p1" });
    expect(splitLang("/search")).toEqual({ lang: "en", path: "/search" });
    expect(splitLang("/")).toEqual({ lang: "en", path: "/" });
    expect(splitLang("/arabic-parts")).toEqual({ lang: "en", path: "/arabic-parts" });     // not the prefix
    expect(splitLang("/art")).toEqual({ lang: "en", path: "/art" });
  });

  it("CRITICAL: localizePath prefixes internal paths in Arabic, once, and leaves English and everything that is not an internal path alone", () => {
    expect(localizePath("ar", "/")).toBe("/ar");
    expect(localizePath("ar", "/cart")).toBe("/ar/cart");
    expect(localizePath("ar", "/search?category=brake&page=2")).toBe("/ar/search?category=brake&page=2");
    expect(localizePath("ar", "/?q=1")).toBe("/ar?q=1");
    expect(localizePath("ar", "/ar/cart")).toBe("/ar/cart");                              // already prefixed: never /ar/ar
    expect(localizePath("ar", "/ar")).toBe("/ar");
    expect(localizePath("ar", "/arabic-parts")).toBe("/ar/arabic-parts");                // only a REAL prefix counts
    expect(localizePath("en", "/cart")).toBe("/cart");
    for (const outside of ["https://example.com/x", "//cdn.example.com/x", "#top", "mailto:a@b.c", "tel:123", "relative/path"]) expect(localizePath("ar", outside)).toBe(outside);
  });

  it("the language switch keeps the page and its query string, in both directions", () => {
    expect(switchLangPath("/search", "category=brake", "ar")).toBe("/ar/search?category=brake");
    expect(switchLangPath("/ar/search", "category=brake", "en")).toBe("/search?category=brake");
    expect(switchLangPath("/", "", "ar")).toBe("/ar");
    expect(switchLangPath("/ar", "", "en")).toBe("/");
    expect(switchLangPath("/products/p1", "?x=1", "ar")).toBe("/ar/products/p1?x=1");
    expect(switchLangPath("/ar/products/p1", "", "ar")).toBe("/ar/products/p1");         // switching to the language it is already in changes nothing
  });

  it("the hreflang set lists each language's own address, and the default", () => {
    const abs = (p: string) => `https://shop.example.com${p === "/" ? "" : p}`;
    expect(languageAlternates("/products/p1", abs)).toEqual({ en: "https://shop.example.com/products/p1", ar: "https://shop.example.com/ar/products/p1", "x-default": "https://shop.example.com/products/p1" });
    expect(languageAlternates("/", abs)).toEqual({ en: "https://shop.example.com", ar: "https://shop.example.com/ar", "x-default": "https://shop.example.com" });
  });
});

describe("the dictionaries", () => {
  const NEUTRAL = new Set<string>(["rating_value"]);
  const keys = Object.keys(DICTIONARIES.en) as DictKey[];
  const placeholders = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(",");

  it("CRITICAL: every English text has an Arabic text, and it is real Arabic (not a copy of the English)", () => {
    expect(keys.length).toBeGreaterThan(60);
    expect(Object.keys(DICTIONARIES.ar).sort()).toEqual([...keys].sort());
    // (in Arabic the language switch names the OTHER language, "English", which is correctly Latin letters)
    const bad = keys.filter((k) => {
      const ar = DICTIONARIES.ar[k];
      if (k === "other_language_name") return ar !== "English";
      if (NEUTRAL.has(k)) return ar !== DICTIONARIES.en[k];                      // only numbers and brackets: identical in both languages on purpose
      return !ar.trim() || !/[\u0600-\u06FF]/.test(ar) || ar === DICTIONARIES.en[k];
    });
    expect(bad).toEqual([]);
  });

  it("CRITICAL: both languages use the same {placeholders}, so a number or a name is never lost in translation", () => {
    expect(keys.filter((k) => placeholders(DICTIONARIES.en[k]) !== placeholders(DICTIONARIES.ar[k]))).toEqual([]);
  });

  it("t fills placeholders, falls back to English for a language it does not know, and never returns blank", () => {
    expect(t("en", "delivery_in_days", { n: 7 })).toBe("Delivery in 7 days");
    expect(t("ar", "delivery_in_days", { n: 7 })).toBe("التوصيل خلال 7 أيام");
    expect(t("en", "search_results_for", { q: "disc" })).toBe('Search results for "disc"');
    expect(t("en", "reviews_count")).toBe("{n} reviews");                                    // a placeholder with no value stays visible rather than vanishing
    expect(t("fr" as never, "add_to_cart")).toBe("Add to cart");
    expect(t("en", "no_such_key" as DictKey)).toBe("no_such_key");
  });

  it("the language names are each written in their own language", () => {
    expect(t("en", "language_name")).toBe("English");
    expect(t("en", "other_language_name")).toBe("العربية");
    expect(t("ar", "language_name")).toBe("العربية");
    expect(t("ar", "other_language_name")).toBe("English");
  });

  it("pickName uses the Arabic name in Arabic when there is one, the English name otherwise", () => {
    expect(pickName("ar", "Brake System", "نظام الفرامل")).toBe("نظام الفرامل");
    expect(pickName("ar", "Brake System", null)).toBe("Brake System");
    expect(pickName("ar", "Brake System", "  ")).toBe("Brake System");
    expect(pickName("en", "Brake System", "نظام الفرامل")).toBe("Brake System");
  });
});
