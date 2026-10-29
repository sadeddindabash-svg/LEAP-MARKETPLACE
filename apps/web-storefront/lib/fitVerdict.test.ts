import { describe, it, expect } from "vitest";
import { fitVerdict } from "./fitVerdict";

// Does the part fit the buyer's car, using the buyer's VERSION only when the part is narrowed to some versions.
const car = (over = {}) => ({ generationId: "g", year: 2023, versionId: "v2", ...over });
const NAMES = { v1: { name: "Premium RWD", nameAr: "بريميوم" }, v2: { name: "Performance AWD", nameAr: null }, v3: { name: "Excellence AWD" } };
const narrowed = (ids: string[], key = "g|2023") => ({ fitKeys: [key], fitVersions: { [key]: ids }, fitVersionNames: NAMES });

describe("a part that is NOT narrowed (every part before versions existed, and the default)", () => {
  it("CRITICAL: fits every version of a listed car: with or without a version, whatever the version", () => {
    const fit = { fitKeys: ["g|2023"] }; expect(fitVerdict(car(), fit, "en")).toEqual({ kind: "fits" }); expect(fitVerdict(car({ versionId: null }), fit, "en")).toEqual({ kind: "fits" }); expect(fitVerdict(car({ versionId: undefined }), fit, "en")).toEqual({ kind: "fits" });
    expect(fitVerdict(car({ versionId: "anything" }), { ...fit, fitVersions: {} }, "en")).toEqual({ kind: "fits" }); expect(fitVerdict(car(), { ...fit, fitVersions: { "g|2023": [] } }, "en")).toEqual({ kind: "fits" });
  });
  it("the older list (generation without a year) still matches by generation", () => { expect(fitVerdict(car(), { fitsVehicleIds: ["g"] }, "en")).toEqual({ kind: "fits" }); });
  it("another model or year is simply not on the list (as before)", () => { expect(fitVerdict(car({ year: 2021 }), { fitKeys: ["g|2023"] }, "en")).toEqual({ kind: "not_listed" }); expect(fitVerdict(car({ generationId: "x" }), { fitKeys: ["g|2023"] }, "en")).toEqual({ kind: "not_listed" }); expect(fitVerdict(car(), {}, "en")).toEqual({ kind: "not_listed" }); });
});
describe("a part narrowed to some versions", () => {
  it("CRITICAL: the buyer's version is one of them: it fits, and the versions are named", () => { expect(fitVerdict(car(), narrowed(["v2", "v3"]), "en")).toEqual({ kind: "fits_versions", versions: ["Performance AWD", "Excellence AWD"] }); });
  it("CRITICAL: the buyer's version is NOT one of them: wrong version, with the versions the part is for", () => { expect(fitVerdict(car({ versionId: "v1" }), narrowed(["v2", "v3"]), "en")).toEqual({ kind: "wrong_version", versions: ["Performance AWD", "Excellence AWD"] }); });
  it("CRITICAL: the saved car has no version yet: it cannot be checked, and the buyer is asked to choose one", () => { expect(fitVerdict(car({ versionId: null }), narrowed(["v2"]), "en")).toEqual({ kind: "need_version", versions: ["Performance AWD"] }); expect(fitVerdict(car({ versionId: undefined }), narrowed(["v2"]), "en")).toEqual({ kind: "need_version", versions: ["Performance AWD"] }); });
  it("the narrowing only applies to the car it is for: another year of the same part is not narrowed", () => { const fit = { fitKeys: ["g|2023", "g|2024"], fitVersions: { "g|2023": ["v3"] }, fitVersionNames: NAMES }; expect(fitVerdict(car({ year: 2024 }), fit, "en")).toEqual({ kind: "fits" }); expect(fitVerdict(car({ year: 2023 }), fit, "en").kind).toBe("wrong_version"); });
  it("a car that is not on the list is not_listed even if a version rule exists elsewhere", () => { expect(fitVerdict(car({ year: 2021 }), narrowed(["v2"]), "en")).toEqual({ kind: "not_listed" }); });
  it("version names follow the language (Arabic when there is one, else the English name); an unknown name falls back to the id", () => { expect(fitVerdict(car({ versionId: "v1" }), narrowed(["v1", "v3"]), "ar")).toEqual({ kind: "fits_versions", versions: ["بريميوم", "Excellence AWD"] }); expect(fitVerdict(car(), { fitKeys: ["g|2023"], fitVersions: { "g|2023": ["v2", "zz"] }, fitVersionNames: NAMES }, "en")).toEqual({ kind: "fits_versions", versions: ["Performance AWD", "zz"] }); });
});
