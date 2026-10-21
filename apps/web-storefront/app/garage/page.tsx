"use client";

import { useEffect, useState } from "react";
import SafeImage from "@/components/SafeImage";
import Link from "@/components/LocLink";
import { useAuth } from "@/components/AuthProvider";
import { useGarage } from "@/components/GarageProvider";
import { useLang, useT } from "@/components/LangProvider";
import VehicleCascade, { type VehicleChoice } from "@/components/VehicleCascade";
import { fetchVersionsForGeneration, resolveImageUrl, type GarageVehicle, type VehicleVersion } from "@/lib/api";
import { MAX_GARAGE_VEHICLES, isGarageFull, searchHrefFor, seatsText, vehicleKey, vehicleLabel, vehicleName, vehiclePhoto } from "@/lib/garage";
import { pickName } from "@/lib/i18n";

const button = "inline-flex min-h-11 items-center justify-center rounded-[10px] border-[1.5px] border-navy px-4 text-sm font-bold text-navy hover:bg-chalk disabled:opacity-50";

/** For a car saved BEFORE versions existed whose year now has some: "Choose its version" opens the list, and saving gives the car its version. */
function ChooseVersion({ car, busy, onSave }: { car: GarageVehicle; busy: boolean; onSave: (versionId: string) => void }) {
  const lang = useLang();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<VehicleVersion[]>([]);
  const [picked, setPicked] = useState("");
  useEffect(() => {
    if (!open) return;
    let current = true;
    fetchVersionsForGeneration(car.generationId).then((list) => { if (current) setVersions(list); });
    return () => { current = false; };
  }, [open, car.generationId]);
  return (
    <div className="mt-2">
      <span className="inline-flex rounded-full bg-[#fdf3e1] px-2.5 py-0.5 text-xs font-bold text-[#8a5a12]">{t("garage_no_version")}</span>{" "}
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="text-sm font-semibold text-navy underline underline-offset-4">{t("garage_choose_version")}</button>
      {open && (
        <div className="mt-2 grid gap-2">
          <select aria-label={t("picker_version")} value={picked} onChange={(e) => setPicked(e.target.value)} className="min-h-11 w-full rounded-[10px] border-[1.5px] border-[#c5d0d8] bg-white px-3 text-sm text-ink">
            <option value="">{t("picker_choose_version")}</option>
            {versions.map((v) => <option key={v.id} value={v.id}>{`${pickName(lang, v.name, v.nameAr)} · ${pickName(lang, v.engine, v.engineAr)} · ${seatsText(lang, v.seats)}`}</option>)}
          </select>
          <button type="button" className={button} disabled={!picked || busy} onClick={() => onSave(picked)}>{t("garage_version_save")}</button>
        </div>
      )}
    </div>
  );
}

function CarCard({ car, busy, onDefault, onRemove, onChooseVersion }: { car: GarageVehicle; busy: boolean; onDefault: () => void; onRemove: () => void; onChooseVersion: (versionId: string) => void }) {
  const lang = useLang();
  const t = useT();
  const photo = vehiclePhoto(car);
  // Laid out as a grid so the SAME buttons sit in the right place on every screen (they are in the page once):
  // phones: a 130 x 130 photo with the details beside it, the buttons below both; from 640 px: a 250 x 250 photo with the details AND the buttons beside it (the buttons at the bottom).
  return (
    <li className={`grid grid-cols-[130px_minmax(0,1fr)] gap-3 rounded-[14px] border-[1.5px] bg-white p-3 sm:grid-cols-[250px_minmax(0,1fr)] sm:grid-rows-[1fr_auto] sm:gap-x-5 sm:gap-y-4 sm:p-4 ${car.isDefault ? "border-navy" : "border-line"}`}>
      <div className="relative grid size-[130px] place-items-center overflow-hidden rounded-xl bg-[#e6edf2] sm:row-span-2 sm:size-[250px]">
        {photo ? (
          <SafeImage src={resolveImageUrl(photo)} alt="" fill sizes="(min-width: 640px) 250px, 130px" className="object-cover" unoptimized />
        ) : (
          <svg aria-hidden="true" className="size-12 sm:size-20" viewBox="0 0 24 24" fill="none" stroke="#0b3146" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 15v-3l2-5h14l2 5v3" /><circle cx="7.5" cy="16.5" r="1.8" /><circle cx="16.5" cy="16.5" r="1.8" /><path d="M5 12h14" /></svg>
        )}
      </div>
      <div className="min-w-0">
        <strong className="block text-base leading-snug [overflow-wrap:anywhere] sm:text-2xl">{vehicleName(lang, car)}</strong>
        {car.generation && car.generation !== String(car.year) && <p className="mt-1 text-sm text-muted [overflow-wrap:anywhere] sm:text-base">{car.generation}</p>}
        <p className="text-sm text-muted sm:text-base">{t("garage_year", { year: car.year })}</p>
        {car.version && (
          <div className="mt-1" data-testid="car-version">
            <p className="text-sm font-semibold [overflow-wrap:anywhere] sm:text-lg">{pickName(lang, car.version.name, car.version.nameAr)}</p>
            <p className="text-sm text-muted [overflow-wrap:anywhere] sm:text-base">{pickName(lang, car.version.engine, car.version.engineAr)}</p>
            <p className="text-sm text-muted sm:text-base">{seatsText(lang, car.version.seats)}</p>
          </div>
        )}
        {!car.version && (car.versionCount ?? 0) > 0 && <ChooseVersion car={car} busy={busy} onSave={onChooseVersion} />}
        {car.isDefault && <span className="mt-2 inline-flex rounded-full bg-navy px-3 py-0.5 text-xs font-bold text-white">{t("shopping_for_this")}</span>}
      </div>
      <div className="col-span-2 flex flex-col gap-2 sm:col-span-1 sm:self-end">
        <Link href={searchHrefFor(car)} className={`${button} !bg-signal !border-signal !text-on-signal hover:!bg-signal-dark`}>{t("shop_for_this")}</Link>
        {!car.isDefault && <button type="button" className={button} disabled={busy} onClick={onDefault}>{t("make_default")}</button>}
        <button type="button" className={`${button} !border-[#a12a21] !text-[#a12a21]`} disabled={busy} onClick={onRemove} aria-label={`${t("remove")}: ${vehicleLabel(lang, car)}`}>{t("remove")}</button>
      </div>
    </li>
  );
}

