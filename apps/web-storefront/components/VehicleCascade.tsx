"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchGenerationsForModel, fetchModelsForBrand, fetchVehicleBrands, fetchVersionsForGeneration, resolveImageUrl, type VehicleBrand, type VehicleGeneration, type VehicleModel, type VehicleVersion } from "@/lib/api";
import { seatsText } from "@/lib/garage";
import { pickName } from "@/lib/i18n";
import SafeImage from "./SafeImage";
import { useLang, useT } from "./LangProvider";

export interface VehicleChoice { generationId: string; year: number; label: string; versionId?: string; version?: VehicleVersion }

const select = "min-h-12 w-full rounded-[10px] border-[1.5px] border-[#c5d0d8] bg-white px-3 text-[15px] text-ink disabled:bg-chalk disabled:text-muted";

/**
 * Brand, model, year: the cascade the mobile app uses. Tells its parent the car whenever a COMPLETE choice is made, and null whenever the choice is incomplete again.
 * The lists below a changed choice are cleared in the handlers (not in effects), and a late answer for a choice that has since changed is dropped.
 *
 * With `withVersions` (My Garage, and saving a car found by its VIN) there is a fourth step: when the chosen YEAR has versions the choice is complete only once a VERSION is
 * chosen, and the version (with its engine, seats and photo) comes with it. A year without versions completes at the year, exactly as before. Everywhere else (the home page
 * picker, the search filter, a part request) the cascade stops at the year: parts are matched by year.
 */
export default function VehicleCascade({ idPrefix, onChange, withVersions = false }: { idPrefix: string; onChange: (choice: VehicleChoice | null) => void; withVersions?: boolean }) {
  const lang = useLang();
  const t = useT();
  const [brands, setBrands] = useState<VehicleBrand[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [generations, setGenerations] = useState<VehicleGeneration[]>([]);
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [choice, setChoice] = useState("");           // "<generationId>:<year>"
  const [versions, setVersions] = useState<VehicleVersion[]>([]);
  const [versionId, setVersionId] = useState("");
  const [base, setBase] = useState<VehicleChoice | null>(null);     // the car as far as the year, while a version is still to be chosen
  const latestYear = useRef(0);                                     // which year choice an answer belongs to (a late answer for an older one is dropped)

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

  const clearVersions = () => { latestYear.current += 1; setVersions([]); setVersionId(""); setBase(null); };
  const chooseBrand = (id: string) => { if (id === brandId) return; setBrandId(id); setModelId(""); setModels([]); setGenerations([]); setChoice(""); clearVersions(); onChange(null); };
  const chooseModel = (id: string) => { if (id === modelId) return; setModelId(id); setGenerations([]); setChoice(""); clearVersions(); onChange(null); };
  const chooseYear = (value: string) => {
    setChoice(value);
    clearVersions();
    if (!value) return onChange(null);
    const [generationId, year] = value.split(":");
    const brand = brands.find((b) => b.id === brandId);
    const model = models.find((m) => m.id === modelId);
    const car: VehicleChoice = { generationId, year: Number(year), label: `${brand ? pickName(lang, brand.name, brand.nameAr) : ""} ${model ? pickName(lang, model.name, model.nameAr) : ""} · ${year}`.trim() };
    if (!withVersions) return onChange(car);
    onChange(null);                                                  // not complete until we know whether this year has versions
    const ticket = latestYear.current;
    fetchVersionsForGeneration(generationId).then((list) => {
      if (ticket !== latestYear.current) return;                     // the buyer has chosen something else since
      setVersions(list);
      setBase(car);
      if (list.length === 0) onChange(car);
    });
  };
  const chooseVersion = (id: string) => {
    setVersionId(id);
    const version = versions.find((v) => v.id === id);
    if (!id || !version || !base) return onChange(null);
    onChange({ ...base, versionId: version.id, version, label: `${base.label} · ${pickName(lang, version.name, version.nameAr)}` });
  };

  const chosen = versions.find((v) => v.id === versionId) || null;
  const chosenPhoto = chosen?.photoUrl || null;
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
      {withVersions && versions.length > 0 && (
        <div className="col-span-full">          {/* the whole width, however many columns the page gives the dropdowns (a fixed three-column span would invent extra columns in a one-column layout) */}
          <label htmlFor={`${idPrefix}-version`} className="mb-1.5 block text-[13px] font-bold text-navy">{t("picker_version")}</label>
          <select id={`${idPrefix}-version`} className={select} value={versionId} onChange={(e) => chooseVersion(e.target.value)}>
            <option value="">{t("picker_choose_version")}</option>
            {versions.map((v) => <option key={v.id} value={v.id}>{`${pickName(lang, v.name, v.nameAr)} · ${pickName(lang, v.engine, v.engineAr)} · ${seatsText(lang, v.seats)}`}</option>)}
          </select>
          {!chosen && <p className="mt-1.5 text-[13px] text-muted">{t("picker_version_needed")}</p>}
          {chosen && (
            <div className="mt-3 flex items-center gap-3 rounded-[10px] bg-chalk p-3" data-testid="version-preview">
              <div className="relative size-16 flex-none overflow-hidden rounded-lg bg-[#e6edf2]">
                {chosenPhoto && <SafeImage src={resolveImageUrl(chosenPhoto)} alt="" fill sizes="64px" className="object-cover" unoptimized />}
              </div>
              <div className="min-w-0 text-sm">
                <strong className="block [overflow-wrap:anywhere]">{pickName(lang, chosen.name, chosen.nameAr)}</strong>
                <span className="block text-muted [overflow-wrap:anywhere]">{pickName(lang, chosen.engine, chosen.engineAr)}</span>
                <span className="block text-muted">{seatsText(lang, chosen.seats)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
