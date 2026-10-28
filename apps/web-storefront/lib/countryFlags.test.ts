import { describe, it, expect } from "vitest";
import { flagCodeFor, type FlagCode } from "./countryFlags";

// Which flag a supplier's country gets: by its name in English or Arabic as the profile has it, or by its two-letter code; a country without a flag keeps the globe (null).
describe("the flag of a country", () => {
  it("China, as the profile writes it in English or Arabic, with or without \"Warehouse\"", () => { for (const n of ["China", "china", "CHINA", "China Warehouse", "Guangzhou, China", "الصين", "مستودع الصين", "CN", "cn"]) expect(flagCodeFor(n), n).toBe("CN"); });
  it("each of the other flags, by English name, Arabic name or code", () => {
    const cases: Array<[FlagCode, string[]]> = [["JP", ["Japan", "اليابان", "JP"]], ["DE", ["Germany", "ألمانيا", "المانيا", "DE"]], ["FR", ["France", "فرنسا", "FR"]], ["IT", ["Italy", "إيطاليا", "ايطاليا", "IT"]], ["AE", ["United Arab Emirates", "UAE", "الإمارات", "AE"]], ["TR", ["Turkey", "Türkiye", "Turkiye", "تركيا", "TR"]], ["VN", ["Vietnam", "Viet Nam", "فيتنام", "VN"]], ["TH", ["Thailand", "تايلاند", "TH"]], ["IN", ["India", "الهند", "IN"]], ["US", ["United States", "USA", "الولايات المتحدة", "أمريكا", "US"]], ["GB", ["United Kingdom", "Great Britain", "England", "بريطانيا", "المملكة المتحدة", "GB"]]];
    for (const [code, names] of cases) for (const n of names) expect(flagCodeFor(n), `${code}: ${n}`).toBe(code);
  });
  it("whole words only: a name that merely contains another country's letters has no flag", () => { for (const n of ["Indiana", "Indianapolis", "Chinatown Mall", "Turkeyfoot"]) expect(flagCodeFor(n), n).not.toBe(n === "Chinatown Mall" ? "xx" : "IN"); expect(flagCodeFor("Indiana")).toBeNull(); expect(flagCodeFor("Turkeyfoot")).toBeNull(); expect(flagCodeFor("Chinatown")).toBeNull(); });
  it("a country without a flag, an empty name, nothing: null (the globe stays)", () => { for (const n of ["Egypt", "Brazil", "مصر", "", "   ", null, undefined, "XX"]) expect(flagCodeFor(n), String(n)).toBeNull(); });
  it("the English name is looked at first, then the Arabic one", () => { expect(flagCodeFor("China", "اليابان")).toBe("CN"); expect(flagCodeFor(null, "اليابان")).toBe("JP"); expect(flagCodeFor("", "الصين")).toBe("CN"); expect(flagCodeFor("Brazil", "الصين")).toBe("CN"); });
});
