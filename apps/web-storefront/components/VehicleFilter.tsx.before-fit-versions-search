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

  // The steps are Brand -> Model -> YEAR -> GENERATION (the same order as My Garage). The years offered are every year any generation of the model covers; once a year is chosen, only the generations
  // that cover it are offered, and when there is just one it is chosen for the buyer.
  const currentYear = new Date().getFullYear();
  const covers = (g: VehicleGeneration, year: number) => g.yearStart <= year && year <= (g.yearEnd || currentYear);
  const yearOptions: number[] = Array.from(new Set(generations.flatMap((g) => Array.from({ length: (g.yearEnd || currentYear) - g.yearStart + 1 }, (_, i) => g.yearStart + i)))).sort((x, y) => y - x);
  const generationsForYear = selectedYear ? generations.filter((g) => covers(g, Number(selectedYear))) : [];
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
          aria-label={t("select_brand")}
          value={selectedBrandId}
          onChange={(e) => { setSelectedBrandId(e.target.value); setSelectedModelId(""); setSelectedGenerationId(""); setSelectedYear(""); }}
          className="w-full rounded-md border border-line px-3 py-2 text-sm"
        >
          <option value="">{t("select_brand")}</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{pickName(lang, b.name, b.nameAr)}</option>)}
        </select>

        {selectedBrandId && (
          <select
            aria-label={t("select_model")}
            value={selectedModelId}
            onChange={(e) => { setSelectedModelId(e.target.value); setSelectedGenerationId(""); setSelectedYear(""); }}
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
          >
            <option value="">{t("select_model")}</option>
            {models.map((m) => <option key={m.id} value={m.id}>{pickName(lang, m.name, m.nameAr)}</option>)}
          </select>
        )}

        {selectedModelId && yearOptions.length > 0 && (
          <select
            aria-label={t("select_year")}
            value={selectedYear}
            onChange={(e) => {
              const year = e.target.value;
              setSelectedYear(year);
              setSelectedGenerationId("");
              const fitting = year ? generations.filter((g) => covers(g, Number(year))) : [];
              // Only one generation covers this year: choose it for the buyer rather than asking a question with one answer.
              if (fitting.length === 1) { setSelectedGenerationId(fitting[0].id); applyFilter(fitting[0].id, year); }
            }}
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
          >
            <option value="">{t("select_year")}</option>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        {selectedYear && generationsForYear.length > 1 && (
          <select
            aria-label={t("select_generation")}
            value={selectedGenerationId}
            onChange={(e) => { setSelectedGenerationId(e.target.value); if (e.target.value) applyFilter(e.target.value, selectedYear); }}
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
          >
            <option value="">{t("select_generation")}</option>
            {generationsForYear.map((g) => (
              <option key={g.id} value={g.id}>{g.name} ({g.yearStart}–{g.yearEnd || t("present")})</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
