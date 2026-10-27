import { describe, it, expect } from "vitest";
import { formatRanges, fitGroupName, fitChipText } from "./fitGroups";
import type { FitGroup } from "./api";

// What a part fits, as the server groups it: the years of a model as ranges, the model's name in each language, and the chip at the top of the product page.
const g = (brand: string, model: string, ranges: Array<[number, number]>, over: Partial<FitGroup> = {}): FitGroup => ({ brand, model, ranges, vehicleCount: ranges.reduce((n, [a, b]) => n + (b - a + 1), 0), ...over });
const seal = g("BYD", "Seal", [[2022, 2024]]); const dolphin = g("BYD", "Dolphin", [[2023, 2023]]);

describe("the years of a model", () => {
  it("a run of years is one range with an en dash; a single year is just the year; several are separated by commas", () => {
    expect(formatRanges([[2022, 2024]])).toBe("2022–2024"); expect(formatRanges([[2023, 2023]])).toBe("2023"); expect(formatRanges([[2020, 2021], [2023, 2023], [2025, 2027]])).toBe("2020–2021, 2023, 2025–2027"); expect(formatRanges([])).toBe("");
  });
});
describe("the name of a model", () => {
  it("brand and model together, in Arabic when the page is Arabic and the Arabic names exist, English otherwise", () => {
    const ar = g("BYD", "Seal", [[2022, 2022]], { brandAr: "بي واي دي", modelAr: "سيل" });
    expect(fitGroupName("en", ar)).toBe("BYD Seal"); expect(fitGroupName("ar", ar)).toBe("بي واي دي سيل"); expect(fitGroupName("ar", seal)).toBe("BYD Seal"); expect(fitGroupName("ar", g("BYD", "Seal", [], { brandAr: "بي واي دي" }))).toBe("بي واي دي Seal");
  });
});
describe("the chip at the top of the page", () => {
  const base = { brand: "BYD", model: "Seal", year: 2022 };
  it("several models: the first model with its years and how many more models", () => {
    expect(fitChipText("en", { ...base, fitGroups: [seal, dolphin, g("Toyota", "Camry", [[2020, 2022]])], fitGroupCount: 3 })).toBe("FITS BYD Seal 2022–2024 +2 more models");
    expect(fitChipText("en", { ...base, fitGroups: [seal, dolphin], fitGroupCount: 2 })).toBe("FITS BYD Seal 2022–2024 +1 more model");
  });
  it("one model: no \"more\"", () => { expect(fitChipText("en", { ...base, fitGroups: [seal], fitGroupCount: 1 })).toBe("FITS BYD Seal 2022–2024"); });
  it("the real number of models is used when the server sent only part of the list", () => { expect(fitChipText("en", { ...base, fitGroups: [seal, dolphin], fitGroupCount: 90 })).toBe("FITS BYD Seal 2022–2024 +89 more models"); });
  it("a part with no fitment at all says it fits every vehicle", () => { expect(fitChipText("en", { ...base, brand: null, model: null, year: null, fitGroups: [], fitGroupCount: 0 })).toBe("Fits all vehicles"); });
  it("from an older server (no groups) it is the single car, exactly as before; with no brand, nothing", () => {
    expect(fitChipText("en", { brand: "BYD", model: "Seal", year: 2022 })).toBe("FITS 2022 BYD Seal"); expect(fitChipText("en", { brand: "BYD", model: null, year: null })).toBe("FITS BYD "); expect(fitChipText("en", { brand: null, model: null, year: null })).toBeNull();
  });
  it("in Arabic the words and the model names are Arabic", () => {
    const text = fitChipText("ar", { ...base, fitGroups: [g("BYD", "Seal", [[2022, 2024]], { brandAr: "بي واي دي", modelAr: "سيل" }), dolphin], fitGroupCount: 2 })!;
    expect(text).toContain("بي واي دي سيل 2022–2024"); expect(text).toContain("+1 موديل آخر"); expect(text).not.toContain("more");
  });
});
