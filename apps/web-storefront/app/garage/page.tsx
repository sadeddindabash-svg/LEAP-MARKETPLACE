"use client";

import { useState } from "react";
import SafeImage from "@/components/SafeImage";
import Link from "@/components/LocLink";
import { useAuth } from "@/components/AuthProvider";
import { useGarage } from "@/components/GarageProvider";
import { useLang, useT } from "@/components/LangProvider";
import VehicleCascade, { type VehicleChoice } from "@/components/VehicleCascade";
import { resolveImageUrl, type GarageVehicle } from "@/lib/api";
import { searchHrefFor, vehicleLabel, vehiclePhoto } from "@/lib/garage";

const button = "inline-flex min-h-11 items-center justify-center rounded-[10px] border-[1.5px] border-navy px-4 text-sm font-bold text-navy hover:bg-chalk disabled:opacity-50";

function CarCard({ car, busy, onDefault, onRemove }: { car: GarageVehicle; busy: boolean; onDefault: () => void; onRemove: () => void }) {
  const lang = useLang();
  const t = useT();
  const photo = vehiclePhoto(car);
  return (
    <li className={`flex flex-wrap items-center gap-4 rounded-[14px] border-[1.5px] bg-white p-4 ${car.isDefault ? "border-navy" : "border-line"}`}>
      <div className="relative grid h-24 w-36 flex-none place-items-center overflow-hidden rounded-xl bg-[#e6edf2]">
        {photo ? (
          <SafeImage src={resolveImageUrl(photo)} alt="" fill sizes="144px" className="object-cover" unoptimized />
        ) : (
          <svg aria-hidden="true" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#0b3146" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 15v-3l2-5h14l2 5v3" /><circle cx="7.5" cy="16.5" r="1.8" /><circle cx="16.5" cy="16.5" r="1.8" /><path d="M5 12h14" /></svg>
        )}
      </div>
      <div className="min-w-48 flex-1">
        <strong className="block text-lg">{vehicleLabel(lang, car)}</strong>
        {car.isDefault && <span className="mt-1 inline-flex rounded-full bg-navy px-3 py-0.5 text-xs font-bold text-white">{t("shopping_for_this")}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={searchHrefFor(car)} className={button}>{t("shop_for_this")}</Link>
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
  const [failed, setFailed] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setFailed(false);
    try { await action(); } catch { setFailed(true); } finally { setBusy(false); }
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
      <h1 className="text-3xl font-bold tracking-tight text-navy">{t("garage_title")}</h1>
      <p className="mb-8 mt-2 text-muted">{t("garage_intro")}</p>
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-[14px] border border-line bg-white p-6" aria-labelledby="g-cars">
          <h2 id="g-cars" className="mb-4 text-xl font-bold">{t("garage_your_cars")}</h2>
          {garage.loading ? (
            <p className="text-muted" aria-busy="true">{t("search_loading")}</p>
          ) : garage.vehicles.length === 0 ? (
            <p className="text-muted">{t("garage_empty")}</p>
          ) : (
            <ul className="grid gap-3">
              {garage.vehicles.map((car) => (
                <CarCard key={`${car.generationId}:${car.year}`} car={car} busy={busy} onDefault={() => run(() => garage.makeDefault(car))} onRemove={() => run(() => garage.remove(car))} />
              ))}
            </ul>
          )}
        </section>
        <section className="self-start rounded-[14px] border border-line border-t-[6px] border-t-signal bg-white p-6" aria-labelledby="g-add">
          <h2 id="g-add" className="mb-4 text-xl font-bold">{t("garage_add_car")}</h2>
          <form onSubmit={(e) => { e.preventDefault(); if (choice) run(() => garage.add(choice.generationId, choice.year)); }}>
            <div className="[&>div]:grid-cols-1"><VehicleCascade idPrefix="ga" onChange={setChoice} /></div>
            <button type="submit" disabled={!choice || busy} className="mt-4 min-h-12 w-full rounded-[10px] bg-signal font-bold text-on-signal hover:bg-signal-dark disabled:cursor-not-allowed disabled:opacity-50">{busy ? t("saving") : t("garage_add_button")}</button>
          </form>
          <p className="mt-3"><Link href="/find?tab=vin" className="text-sm font-semibold text-navy underline underline-offset-4">{t("garage_add_by_vin")}</Link></p>
          {failed && <p role="alert" className="mt-3 text-sm font-semibold text-[#a12a21]">{t("generic_error")}</p>}
        </section>
      </div>
    </div>
  );
}
