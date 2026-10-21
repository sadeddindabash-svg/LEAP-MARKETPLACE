"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocRouter } from "@/components/useLocRouter";
import { useLang, useT } from "@/components/LangProvider";
import { pickName } from "@/lib/i18n";
import { VehicleBrand, VehicleModel, VehicleGeneration, fetchVehicleBrands, fetchModelsForBrand, fetchGenerationsForModel } from "@/lib/api";

// Real vehicle-fitment filter (new) -- closes a real, confirmed gap:
// this storefront had zero vehicle-based filtering at all, unlike the
// mobile app's own search vehicle picker and My Garage (both use this
// exact same real, structured Brand->Model->Generation cascade).
//
// A real Client Component (needs interactive cascading fetches as the
// buyer picks each level) that navigates via real URL search params
// (generationId, year) rather than local-only state -- this keeps
// /search's own Server Component doing the actual real, crawlable
// filtering server-side, the same way category/q already work; this
// component's only job is to update the URL, not fetch products itself.
export function VehicleFilter() {
  const router = useLocRouter();
  const searchParams = useSearchParams();
  const lang = useLang();
  const t = useT();

  const [brands, setBrands] = useState<VehicleBrand[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [generations, setGenerations] = useState<VehicleGeneration[]>([]);

  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [selectedGenerationId, setSelectedGenerationId] = useState(searchParams.get("generationId") || "");
  const [selectedYear, setSelectedYear] = useState(searchParams.get("year") || "");

  useEffect(() => {
    fetchVehicleBrands().then(setBrands);
  }, []);

  useEffect(() => {
    if (!selectedBrandId) { setModels([]); return; }
    fetchModelsForBrand(selectedBrandId).then(setModels);
  }, [selectedBrandId]);

  useEffect(() => {
    if (!selectedModelId) { setGenerations([]); return; }
    fetchGenerationsForModel(selectedModelId).then(setGenerations);
  }, [selectedModelId]);

  const selectedGeneration = generations.find((g) => g.id === selectedGenerationId);
  const yearOptions: number[] = selectedGeneration
    ? Array.from(
        { length: (selectedGeneration.yearEnd || new Date().getFullYear()) - selectedGeneration.yearStart + 1 },
        (_, i) => selectedGeneration.yearStart + i
      )
    : [];

  const applyFilter = (generationId: string, year: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (generationId) params.set("generationId", generationId); else params.delete("generationId");
    if (year) params.set("year", year); else params.delete("year");
    router.push(`/search?${params.toString()}`);
  };

  const clearFilter = () => {
    setSelectedBrandId(""); setSelectedModelId(""); setSelectedGenerationId(""); setSelectedYear("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("generationId"); params.delete("year");
    router.push(`/search?${params.toString()}`);
  };

  const hasActiveFilter = !!searchParams.get("generationId");

  return (
    <div className="h-full rounded-lg border border-line bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-bold text-lg">{t("my_vehicle")}</h2>
        {hasActiveFilter && (
          <button onClick={clearFilter} className="text-xs font-semibold text-muted hover:text-ink">
            {t("clear")}
          </button>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <select
          value={selectedBrandId}
          onChange={(e) => { setSelectedBrandId(e.target.value); setSelectedModelId(""); setSelectedGenerationId(""); setSelectedYear(""); }}
          className="w-full rounded-md border border-line px-3 py-2 text-sm"
        >
          <option value="">{t("select_brand")}</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{pickName(lang, b.name, b.nameAr)}</option>)}
        </select>

        {selectedBrandId && (
          <select
            value={selectedModelId}
            onChange={(e) => { setSelectedModelId(e.target.value); setSelectedGenerationId(""); setSelectedYear(""); }}
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
          >
            <option value="">{t("select_model")}</option>
            {models.map((m) => <option key={m.id} value={m.id}>{pickName(lang, m.name, m.nameAr)}</option>)}
          </select>
        )}

        {selectedModelId && (
          <select
            value={selectedGenerationId}
            onChange={(e) => {
              setSelectedGenerationId(e.target.value);
              setSelectedYear("");
              // A single-year generation has only one real possible
              // year -- apply it immediately rather than making the
              // buyer pick from a list of one.
              const gen = generations.find((g) => g.id === e.target.value);
              if (gen && gen.yearEnd === gen.yearStart) {
                applyFilter(e.target.value, String(gen.yearStart));
              }
            }}
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
          >
            <option value="">{t("select_generation")}</option>
            {generations.map((g) => (
              <option key={g.id} value={g.id}>{g.name} ({g.yearStart}–{g.yearEnd || t("present")})</option>
            ))}
          </select>
        )}

        {selectedGenerationId && yearOptions.length > 1 && (
          <select
            value={selectedYear}
            onChange={(e) => { setSelectedYear(e.target.value); applyFilter(selectedGenerationId, e.target.value); }}
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
          >
            <option value="">{t("any_year")}</option>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}
