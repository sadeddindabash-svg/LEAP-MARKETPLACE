"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchGenerationsForModel, fetchModelsForBrand, fetchVehicleBrands, type VehicleBrand, type VehicleGeneration, type VehicleModel } from "@/lib/api";
import { pickName } from "@/lib/i18n";
import { useLang, useT } from "./LangProvider";

export interface VehicleChoice { generationId: string; year: number; label: string }

const select = "min-h-12 w-full rounded-[10px] border-[1.5px] border-[#c5d0d8] bg-white px-3 text-[15px] text-ink disabled:bg-chalk disabled:text-muted";

/**
 * Brand, model, year: the cascade the mobile app uses. Tells its parent the car whenever a COMPLETE choice is made, and null whenever the choice is incomplete again.
 * The lists below a changed choice are cleared in the handlers (not in effects), and a late answer for a choice that has since changed is dropped.
 */
export default function VehicleCascade({ idPrefix, onChange }: { idPrefix: string; onChange: (choice: VehicleChoice | null) => void }) {
  const lang = useLang();
  const t = useT();
  const [brands, setBrands] = useState<VehicleBrand[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [generations, setGenerations] = useState<VehicleGeneration[]>([]);
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [choice, setChoice] = useState("");           // "<generationId>:<year>"

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

  // One entry per year, newest first; a year two generations cover is offered once, for the first one that covers it.
  const years = useMemo(() => {
    const seen = new Map<number, string>();
    for (const g of generations) {
      const end = g.yearEnd ?? new Date().getFullYear();
      for (let y = end; y >= g.yearStart; y--) if (!seen.has(y)) seen.set(y, g.id);
    }
    return [...seen.entries()].sort((a, b) => b[0] - a[0]);
  }, [generations]);

  const chooseBrand = (id: string) => { setBrandId(id); setModelId(""); setModels([]); setGenerations([]); setChoice(""); onChange(null); };
  const chooseModel = (id: string) => { setModelId(id); setGenerations([]); setChoice(""); onChange(null); };
  const chooseYear = (value: string) => {
    setChoice(value);
    if (!value) return onChange(null);
    const [generationId, year] = value.split(":");
    const brand = brands.find((b) => b.id === brandId);
    const model = models.find((m) => m.id === modelId);
    onChange({ generationId, year: Number(year), label: `${brand ? pickName(lang, brand.name, brand.nameAr) : ""} ${model ? pickName(lang, model.name, model.nameAr) : ""} · ${year}`.trim() });
  };

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div>
        <label htmlFor={`${idPrefix}-brand`} className="mb-1.5 block text-[13px] font-bold text-navy">{t("picker_brand")}</label>
        <select id={`${idPrefix}-brand`} className={select} value={brandId} onChange={(e) => chooseBrand(e.target.value)}>
          <option value="">{t("picker_choose_brand")}</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{pickName(lang, b.name, b.nameAr)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-model`} className="mb-1.5 block text-[13px] font-bold text-navy">{t("picker_model")}</label>
        <select id={`${idPrefix}-model`} className={select} value={modelId} disabled={!brandId} onChange={(e) => chooseModel(e.target.value)}>
          <option value="">{t("picker_choose_model")}</option>
          {models.map((m) => <option key={m.id} value={m.id}>{pickName(lang, m.name, m.nameAr)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-year`} className="mb-1.5 block text-[13px] font-bold text-navy">{t("picker_year")}</label>
        <select id={`${idPrefix}-year`} className={select} value={choice} disabled={!modelId} onChange={(e) => chooseYear(e.target.value)}>
          <option value="">{t("picker_choose_year")}</option>
          {years.map(([year, generationId]) => <option key={year} value={`${generationId}:${year}`}>{year}</option>)}
        </select>
      </div>
    </div>
  );
}
