"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchGenerationsForModel, fetchModelsForBrand, fetchVehicleBrands, type VehicleBrand, type VehicleGeneration, type VehicleModel } from "@/lib/api";
import { pickName } from "@/lib/i18n";
import { useLang, useT } from "@/components/LangProvider";
import { useLocRouter } from "@/components/useLocRouter";

const select = "min-h-12 w-full rounded-[10px] border-[1.5px] border-[#c5d0d8] bg-white px-3 text-[15px] text-ink disabled:bg-chalk disabled:text-muted";

/** Brand, model, year: the same cascade the mobile app uses. "Show parts that fit" opens the search page filtered to that car. */
export default function HeroPicker() {
  const lang = useLang();
  const t = useT();
  const router = useLocRouter();
  const [brands, setBrands] = useState<VehicleBrand[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [generations, setGenerations] = useState<VehicleGeneration[]>([]);
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [choice, setChoice] = useState("");           // "<generationId>:<year>"

  // Each list is loaded when the choice above it is made. The lists BELOW a changed choice are cleared in the change handlers, not in effects, so there is never a
  // moment showing models of the previous brand. A late answer for a choice that has since changed is dropped.
  useEffect(() => { fetchVehicleBrands().then(setBrands); }, []);
  useEffect(() => {
    if (!brandId) return;
    let current = true;
    fetchModelsForBrand(brandId).then((m) => { if (current) setModels(m); });
    return () => { current = false; };
  }, [brandId]);
  useEffect(() => {
    if (!modelId) return;
    let current = true;
    fetchGenerationsForModel(modelId).then((g) => { if (current) setGenerations(g); });
    return () => { current = false; };
  }, [modelId]);
  const chooseBrand = (id: string) => { setBrandId(id); setModelId(""); setModels([]); setGenerations([]); setChoice(""); };
  const chooseModel = (id: string) => { setModelId(id); setGenerations([]); setChoice(""); };

  // One entry per year (newest first). A year that two generations cover is offered once, for the first one that covers it.
  const years = useMemo(() => {
    const seen = new Map<number, string>();
    for (const g of generations) {
      const end = g.yearEnd ?? new Date().getFullYear();
      for (let y = end; y >= g.yearStart; y--) if (!seen.has(y)) seen.set(y, g.id);
    }
    return [...seen.entries()].sort((a, b) => b[0] - a[0]);
  }, [generations]);

  return (
    <div className="rounded-[14px] border border-line border-t-[6px] border-t-signal bg-white p-6">
      <h2 className="mb-4 text-xl font-bold">{t("picker_title")}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!choice) return;
          const [generationId, year] = choice.split(":");
          router.push(`/search?generationId=${encodeURIComponent(generationId)}&year=${year}`);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="hp-brand" className="mb-1.5 block text-[13px] font-bold text-navy">{t("picker_brand")}</label>
            <select id="hp-brand" className={select} value={brandId} onChange={(e) => chooseBrand(e.target.value)}>
              <option value="">{t("picker_choose_brand")}</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{pickName(lang, b.name, b.nameAr)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="hp-model" className="mb-1.5 block text-[13px] font-bold text-navy">{t("picker_model")}</label>
            <select id="hp-model" className={select} value={modelId} disabled={!brandId} onChange={(e) => chooseModel(e.target.value)}>
              <option value="">{t("picker_choose_model")}</option>
              {models.map((m) => <option key={m.id} value={m.id}>{pickName(lang, m.name, m.nameAr)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="hp-year" className="mb-1.5 block text-[13px] font-bold text-navy">{t("picker_year")}</label>
            <select id="hp-year" className={select} value={choice} disabled={!modelId} onChange={(e) => setChoice(e.target.value)}>
              <option value="">{t("picker_choose_year")}</option>
              {years.map(([year, generationId]) => <option key={year} value={`${generationId}:${year}`}>{year}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" disabled={!choice} className="mt-4 min-h-13 w-full rounded-[10px] bg-signal text-base font-bold text-on-signal hover:bg-signal-dark disabled:cursor-not-allowed disabled:opacity-50">
          {t("picker_cta")}
        </button>
      </form>
    </div>
  );
}
