import { describe, it, expect } from "vitest";
import { searchSuggestions, SEARCH_HINT_KEYS, ROTATE_MS, SLIDE_MS } from "./searchHints";
import { t } from "./i18n";

// The rotating suggestions: which, in which order, in each language.
const say = (lang: "en" | "ar") => searchSuggestions(((key: string) => t(lang, key as never)) as never);
describe("the suggestions", () => {
  it("start with the box's normal sentence (so it looks the same until it first slides), then four examples", () => {
    const en = say("en"); expect(en).toHaveLength(5); expect(en[0]).toBe("Search by part name, part number or VIN"); expect(en.slice(1)).toEqual(["Search “brake pads”", "Search “oil filter”", "Search by OEM number, e.g. 12345-67890", "Search by VIN or by car, e.g. BYD Seal"]);
  });
  it("exist in Arabic too (Arabic words, the normal Arabic sentence first), and every one is different", () => {
    const ar = say("ar"); expect(ar).toHaveLength(5); expect(ar[0]).toBe("ابحث باسم القطعة أو رقمها أو رقم الهيكل"); for (const s of ar) expect(s).toMatch(/[\u0600-\u06FF]/); expect(new Set(ar).size).toBe(5); expect(new Set(say("en")).size).toBe(5);
  });
  it("every key has a translation in both languages (none shows as a raw key)", () => { for (const lang of ["en", "ar"] as const) for (const k of SEARCH_HINT_KEYS) { const v = t(lang, k as never); expect(v, `${lang} ${k}`).not.toBe(k); expect(v.length).toBeGreaterThan(5); } });
  it("each suggestion stays 3 seconds and the slide takes half a second (the slide is much shorter than the stay)", () => { expect(ROTATE_MS).toBe(3000); expect(SLIDE_MS).toBe(500); expect(SLIDE_MS).toBeLessThan(ROTATE_MS / 3); });
});
