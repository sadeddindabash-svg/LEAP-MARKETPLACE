import { describe, it, expect } from "vitest";
import { decodedLabel, matchVin } from "./vin";
import type { VehicleBrand, VehicleGeneration, VehicleModel } from "./api";

const brands: VehicleBrand[] = [{ id: "b_byd", name: "BYD" }, { id: "b_geely", name: "Geely" }, { id: "b_lynk", name: "LYNK & CO" }];
const models: Record<string, VehicleModel[]> = { b_byd: [{ id: "m_seal", brandId: "b_byd", name: "Seal" }, { id: "m_han", brandId: "b_byd", name: "Han EV" }], b_geely: [], b_lynk: [] };
const gens: Record<string, VehicleGeneration[]> = {
  m_seal: [{ id: "g_seal_2022", modelId: "m_seal", name: "2022", yearStart: 2022, yearEnd: 2022 }, { id: "g_seal_2024", modelId: "m_seal", name: "2024-on", yearStart: 2024, yearEnd: null }],
  m_han: [],
};
const modelsOf = async (id: string) => models[id] ?? [];
const generationsOf = async (id: string) => gens[id] ?? [];
const run = (make: string | null, model: string | null, modelYear: number | null) => matchVin({ make, model, modelYear }, brands, modelsOf, generationsOf);

describe("matching a decoded VIN to our vehicles (the same rules as the mobile app)", () => {
  it("CRITICAL: brand, model and year all match: resolved, with the generation whose years contain the year", async () => {
    const r = await run("BYD", "Seal", 2024);
    expect(r).toMatchObject({ status: "resolved", year: 2024, label: "BYD Seal (2024)" });
    if (r.status === "resolved") { expect(r.brand.id).toBe("b_byd"); expect(r.model.id).toBe("m_seal"); expect(r.generation.id).toBe("g_seal_2024"); }
    const old = await run("BYD", "Seal", 2022);
    if (old.status === "resolved") expect(old.generation.id).toBe("g_seal_2022"); else throw new Error("not resolved");
    const later = await run("BYD", "Seal", 2031);                  // an open-ended generation (still in production) covers any later year
    if (later.status === "resolved") expect(later.generation.id).toBe("g_seal_2024"); else throw new Error("not resolved");
  });

  it("matching is loose in both directions and ignores capitals: 'byd' finds BYD, 'BYD AUTO' finds BYD, 'Han' finds 'Han EV'", async () => {
    expect((await run("byd", "seal", 2024)).status).toBe("resolved");
    expect(await run("BYD AUTO", null, 2024)).toMatchObject({ status: "no_model", brand: { id: "b_byd" } });
    const han = await run("BYD", "Han", 2023);
    expect(han).toMatchObject({ status: "no_generation", model: { id: "m_han" } });          // the model is found even though its name has more words
  });

  it("CRITICAL: it says exactly how far it got, never more than it knows", async () => {
    expect(await run("BYD", "Seal", 2010)).toMatchObject({ status: "no_generation", year: 2010 });        // no generation covers 2010
    expect(await run("BYD", "Seal", null)).toMatchObject({ status: "no_generation", year: null });         // the VIN gave no year
    expect(await run("BYD", "Atto 99", 2024)).toMatchObject({ status: "no_model", brand: { id: "b_byd" } });
    expect(await run("BYD", null, 2024)).toMatchObject({ status: "no_model" });                              // the VIN gave no model
    expect(await run("Geely", "Coolray", 2021)).toMatchObject({ status: "no_model" });                      // a brand with no models yet
    expect(await run("Tesla", "Model 3", 2021)).toEqual({ status: "unknown_brand", label: "Tesla Model 3 (2021)" });
    expect(await run(null, null, null)).toEqual({ status: "unrecognized" });
  });

  it("does not look up models or generations it does not need", async () => {
    let modelCalls = 0;
    await matchVin({ make: "BYD", model: null, modelYear: 2024 }, brands, async (id) => { modelCalls++; return models[id] ?? []; }, generationsOf);
    expect(modelCalls).toBe(0);                                                                             // no model in the VIN, so no model list needed
    let genCalls = 0;
    await matchVin({ make: "BYD", model: "Atto 99", modelYear: 2024 }, brands, modelsOf, async (id) => { genCalls++; return gens[id] ?? []; });
    expect(genCalls).toBe(0);
  });

  it("the label is worded like the app's: make, model, then the year in brackets, skipping what is missing", () => {
    expect(decodedLabel({ make: "BYD", model: "Seal", modelYear: 2024 })).toBe("BYD Seal (2024)");
    expect(decodedLabel({ make: "BYD", model: null, modelYear: 2024 })).toBe("BYD (2024)");
    expect(decodedLabel({ make: "BYD", model: "Seal", modelYear: null })).toBe("BYD Seal");
  });
});
