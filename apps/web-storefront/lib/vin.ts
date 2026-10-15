// Turning a decoded VIN into one of OUR vehicles, with the same rules the mobile app uses (apps/mobile/lib/features/search/vehicle_filter_sheet.dart):
//   1. the brand: its name contains the decoded make, or the make contains its name (capitals ignored);
//   2. the model: the same rule against that brand's models (only tried when the VIN gave a model);
//   3. the generation: the one whose year range contains the decoded year.
// The result says exactly how far it got, so the page can say so honestly instead of pretending to resolve more than it did.
import type { VehicleBrand, VehicleGeneration, VehicleModel } from "./api";

export interface DecodedVin { make: string | null; model: string | null; modelYear: number | null }
export type VinMatch =
  | { status: "resolved"; brand: VehicleBrand; model: VehicleModel; generation: VehicleGeneration; year: number; label: string }
  | { status: "no_generation"; brand: VehicleBrand; model: VehicleModel; year: number | null; label: string }          // brand and model found, but no generation covers the year
  | { status: "no_model"; brand: VehicleBrand; year: number | null; label: string }                                    // brand found, the model was not (or the VIN gave none)
  | { status: "unknown_brand"; label: string }                                                                         // the make is not one of our brands
  | { status: "unrecognized" };                                                                                         // the VIN could not be decoded at all

const loose = (a: string, b: string) => {
  const x = a.toLowerCase(), y = b.toLowerCase();
  return x.includes(y) || y.includes(x);
};

/** "BYD Seal (2024)": what the decoded VIN said, as the app words it. */
export function decodedLabel(d: DecodedVin): string {
  return [d.make, d.model, d.modelYear ? `(${d.modelYear})` : ""].filter(Boolean).join(" ");
}

export async function matchVin(
  decoded: DecodedVin,
  brands: VehicleBrand[],
  modelsOf: (brandId: string) => Promise<VehicleModel[]>,
  generationsOf: (modelId: string) => Promise<VehicleGeneration[]>,
): Promise<VinMatch> {
  if (!decoded.make) return { status: "unrecognized" };
  const label = decodedLabel(decoded);
  const brand = brands.find((b) => loose(b.name, decoded.make as string));
  if (!brand) return { status: "unknown_brand", label };
  const year = decoded.modelYear;
  const models = decoded.model ? await modelsOf(brand.id) : [];
  const model = decoded.model ? models.find((m) => loose(m.name, decoded.model as string)) : undefined;
  if (!model) return { status: "no_model", brand, year, label };
  const generations = await generationsOf(model.id);
  const generation = year == null ? undefined : generations.find((g) => year >= g.yearStart && (g.yearEnd == null || year <= g.yearEnd));
  if (!generation || year == null) return { status: "no_generation", brand, model, year, label };
  return { status: "resolved", brand, model, generation, year, label };
}
