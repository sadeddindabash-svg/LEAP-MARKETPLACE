"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchGeneration, fetchGenerationsForModel, fetchModelsForBrand, fetchPartsForCategory, fetchVehicleBrands, type CategoryPart, type VehicleBrand, type VehicleGeneration, type VehicleModel } from "@/lib/api";
import { pickName, type DictKey } from "@/lib/i18n";
import { DELIVERY_DAYS, filterHref, modelYears, noCar, pricePresets, readExtraFilters, toUsd } from "@/lib/searchFilters";
import { useCurrency } from "./CurrencyProvider";
import FitsMyCarToggle from "./FitsMyCarToggle";
import { useLang, useT } from "./LangProvider";
import { SaveSearchButton } from "./SaveSearchButton";
import { useLocRouter } from "./useLocRouter";

export interface FilterSection { id: string; nameEn: string; nameAr: string | null }

const pill = "inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-[10px] border-[1.5px] px-3 text-sm font-semibold";
const chip = "inline-flex min-h-8 items-center gap-2 rounded-full bg-navy px-3 text-xs font-bold text-white hover:bg-[#123f56]";
const pop = "absolute start-0 top-full z-30 mt-2 w-72 rounded-xl border border-[#c5d0d8] bg-white p-3 shadow-[0_12px_30px_rgba(10,49,68,0.18)]";
const optionRow = (on: boolean) => `flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2 text-start text-sm ${on ? "bg-[#f4f8fb] font-bold text-navy" : "hover:bg-chalk"}`;

function Radio({ on }: { on: boolean }) {
  return <span aria-hidden="true" className={`size-4 flex-none rounded-full border-2 ${on ? "border-[5px] border-navy" : "border-[#8696a2]"}`} />;
}

/** One dropdown of the bar: a button showing "Label: value", and its panel. Only one is open at a time; a click outside or Escape closes it. */
function Drop({ id, label, value, active, open, setOpen, disabled, alignEnd, children }: {
  id: string; label: string; value: string; active: boolean; open: string | null; setOpen: (v: string | null) => void; disabled?: boolean; alignEnd?: boolean; children: React.ReactNode;
}) {
  const isOpen = open === id;
  return (
    <div className="relative" data-drop={id}>
      <button type="button" aria-haspopup="true" aria-expanded={isOpen} disabled={disabled} onClick={() => setOpen(isOpen ? null : id)}
        className={`${pill} ${active ? "border-navy bg-[#f4f8fb] text-ink" : "border-[#c5d0d8] bg-white text-ink"} disabled:cursor-not-allowed disabled:opacity-50`}>
        <span className="font-medium text-muted">{label}:</span><span className="max-w-[12rem] truncate">{value}</span>
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" className={`text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {isOpen && <div role="dialog" aria-label={label} className={`${pop} ${alignEnd ? "start-auto end-0" : ""}`}>{children}</div>}
    </div>
  );
}

/**
 * The filters of the results page, all in one place: the title with the "Fits my car" switch, then one box of dropdowns. Its first line is the car, chosen step by
 * step and filtering at EVERY step (a brand shows all its parts, then a model narrows to that model, then a year to that year); its second line is the section, the
 * part, the price, the delivery and the sort. Then the filters that are on, then the filters that are on as chips (each removed with its ×, or all with "Clear all") and "Save this search". The title and the number of parts come from the page.
 * Every choice is a new address (/search?...), so the server draws the filtered page and each filtered page has its own link.
 */
