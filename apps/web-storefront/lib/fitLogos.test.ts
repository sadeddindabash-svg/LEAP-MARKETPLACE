import { describe, it, expect } from "vitest";
import { fitBrandLogos, MAX_FIT_LOGOS } from "./fitLogos";
import type { FitGroup } from "./api";

// The brand logos for the "FITS ..." chip: one per different brand (in the order added), at most three, how many other brands, and what an older server or a universal part gives.
const g = (brand: string, model: string, logo: string | null | undefined, over: Partial<FitGroup> = {}): FitGroup => ({ brand, model, ranges: [[2022, 2022]], vehicleCount: 1, brandLogoUrl: logo, ...over });
const base = { brand: null, brandLogoUrl: null };

describe("the logos of the brands a part fits", () => {
  it("one logo per DIFFERENT brand, in the order the supplier added them (several models of one brand are one logo)", () => {
    const r = fitBrandLogos({ ...base, fitGroups: [g("BYD", "Seal", "/b.png"), g("BYD", "Dolphin", "/b.png"), g("Toyota", "Camry", "/t.png"), g("BYD", "Han", "/b.png")] }, "en");
    expect(r.shown.map((l) => l.name)).toEqual(["BYD", "Toyota"]); expect(r.shown.map((l) => l.url)).toEqual(["/b.png", "/t.png"]); expect(r.extra).toBe(0);
  });
  it("at most three are shown, and the other brands are counted (+2)", () => {
    const groups = ["A", "B", "C", "D", "E"].map((b) => g(b, "M", `/${b}.png`)); const r = fitBrandLogos({ ...base, fitGroups: groups }, "en");
    expect(MAX_FIT_LOGOS).toBe(3); expect(r.shown).toHaveLength(3); expect(r.extra).toBe(2); expect(fitBrandLogos({ ...base, fitGroups: groups }, "en", 2).shown).toHaveLength(2);
  });
  it("a brand without a logo is skipped but still counted among the other brands", () => {
    const r = fitBrandLogos({ ...base, fitGroups: [g("A", "M", null), g("B", "M", "/b.png"), g("C", "M", undefined), g("D", "M", "/d.png")] }, "en"); expect(r.shown.map((l) => l.name)).toEqual(["B", "D"]); expect(r.extra).toBe(2);
  });
  it("the same brand written in another case is one brand", () => { const r = fitBrandLogos({ ...base, fitGroups: [g("BYD", "Seal", "/b.png"), g("byd", "Han", "/b.png")] }, "en"); expect(r.shown).toHaveLength(1); expect(r.extra).toBe(0); });
  it("in Arabic the Arabic brand name is used (for the picture's description)", () => { const r = fitBrandLogos({ ...base, fitGroups: [g("BYD", "Seal", "/b.png", { brandAr: "بي واي دي" })] }, "ar"); expect(r.shown[0].name).toBe("بي واي دي"); expect(fitBrandLogos({ ...base, fitGroups: [g("BYD", "Seal", "/b.png", { brandAr: "بي واي دي" })] }, "en").shown[0].name).toBe("BYD"); });
  it("a part with no fitment at all (universal) has no logos", () => { expect(fitBrandLogos({ ...base, brand: "BYD", brandLogoUrl: "/b.png", fitGroups: [] }, "en")).toEqual({ shown: [], extra: 0 }); });
  it("from an older server (no groups) it is the logo of the first car when there is one, otherwise none", () => {
    expect(fitBrandLogos({ brand: "BYD", brandLogoUrl: "/b.png" }, "en")).toEqual({ shown: [{ name: "BYD", url: "/b.png" }], extra: 0 }); expect(fitBrandLogos({ brand: "BYD", brandLogoUrl: null }, "en")).toEqual({ shown: [], extra: 0 }); expect(fitBrandLogos({ brand: null, brandLogoUrl: "/b.png" }, "en")).toEqual({ shown: [], extra: 0 });
  });
});
