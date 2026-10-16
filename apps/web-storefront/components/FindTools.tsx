"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/LocLink";
import { decodeVin, fetchGenerationsForModel, fetchModelsForBrand, fetchPartsForCategory, fetchVehicleBrands, type CategoryPart, type ProductCategory } from "@/lib/api";
import { barcodeSupported, readBarcode, readBarcodeFromFile } from "@/lib/barcode";
import { pickName, type DictKey } from "@/lib/i18n";
import { SYMPTOMS } from "@/lib/symptoms";
import { matchVin, type VinMatch } from "@/lib/vin";
import { vehicleLabel, isGarageFull } from "@/lib/garage";
import { useGarage } from "./GarageProvider";
import { useLang, useT } from "./LangProvider";
import { useLocRouter } from "./useLocRouter";
import VehicleCascade, { type VehicleChoice } from "./VehicleCascade";

export type FindTab = "vehicle" | "vin" | "part" | "symptom";
const TABS: Array<[FindTab, DictKey]> = [["vehicle", "tab_vehicle"], ["vin", "tab_vin"], ["part", "tab_part_number"], ["symptom", "tab_symptom"]];

const panel = "rounded-[14px] border border-line bg-white p-6";
const primary = "inline-flex min-h-12 items-center justify-center rounded-[10px] bg-signal px-6 text-[15px] font-bold text-on-signal hover:bg-signal-dark disabled:cursor-not-allowed disabled:opacity-50";
const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-navy px-4 text-[15px] font-bold text-navy hover:bg-chalk disabled:opacity-50";
const field = "min-h-12 w-full rounded-[10px] border-[1.5px] border-[#c5d0d8] bg-white px-3 text-[15px] text-ink";

/** The search address for a vehicle choice (or none) plus any extra filters. */
function searchHref(extra: Record<string, string>, car: { generationId: string; year: number } | null): string {
  const params = new URLSearchParams(extra);
  if (car) { params.set("generationId", car.generationId); params.set("year", String(car.year)); }
  return `/search?${params.toString()}`;
}

