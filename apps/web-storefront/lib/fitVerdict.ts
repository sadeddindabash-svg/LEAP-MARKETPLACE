import { pickName, type Lang } from "@/lib/i18n";

/**
 * Does this part fit the buyer's car? The part lists the cars it fits (a generation and a year); a car may be NARROWED to some VERSIONS (fitVersions: { "generation|year": [version ids] }): a car that is not in
 * fitVersions fits EVERY version. The buyer's saved car (My Garage) has a version when its generation has versions.
 *   fits             on the list, every version fits (or the part is not narrowed for this car)
 *   fits_versions    on the list, narrowed, and the buyer's version is one of the versions
 *   wrong_version    on the list, narrowed, and the buyer's version is NOT one of them
 *   need_version     on the list, narrowed, and the saved car has no version yet (so it cannot be checked)
 *   not_listed       the car (model and year) is not on the part's list at all
 */
export type FitVerdict =
  | { kind: "fits" }
  | { kind: "fits_versions"; versions: string[] }
  | { kind: "wrong_version"; versions: string[] }
  | { kind: "need_version"; versions: string[] }
  | { kind: "not_listed" };

export interface FitData {
  fitKeys?: string[];
  fitsVehicleIds?: string[];
  fitVersions?: Record<string, string[]>;
  fitVersionNames?: Record<string, { name: string; nameAr?: string | null; nameZh?: string | null }>;
}

export function fitVerdict(vehicle: { generationId: string; year: number; versionId?: string | null }, fit: FitData, lang: Lang): FitVerdict {
  const key = `${vehicle.generationId}|${vehicle.year}`;
  const listed = (fit.fitKeys ?? []).includes(key) || (fit.fitsVehicleIds ?? []).includes(vehicle.generationId);
  if (!listed) return { kind: "not_listed" };
  const rule = fit.fitVersions?.[key];
  if (!rule || rule.length === 0) return { kind: "fits" };
  const names = rule.map((id) => { const n = fit.fitVersionNames?.[id]; return n ? pickName(lang, n.name, n.nameAr) : id; });
  if (!vehicle.versionId) return { kind: "need_version", versions: names };
  return rule.includes(vehicle.versionId) ? { kind: "fits_versions", versions: names } : { kind: "wrong_version", versions: names };
}