export function SearchFilters({ sections, heading }: { sections: FilterSection[]; heading?: React.ReactNode }) {
  const params = useSearchParams();
  const router = useLocRouter();
  const lang = useLang();
  const t = useT();
  const { format, rate } = useCurrency();
  const [open, setOpen] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const part = params.get("part") ?? "";
  const extra = readExtraFilters((n) => params.get(n));
  const section = sections.find((s) => s.id === category) ?? null;
  const sectionName = section ? pickName(lang, section.nameEn, section.nameAr) : category;

  // The parts of the chosen section, for the Part dropdown.
  const [parts, setParts] = useState<{ category: string; list: CategoryPart[] } | null>(null);
  useEffect(() => {
    if (!category) return;
    let current = true;
    fetchPartsForCategory(category).then((list) => { if (current) setParts({ category, list }); }).catch(() => { if (current) setParts({ category, list: [] }); });
    return () => { current = false; };
  }, [category]);
  const sectionParts = parts?.category === category ? parts.list : null;
  const partInfo = sectionParts?.find((p) => p.nameEn === part);
  const partName = partInfo ? pickName(lang, partInfo.nameEn, partInfo.nameAr) : part;

  // A click outside the bar, or Escape, closes the open dropdown.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!(e.target as Element).closest?.(`[data-drop="${open}"]`)) setOpen(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  // ---- The car, step by step. The address holds brandId, then modelId, then year (and the generation when only one was made that year). A car that arrives as a
  // generation only (the garage car, an old link) is looked up once, so its brand and model show in the dropdowns.
  const generationId = params.get("generationId") ?? "";
  const yearParam = Number(params.get("year")) || null;
  const modelParam = params.get("modelId") ?? "";
  const [genInfo, setGenInfo] = useState<(VehicleGeneration & { brandId: string }) | null>(null);
  useEffect(() => {
    if (!generationId || modelParam) return;
    let current = true;
    fetchGeneration(generationId).then((g) => { if (current) setGenInfo(g); }).catch(() => {});
    return () => { current = false; };
  }, [generationId, modelParam]);
  const looked = genInfo?.id === generationId ? genInfo : null;
  const carBrand = params.get("brandId") || looked?.brandId || "";
  const carModel = params.get("modelId") || looked?.modelId || "";

  const [brands, setBrands] = useState<VehicleBrand[] | null>(null);
  useEffect(() => { let current = true; fetchVehicleBrands().then((b) => { if (current) setBrands(b); }).catch(() => { if (current) setBrands([]); }); return () => { current = false; }; }, []);
  const [models, setModels] = useState<{ brand: string; list: VehicleModel[] } | null>(null);
  useEffect(() => {
    if (!carBrand) return;
    let current = true;
    fetchModelsForBrand(carBrand).then((list) => { if (current) setModels({ brand: carBrand, list }); }).catch(() => { if (current) setModels({ brand: carBrand, list: [] }); });
    return () => { current = false; };
  }, [carBrand]);
  const [gens, setGens] = useState<{ model: string; list: VehicleGeneration[] } | null>(null);
  useEffect(() => {
    if (!carModel) return;
    let current = true;
    fetchGenerationsForModel(carModel).then((list) => { if (current) setGens({ model: carModel, list }); }).catch(() => { if (current) setGens({ model: carModel, list: [] }); });
    return () => { current = false; };
  }, [carModel]);
  const brandModels = models?.brand === carBrand ? models.list : null;
  const modelGens = gens?.model === carModel ? gens.list : null;
  const years = modelGens ? modelYears(modelGens) : [];
  const thisYear = new Date().getFullYear();
  const gensOfYear = yearParam && modelGens ? modelGens.filter((g) => yearParam >= g.yearStart && yearParam <= (g.yearEnd ?? thisYear)) : [];
  const brandInfo = brands?.find((b) => b.id === carBrand);
  const modelInfo = brandModels?.find((m) => m.id === carModel);
  const brandName = brandInfo ? pickName(lang, brandInfo.name, brandInfo.nameAr) : "";
  const modelName = modelInfo ? pickName(lang, modelInfo.name, modelInfo.nameAr) : "";
  const genName = modelGens?.find((g) => g.id === generationId)?.name ?? "";
  const [brandQuery, setBrandQuery] = useState("");
  const shownBrands = (brands ?? []).filter((b) => !brandQuery.trim() || `${b.name} ${b.nameAr ?? ""}`.toLowerCase().includes(brandQuery.trim().toLowerCase()));
  const chooseYear = (y: number) => {
    const fitting = (modelGens ?? []).filter((g) => y >= g.yearStart && y <= (g.yearEnd ?? thisYear));
    go({ ...noCar(), brandId: carBrand, modelId: carModel, year: y, generationId: fitting.length === 1 ? fitting[0].id : null });   // one generation that year: it is the car
  };

  const go = (change: Record<string, string | number | null>) => { setOpen(null); router.push(filterHref(params, change)); };

  // Price: typed in the buyer's currency, kept in the address in dollars.
  const shown = (usd: number | undefined) => (usd === undefined ? "" : String(Math.round(usd * rate)));
  const [minText, setMinText] = useState(shown(extra.minPrice));
  const [maxText, setMaxText] = useState(shown(extra.maxPrice));
  useEffect(() => { if (open === "price") { setMinText(shown(extra.minPrice)); setMaxText(shown(extra.maxPrice)); } }, [open]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [p1, p2, p3] = pricePresets(rate);
  const money = (amount: number) => format(toUsd(amount, rate));
  const presets: Array<{ label: string; min: number | null; max: number | null }> = [
    { label: t("sf_price_under", { a: money(p1) }), min: null, max: p1 },
    { label: t("sf_price_between", { a: money(p1), b: money(p2) }), min: p1, max: p2 },
    { label: t("sf_price_between", { a: money(p2), b: money(p3) }), min: p2, max: p3 },
    { label: t("sf_price_over", { a: money(p3) }), min: p3, max: null },
  ];
  const priceText = extra.minPrice !== undefined && extra.maxPrice !== undefined ? t("sf_price_between", { a: format(extra.minPrice), b: format(extra.maxPrice) })
    : extra.maxPrice !== undefined ? t("sf_price_up_to", { a: format(extra.maxPrice) })
    : extra.minPrice !== undefined ? t("sf_price_from", { a: format(extra.minPrice) }) : null;
  const applyPrice = () => {
    const min = Number(minText); const max = Number(maxText);
    const minUsd = minText.trim() && min > 0 ? toUsd(min, rate) : null;
    let maxUsd = maxText.trim() && max > 0 ? toUsd(max, rate) : null;
    if (minUsd !== null && maxUsd !== null && maxUsd < minUsd) maxUsd = null;
    go({ minPrice: minUsd, maxPrice: maxUsd });
  };

  const deliveryText = extra.maxDeliveryDays ? t("sf_delivery_within", { n: extra.maxDeliveryDays }) : null;
  const sorts: Array<[string, DictKey]> = [["", "sf_sort_best"], ["newest", "sf_sort_newest"], ["price_asc", "sf_sort_price_asc"], ["price_desc", "sf_sort_price_desc"]];
  const sortKey = (sorts.find(([v]) => v === (extra.sort ?? "")) ?? sorts[0])[1];

  const chips: Array<{ key: string; label: string; change: Record<string, null> }> = [];
  const carLabel = [brandName, modelName, yearParam ? String(yearParam) : ""].filter(Boolean).join(" ");
  if (carBrand && carLabel) chips.push({ key: "car", label: carLabel, change: noCar() });
  if (q) chips.push({ key: "q", label: `“${q}”`, change: { q: null } });
  if (category) chips.push({ key: "category", label: sectionName, change: { category: null, part: null } });
  if (part) chips.push({ key: "part", label: partName, change: { part: null } });
  if (priceText) chips.push({ key: "price", label: priceText, change: { minPrice: null, maxPrice: null } });
  if (deliveryText) chips.push({ key: "delivery", label: deliveryText, change: { maxDeliveryDays: null } });
  const clearAll = { ...noCar(), q: null, category: null, part: null, minPrice: null, maxPrice: null, maxDeliveryDays: null, sort: null };

  return (
    <div ref={root} className="mb-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">{heading}</div>
        <div className="empty:hidden min-w-64"><FitsMyCarToggle /></div>
      </div>

      <div className="rounded-xl border border-line bg-white">
      {/* Line 1: the car. Each step filters the results at once. */}
      <div role="group" aria-label={t("sf_your_car")} className="flex flex-wrap items-center gap-2 border-b border-line p-2.5">
        <span className="px-1 text-sm font-bold text-navy">{t("sf_your_car")}</span>
        <Drop id="brand" label={t("sf_brand")} value={brandName || (carBrand ? "…" : t("sf_all_brands"))} active={!!carBrand} open={open} setOpen={(v) => { setOpen(v); setBrandQuery(""); }}>
          {(brands?.length ?? 0) > 8 && (
            <input value={brandQuery} onChange={(e) => setBrandQuery(e.target.value)} placeholder={t("sf_search_brands")} aria-label={t("sf_search_brands")} autoFocus className="mb-2 w-full rounded-lg border-[1.5px] border-[#c5d0d8] px-2.5 py-2 text-sm" />
          )}
          <div className="grid max-h-80 gap-0.5 overflow-y-auto">
            <button type="button" className={optionRow(!carBrand)} onClick={() => go(noCar())}><Radio on={!carBrand} />{t("sf_all_brands")}</button>
            {brands === null ? <p className="px-2 py-2 text-sm text-muted">{t("search_loading")}</p> : shownBrands.map((b) => (
              <button key={b.id} type="button" className={optionRow(b.id === carBrand)} onClick={() => go({ ...noCar(), brandId: b.id })}><Radio on={b.id === carBrand} />{pickName(lang, b.name, b.nameAr)}</button>
            ))}
          </div>
        </Drop>
        <Drop id="model" label={t("sf_model")} value={modelName || (carModel ? "…" : carBrand ? t("sf_all_models") : t("sf_pick_brand_first"))} active={!!carModel} open={open} setOpen={setOpen} disabled={!carBrand}>
          <div className="grid max-h-80 gap-0.5 overflow-y-auto">
            <button type="button" className={optionRow(!carModel)} onClick={() => go({ ...noCar(), brandId: carBrand })}><Radio on={!carModel} />{t("sf_all_models")}</button>
            {brandModels === null ? <p className="px-2 py-2 text-sm text-muted">{t("search_loading")}</p> : brandModels.map((m) => (
              <button key={m.id} type="button" className={optionRow(m.id === carModel)} onClick={() => go({ ...noCar(), brandId: carBrand, modelId: m.id })}><Radio on={m.id === carModel} />{pickName(lang, m.name, m.nameAr)}</button>
            ))}
          </div>
        </Drop>
        <Drop id="year" label={t("sf_year")} value={yearParam ? String(yearParam) : carModel ? t("sf_all_years") : t("sf_pick_model_first")} active={!!yearParam} open={open} setOpen={setOpen} disabled={!carModel}>
          <div className="grid max-h-80 grid-cols-3 gap-0.5 overflow-y-auto">
            <button type="button" className={`${optionRow(!yearParam)} col-span-3`} onClick={() => go({ ...noCar(), brandId: carBrand, modelId: carModel })}><Radio on={!yearParam} />{t("sf_all_years")}</button>
            {modelGens === null ? <p className="col-span-3 px-2 py-2 text-sm text-muted">{t("search_loading")}</p> : years.map((y) => (
              <button key={y} type="button" className={`${optionRow(y === yearParam)} justify-center`} onClick={() => chooseYear(y)}>{y}</button>
            ))}
          </div>
        </Drop>
        {gensOfYear.length > 1 && (
          <Drop id="generation" label={t("sf_generation")} value={genName || t("sf_any_generation")} active={!!generationId} open={open} setOpen={setOpen}>
            <div className="grid gap-0.5">
              <button type="button" className={optionRow(!generationId)} onClick={() => go({ generationId: null, versionId: null })}><Radio on={!generationId} />{t("sf_any_generation")}</button>
              {gensOfYear.map((g) => <button key={g.id} type="button" className={optionRow(g.id === generationId)} onClick={() => go({ generationId: g.id, versionId: null })}><Radio on={g.id === generationId} />{g.name}</button>)}
            </div>
          </Drop>
        )}
      </div>

      {/* Line 2: what kind of part, and how it is listed. */}
      <div role="group" aria-label={t("sf_filters")} className="flex flex-wrap items-center gap-2 p-2.5">
        <Drop id="section" label={t("sf_section")} value={category ? sectionName : t("all_sections")} active={!!category} open={open} setOpen={setOpen}>
          <div className="grid max-h-80 gap-0.5 overflow-y-auto">
            <button type="button" className={optionRow(!category)} onClick={() => go({ category: null, part: null })}><Radio on={!category} />{t("all_sections")}</button>
            {sections.map((s) => (
              <button key={s.id} type="button" className={optionRow(s.id === category)} onClick={() => go({ category: s.id, part: null })}><Radio on={s.id === category} />{pickName(lang, s.nameEn, s.nameAr)}</button>
            ))}
          </div>
        </Drop>
        <Drop id="part" label={t("sf_part")} value={part ? partName : category ? t("sf_all_parts") : t("sf_pick_section_first")} active={!!part} open={open} setOpen={setOpen} disabled={!category}>
          <div className="grid max-h-80 gap-0.5 overflow-y-auto">
            <button type="button" className={optionRow(!part)} onClick={() => go({ part: null })}><Radio on={!part} />{t("sf_all_parts")}</button>
            {sectionParts === null ? <p className="px-2 py-2 text-sm text-muted">{t("search_loading")}</p> : sectionParts.map((p) => (
              <button key={p.id} type="button" className={optionRow(p.nameEn === part)} onClick={() => go({ part: p.nameEn })}><Radio on={p.nameEn === part} />{pickName(lang, p.nameEn, p.nameAr)}</button>
            ))}
          </div>
        </Drop>
        <Drop id="price" label={t("sf_price")} value={priceText ?? t("sf_any_price")} active={!!priceText} open={open} setOpen={setOpen}>
          <form onSubmit={(e) => { e.preventDefault(); applyPrice(); }} className="grid gap-2">
            <div className="flex gap-2">
              <label className="min-w-0 flex-1"><span className="sr-only">{t("sf_min")}</span><input inputMode="numeric" value={minText} onChange={(e) => setMinText(e.target.value.replace(/[^\d]/g, ""))} placeholder={t("sf_min")} className="w-full rounded-lg border-[1.5px] border-[#c5d0d8] px-2.5 py-2 text-sm" /></label>
              <label className="min-w-0 flex-1"><span className="sr-only">{t("sf_max")}</span><input inputMode="numeric" value={maxText} onChange={(e) => setMaxText(e.target.value.replace(/[^\d]/g, ""))} placeholder={t("sf_max")} className="w-full rounded-lg border-[1.5px] border-[#c5d0d8] px-2.5 py-2 text-sm" /></label>
            </div>
            <div className="grid gap-0.5">
              {presets.map((p) => {
                const on = (p.min === null ? extra.minPrice === undefined : extra.minPrice === toUsd(p.min, rate)) && (p.max === null ? extra.maxPrice === undefined : extra.maxPrice === toUsd(p.max, rate));
                return <button key={p.label} type="button" className={optionRow(on)} onClick={() => go({ minPrice: p.min === null ? null : toUsd(p.min, rate), maxPrice: p.max === null ? null : toUsd(p.max, rate) })}><Radio on={on} />{p.label}</button>;
              })}
            </div>
            <div className="flex gap-2">
              <button type="submit" className="inline-flex min-h-10 flex-1 items-center justify-center rounded-[10px] bg-signal px-4 text-sm font-bold text-on-signal hover:bg-signal-dark">{t("sf_show_results")}</button>
              {priceText && <button type="button" onClick={() => go({ minPrice: null, maxPrice: null })} className="min-h-10 px-2 text-sm font-semibold text-navy underline underline-offset-4">{t("clear")}</button>}
            </div>
          </form>
        </Drop>
        <Drop id="delivery" label={t("sf_delivery")} value={deliveryText ?? t("sf_delivery_any")} active={!!deliveryText} open={open} setOpen={setOpen}>
          <div className="grid gap-0.5">
            <button type="button" className={optionRow(!extra.maxDeliveryDays)} onClick={() => go({ maxDeliveryDays: null })}><Radio on={!extra.maxDeliveryDays} />{t("sf_delivery_any")}</button>
            {DELIVERY_DAYS.map((d) => <button key={d} type="button" className={optionRow(extra.maxDeliveryDays === d)} onClick={() => go({ maxDeliveryDays: d })}><Radio on={extra.maxDeliveryDays === d} />{t("sf_delivery_within", { n: d })}</button>)}
          </div>
        </Drop>
        <div className="ms-auto">
          <Drop id="sort" label={t("sf_sort")} value={t(sortKey)} active={!!extra.sort} open={open} setOpen={setOpen} alignEnd>
            <div className="grid gap-0.5">
              {sorts.map(([v, key]) => <button key={key} type="button" className={optionRow((extra.sort ?? "") === v)} onClick={() => go({ sort: v || null })}><Radio on={(extra.sort ?? "") === v} />{t(key)}</button>)}
            </div>
          </Drop>
        </div>
      </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button key={c.key} type="button" onClick={() => go(c.change)} className={chip}>
            <span className="max-w-[16rem] truncate">{c.label}</span><span aria-hidden="true" className="opacity-80">×</span><span className="sr-only">{t("clear")}</span>
          </button>
        ))}
        {chips.length > 1 && <button type="button" onClick={() => go(clearAll)} className="min-h-8 px-1 text-sm font-bold text-navy underline underline-offset-4">{t("sf_clear_all")}</button>}
        <span className="ms-auto" />
        <SaveSearchButton searchTerm={q || undefined} category={category || undefined} />
      </div>
    </div>
  );
}