// My garage: the cars the buyer saved (the same garage the mobile app shows), which one drives "Shopping for" and "Fits my car", and adding another.
export default function GaragePage() {
  const { user, isLoading } = useAuth();
  const garage = useGarage();
  const t = useT();
  const [choice, setChoice] = useState<VehicleChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setProblem(null);
    try { await action(); } catch (err) { setProblem(err instanceof Error && err.message ? err.message : t("generic_error")); } finally { setBusy(false); }
  };

  if (isLoading) return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8" aria-busy="true">{t("search_loading")}</div>;
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-navy">{t("garage_title")}</h1>
        <p className="mb-5 mt-2 text-lg text-muted">{t("garage_login_needed")}</p>
        <Link href="/login" className="inline-flex min-h-12 items-center rounded-[10px] bg-signal px-6 font-bold text-on-signal hover:bg-signal-dark">{t("sign_in")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
      <div className="flex flex-wrap items-baseline gap-x-3"><h1 className="text-3xl font-bold tracking-tight text-navy">{t("garage_title")}</h1>{garage.vehicles.length > 0 && <span className="text-xl font-normal text-muted">· {t("garage_your_cars")} {t("garage_count_of", { n: garage.vehicles.length, max: MAX_GARAGE_VEHICLES })}</span>}</div>
      <p className="mb-8 mt-2 text-muted">{t("garage_intro")}</p>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">          {/* the cars take the width (a 250 px photo needs room beside its details); the form is a slim column */}
        <section aria-labelledby="g-cars">
          <h2 id="g-cars" className="sr-only">{t("garage_your_cars")}{garage.vehicles.length > 0 && <span className="font-normal text-muted"> · {t("garage_count_of", { n: garage.vehicles.length, max: MAX_GARAGE_VEHICLES })}</span>}</h2>
          {garage.loading ? (
            <p className="text-muted" aria-busy="true">{t("search_loading")}</p>
          ) : garage.vehicles.length === 0 ? (
            <p className="text-muted">{t("garage_empty")}</p>
          ) : (
            <ul className="grid gap-4">
              {garage.vehicles.map((car) => (
                <CarCard key={vehicleKey(car)} car={car} busy={busy} onChooseVersion={(versionId) => run(() => garage.chooseVersion(car, versionId))} onDefault={() => run(() => garage.makeDefault(car))} onRemove={() => run(() => garage.remove(car))} />
              ))}
            </ul>
          )}
        </section>
        {isGarageFull(garage.vehicles.length) ? (
          <section className="self-start rounded-[14px] border border-line border-t-[6px] border-t-signal bg-white p-6" aria-labelledby="g-add">
            <h2 id="g-add" className="text-xl font-bold">{t("garage_full_title")}</h2>
            <p className="mt-2 text-muted">{t("garage_limit_note")}</p>
          </section>
        ) : (
          <section className="self-start rounded-[14px] border border-line border-t-[6px] border-t-signal bg-white p-6" aria-labelledby="g-add">
            <h2 id="g-add" className="mb-4 text-xl font-bold">{t("garage_add_car")}</h2>
            <form onSubmit={(e) => { e.preventDefault(); if (choice) run(() => (choice.versionId ? garage.add(choice.generationId, choice.year, choice.versionId) : garage.add(choice.generationId, choice.year))); }}>
              <div className="[&>div]:grid-cols-1"><VehicleCascade idPrefix="ga" onChange={setChoice} withVersions /></div>
              <button type="submit" disabled={!choice || busy} className="mt-4 min-h-12 w-full rounded-[10px] bg-signal font-bold text-on-signal hover:bg-signal-dark disabled:cursor-not-allowed disabled:opacity-50">{busy ? t("saving") : t("garage_add_button")}</button>
            </form>
            <p className="mt-3"><Link href="/find?tab=vin" className="text-sm font-semibold text-navy underline underline-offset-4">{t("garage_add_by_vin")}</Link></p>
            {problem && <p role="alert" className="mt-3 text-sm font-semibold text-[#a12a21]">{problem}</p>}
          </section>
        )}
      </div>
    </div>
  );
}
