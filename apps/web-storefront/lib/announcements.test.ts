import { describe, it, expect } from "vitest";
import { MAX_ANNOUNCEMENTS, announcementTexts, tickerSeconds } from "./announcements";

describe("what the home page's announcement line shows", () => {
  const list = [{ en: "Free delivery", ar: "توصيل مجاني" }, { en: "Open now", ar: "" }, { en: "  ", ar: "نص" }, { en: "Shipping 3-7 days", ar: "  " }];
  it("CRITICAL: the English site shows the English text; the Arabic site shows the Arabic text and the English where there is none", () => {
    expect(announcementTexts(list, "en")).toEqual(["Free delivery", "Open now", "Shipping 3-7 days"]);
    expect(announcementTexts(list, "ar")).toEqual(["توصيل مجاني", "Open now", "Shipping 3-7 days"]);
  });
  it("a line with no English is dropped in both languages (the admin must give English)", () => {
    for (const lang of ["en", "ar"] as const) expect(announcementTexts([{ en: "", ar: "عربي" }], lang)).toEqual([]);
  });
  it("never more than 5, and damaged entries are ignored", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ en: `Line ${i}`, ar: "" }));
    expect(announcementTexts(many, "en")).toHaveLength(MAX_ANNOUNCEMENTS);
    expect(announcementTexts([null, undefined, { en: 5 }, { en: "ok", ar: 7 }] as never, "ar")).toEqual(["ok"]);
    expect(announcementTexts([], "en")).toEqual([]);
  });
  it("the trip takes longer for more to read, but never under 20 seconds or over 2 minutes", () => {
    expect(tickerSeconds(["Hi"])).toBe(20);
    const a = tickerSeconds(["x".repeat(100)]), b = tickerSeconds(["x".repeat(200)]);
    expect(b).toBeGreaterThan(a);
    expect(a).toBeGreaterThan(20);
    expect(tickerSeconds(["x".repeat(5000)])).toBe(120);
  });
});