// ------------------------------------------------------------------------------------------------ 1. the which-part wizard
function VehicleWizard({ categories }: { categories: ProductCategory[] }) {
  const lang = useLang();
  const t = useT();
  const router = useLocRouter();
  const { defaultVehicle } = useGarage();
  const [step, setStep] = useState<"vehicle" | "section" | "part">("vehicle");
  const [car, setCar] = useState<{ generationId: string; year: number } | null>(null);
  const [picked, setPicked] = useState<VehicleChoice | null>(null);
  const [section, setSection] = useState<ProductCategory | null>(null);
  const [parts, setParts] = useState<CategoryPart[] | null>(null);

  const steps: Array<["vehicle" | "section" | "part" | "results", DictKey]> = [["vehicle", "wizard_step_vehicle"], ["section", "wizard_step_section"], ["part", "wizard_step_part"], ["results", "wizard_step_results"]];
  const order = ["vehicle", "section", "part", "results"];
  const sectionName = section ? pickName(lang, section.nameEn, section.nameAr) : "";

  const chooseSection = (c: ProductCategory) => {
    setSection(c); setParts(null); setStep("part");
    fetchPartsForCategory(c.id).then(setParts);
  };

  return (
    <section className={panel} aria-labelledby="wizard-h">
      <ol className="mb-5 flex flex-wrap gap-2" aria-label={t("find_ways")}>
        {steps.map(([id, key]) => {
          const state = id === step ? "now" : order.indexOf(id) < order.indexOf(step) ? "done" : "todo";
          return (
            <li key={id} aria-current={state === "now" ? "step" : undefined} className={`flex items-center gap-2 rounded-full border-[1.5px] bg-white py-1.5 pe-4 ps-1.5 text-sm font-bold ${state === "now" ? "border-navy" : "border-line"}`}>
              <b className={`grid size-7 place-items-center rounded-full text-[13px] ${state === "done" ? "bg-[#0f6b49] text-white" : state === "now" ? "bg-signal text-on-signal" : "bg-[#dce5eb] text-navy"}`}>{order.indexOf(id) + 1}</b>
              {t(key)}
            </li>
          );
        })}
      </ol>

      {step === "vehicle" && (
        <div>
          <h2 id="wizard-h" className="mb-3 text-xl font-bold">{t("wizard_which_car")}</h2>
          {defaultVehicle && (
            <button type="button" className={`${secondary} mb-4 w-full sm:w-auto`} onClick={() => { setCar({ generationId: defaultVehicle.generationId, year: defaultVehicle.year }); setStep("section"); }}>
              {t("wizard_use_garage", { car: vehicleLabel(lang, defaultVehicle) })}
            </button>
          )}
          <p className="mb-2 text-sm text-muted">{t("wizard_or_pick")}</p>
          <VehicleCascade idPrefix="wz" onChange={setPicked} />
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button type="button" className={primary} disabled={!picked} onClick={() => { if (picked) { setCar({ generationId: picked.generationId, year: picked.year }); setStep("section"); } }}>{t("continue_label")}</button>
            <button type="button" className="text-sm font-semibold text-navy underline underline-offset-4" onClick={() => { setCar(null); setStep("section"); }}>{t("wizard_skip_vehicle")}</button>
          </div>
        </div>
      )}

      {step === "section" && (
        <div>
          <h2 id="wizard-h" className="mb-3 text-xl font-bold">{t("wizard_which_section")}</h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {categories.map((c) => (
              <li key={c.id}><button type="button" onClick={() => chooseSection(c)} className="flex min-h-16 w-full items-center rounded-xl border-[1.5px] border-line bg-white px-4 text-start font-bold hover:border-navy">{pickName(lang, c.nameEn, c.nameAr)}</button></li>
            ))}
          </ul>
          <button type="button" className={`${secondary} mt-5`} onClick={() => setStep("vehicle")}>{t("back")}</button>
        </div>
      )}

      {step === "part" && section && (
        <div>
          <h2 id="wizard-h" className="mb-3 text-xl font-bold">{t("wizard_which_part", { section: sectionName })}</h2>
          {parts === null ? (
            <p className="text-muted">{t("search_loading")}</p>
          ) : parts.length === 0 ? (
            <p className="text-muted">{t("wizard_no_parts")}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-3">
              {parts.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => router.push(searchHref({ category: section.id, part: p.nameEn }, car))} className="flex min-h-16 w-full items-center rounded-xl border-[1.5px] border-line bg-white px-4 text-start font-bold hover:border-navy">
                    {pickName(lang, p.nameEn, p.nameAr)}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button type="button" className={secondary} onClick={() => setStep("section")}>{t("back")}</button>
            <Link href={searchHref({ category: section.id }, car)} className={primary}>{t("wizard_show_section", { section: sectionName })}</Link>
          </div>
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------------------------------------------ 2. a car, by its VIN
function PickAndGo() {
  const t = useT();
  const [choice, setChoice] = useState<VehicleChoice | null>(null);
  return (
    <div className="mt-4">
      <VehicleCascade idPrefix="vinpick" onChange={setChoice} />
      <Link href={choice ? searchHref({}, choice) : "#"} aria-disabled={!choice} onClick={(e) => { if (!choice) e.preventDefault(); }} className={`${primary} mt-4 ${choice ? "" : "pointer-events-none opacity-50"}`}>{t("picker_cta")}</Link>
    </div>
  );
}

function VinLookup() {
  const lang = useLang();
  const t = useT();
  const garage = useGarage();
  const garageFull = isGarageFull(garage.vehicles.length);
  const [vin, setVin] = useState("");
  const [state, setState] = useState<{ kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "result"; match: VinMatch }>({ kind: "idle" });
  const [added, setAdded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = vin.trim().toUpperCase();
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(clean)) return setState({ kind: "error", message: t("vin_invalid") });
    setState({ kind: "loading" }); setAdded(false); setSaveError(null);
    try {
      const decoded = await decodeVin(clean);
      const brands = await fetchVehicleBrands();
      setState({ kind: "result", match: await matchVin(decoded, brands, fetchModelsForBrand, fetchGenerationsForModel) });
    } catch {
      setState({ kind: "error", message: t("generic_error") });
    }
  };

  const match = state.kind === "result" ? state.match : null;
  const carName = match && match.status === "resolved" ? `${pickName(lang, match.brand.name, match.brand.nameAr)} ${pickName(lang, match.model.name, match.model.nameAr)} · ${match.year}` : "";

  return (
    <section className={panel} aria-labelledby="vin-h">
      <h2 id="vin-h" className="mb-1 text-xl font-bold">{t("vin_title")}</h2>
      <p className="mb-4 text-muted">{t("vin_hint")}</p>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="vin-input" className="mb-1.5 block text-[13px] font-bold text-navy">{t("vin_label")}</label>
          <input id="vin-input" value={vin} onChange={(e) => setVin(e.target.value)} maxLength={17} autoCapitalize="characters" autoComplete="off" spellCheck={false} dir="ltr" className={`${field} font-plate uppercase tracking-wider`} />
        </div>
        <button type="submit" className={primary} disabled={state.kind === "loading"}>{state.kind === "loading" ? t("vin_looking") : t("vin_button")}</button>
      </form>
      <div aria-live="polite" className="mt-4">
        {state.kind === "error" && <p role="alert" className="font-semibold text-[#a12a21]">{state.message}</p>}
        {match?.status === "resolved" && (
          <div>
            <p className="font-bold text-[#0f6b49]">{t("vin_found", { label: carName })}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link href={searchHref({}, { generationId: match.generation.id, year: match.year })} className={primary}>{t("picker_cta")}</Link>
              {garage.signedIn ? (
                <button type="button" className={secondary} disabled={added || garageFull} onClick={async () => { try { await garage.add(match.generation.id, match.year); setAdded(true); } catch (err) { setSaveError(err instanceof Error && err.message ? err.message : t("generic_error")); } }}>
                  {added ? t("vin_added") : t("garage_add_button")}
                </button>
              ) : (
                <Link href="/login" className="text-sm font-semibold text-navy underline underline-offset-4">{t("vin_sign_in_to_save")}</Link>
              )}
            </div>
            {garage.signedIn && garageFull && !added && (
              <p className="mt-2 text-sm font-semibold text-[#7a4e00]">{t("garage_full_title")}. {t("garage_limit_note")} <Link href="/garage" className="underline underline-offset-4">{t("garage_open")}</Link></p>
            )}
            {saveError && <p role="alert" className="mt-2 text-sm font-semibold text-[#a12a21]">{saveError}</p>}
          </div>
        )}
        {match?.status === "no_generation" && <><p>{t("vin_no_generation", { label: match.label })}</p><PickAndGo /></>}
        {match?.status === "no_model" && <><p>{t("vin_pick_model", { label: match.label })}</p><PickAndGo /></>}
        {match?.status === "unknown_brand" && <><p>{t("vin_unknown_brand", { label: match.label })}</p><PickAndGo /></>}
        {match?.status === "unrecognized" && <><p>{t("vin_unrecognized")}</p><PickAndGo /></>}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------------------------------------ 3. a part, by its number (typed, or a barcode read by the camera or from a photo)
function PartNumberSearch() {
  const t = useT();
  const router = useLocRouter();
  const { defaultVehicle } = useGarage();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const supported = typeof window !== "undefined" && barcodeSupported();

  const go = (value: string) => router.push(searchHref({ q: value.trim() }, defaultVehicle));
  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    timerRef.current = null; streamRef.current = null;
    setScanning(false);
  };
  useEffect(() => stop, []);                                         // release the camera if the buyer leaves the page

  const startCamera = async () => {
    setMessage(null);
    if (!barcodeSupported()) return setMessage(t("pn_unsupported"));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScanning(true);
      // the <video> exists on the next render
      setTimeout(async () => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => {});
        timerRef.current = setInterval(async () => {
          const found = await readBarcode(video).catch(() => null);
          if (found) { stop(); setCode(found); setMessage(t("pn_found", { code: found })); go(found); }
        }, 400);
      }, 0);
    } catch {
      setMessage(t("pn_camera_denied"));
    }
  };

  const readPhoto = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    if (!barcodeSupported()) return setMessage(t("pn_unsupported"));
    const found = await readBarcodeFromFile(file).catch(() => null);
    if (!found) return setMessage(t("pn_no_barcode"));
    setCode(found); setMessage(t("pn_found", { code: found })); go(found);
  };

  return (
    <section className={panel} aria-labelledby="pn-h">
      <h2 id="pn-h" className="mb-1 text-xl font-bold">{t("pn_title")}</h2>
      <p className="mb-4 text-muted">{t("pn_hint")}</p>
      <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) go(code); }} className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="pn-input" className="mb-1.5 block text-[13px] font-bold text-navy">{t("part_number")}</label>
          <input id="pn-input" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" spellCheck={false} dir="ltr" className={`${field} font-plate`} />
        </div>
        <button type="submit" className={primary} disabled={!code.trim()}>{t("search_button")}</button>
      </form>
      <div className="mt-4 flex flex-wrap gap-3">
        {scanning ? (
          <button type="button" className={secondary} onClick={stop}>{t("pn_stop")}</button>
        ) : (
          <button type="button" className={secondary} onClick={startCamera} disabled={!supported}>{t("pn_scan_camera")}</button>
        )}
        <button type="button" className={secondary} onClick={() => fileRef.current?.click()} disabled={!supported}>{t("pn_upload")}</button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" aria-label={t("pn_upload")} tabIndex={-1} onChange={(e) => { readPhoto(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {!supported && <p className="mt-3 text-sm text-muted">{t("pn_unsupported")}</p>}
      {scanning && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold">{t("pn_scanning")}</p>
          <video ref={videoRef} muted playsInline className="aspect-video w-full max-w-md rounded-xl bg-black" />
        </div>
      )}
      <p aria-live="polite" className="mt-3 text-sm font-semibold text-navy">{message}</p>
    </section>
  );
}

