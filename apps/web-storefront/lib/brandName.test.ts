import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DICTIONARIES, t } from "./i18n";

// The header name: "Leap Auto Parts" in English and "ليب لقطع السيارات" in Arabic, all one colour; and the Arabic sentences write the name in Arabic.
const root = join(__dirname, "..");
describe("the name in the header", () => {
  it("English: Leap + Auto Parts; Arabic: ليب + لقطع السيارات, which together are the Arabic name the site already uses for the logo's description, the page title and the copyright line", () => {
    expect(t("en", "brand_lead")).toBe("Leap"); expect(t("en", "brand_rest")).toBe("Auto Parts"); expect(t("ar", "brand_lead")).toBe("ليب"); expect(t("ar", "brand_rest")).toBe("لقطع السيارات");
    const arName = `${t("ar", "brand_lead")} ${t("ar", "brand_rest")}`; expect(arName).toBe("ليب لقطع السيارات"); expect(t("ar", "logo_home_label")).toContain(arName); expect(t("ar", "site_title")).toContain(arName); expect(t("ar", "copyright", { year: 2026 })).toContain(arName); expect(t("en", "logo_home_label")).toContain(`${t("en", "brand_lead")} ${t("en", "brand_rest")}`);
  });
  it("the header uses those words (not a fixed English name), both words in the same colour (no opacity on the second), and no tight letter spacing in Arabic", () => {
    const s = readFileSync(join(root, "components/SiteHeader.tsx"), "utf8"); expect(s).toContain('{t(lang, "brand_lead")}'); expect(s).toContain('{t(lang, "brand_rest")}'); expect(s).not.toContain("Auto Parts</span>"); expect(s).not.toContain("opacity-85"); expect(s).toContain('lang === "ar" ? "tracking-normal" : "tracking-tight"');
    const line = s.split("\n").find((l) => l.includes('t(lang, "brand_lead")'))!; expect(line).toContain("font-medium"); expect(line).not.toMatch(/opacity|text-(white|navy|muted)\/|text-\[#/);
  });
});
describe("the Arabic text", () => {
  it("no Arabic sentence has the brand written in English letters any more (\"Leap\" is \"ليب\")", () => { const bad = Object.entries(DICTIONARIES.ar).filter(([, v]) => /\bLeap\b/.test(v)).map(([k]) => k); expect(bad).toEqual([]); });
  it("the four sentences that said Leap now say ليب", () => { expect(t("ar", "support_title")).toBe("دعم ليب"); expect(t("ar", "support_notice")).toContain("فريق ليب"); expect(t("ar", "return_goes_to_team")).toContain("فريق ليب"); expect(t("ar", "referral_share_text", { url: "U" })).toContain("في ليب: U"); });
  it("the English sentences still say Leap", () => { expect(t("en", "support_title")).toBe("Leap Support"); });
  it("every new key exists in both languages", () => { for (const k of ["brand_lead", "brand_rest", "compare_pick_hint_phone", "compare_phone_note"] as const) { expect(t("en", k).length, k).toBeGreaterThan(0); expect(t("ar", k).length, k).toBeGreaterThan(0); } expect(t("en", "compare_phone_note", { total: 4 })).toBe("Showing 2 of 4 parts. Open this page on a tablet or a computer to compare them all."); expect(t("ar", "compare_phone_note", { total: 3 })).toContain("3"); });
});