// ------------------------------------------------------------------------------------------------ 4. a part, by what is wrong
function SymptomList() {
  const lang = useLang();
  const t = useT();
  const { defaultVehicle } = useGarage();
  return (
    <section className={panel} aria-labelledby="sy-h">
      <h2 id="sy-h" className="mb-1 text-xl font-bold">{t("symptom_title")}</h2>
      <p className="mb-4 text-muted">{t("symptom_hint")}</p>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {SYMPTOMS.map((s) => (
          <li key={s.id}>
            <Link href={searchHref({ q: s.query }, defaultVehicle)} className="flex min-h-12 items-center justify-between gap-3 rounded-xl border-[1.5px] border-line bg-white px-4 font-semibold hover:border-navy">
              {lang === "ar" ? s.ar : s.en}
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none rtl:rotate-180"><path d="M9 6l6 6-6 6" /></svg>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ------------------------------------------------------------------------------------------------ the four tools, as tabs
export default function FindTools({ categories, initialTab = "vehicle" }: { categories: ProductCategory[]; initialTab?: FindTab }) {
  const t = useT();
  const [tab, setTab] = useState<FindTab>(initialTab);
  return (
    <div>
      <div role="tablist" aria-label={t("find_ways")} className="mb-5 flex flex-wrap gap-2">
        {TABS.map(([id, key]) => (
          <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} onClick={() => setTab(id)}
            className={`min-h-11 rounded-[10px] border-[1.5px] px-4 text-sm font-semibold ${tab === id ? "border-navy bg-navy text-white" : "border-[#c5d0d8] bg-white text-navy"}`}>
            {t(key)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "vehicle" && <VehicleWizard categories={categories} />}
        {tab === "vin" && <VinLookup />}
        {tab === "part" && <PartNumberSearch />}
        {tab === "symptom" && <SymptomList />}
      </div>
    </div>
  );
}
