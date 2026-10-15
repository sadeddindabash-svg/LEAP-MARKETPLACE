"use client";

import { vehicleLabel } from "@/lib/garage";
import { useGarage } from "./GarageProvider";
import { useLang, useT } from "./LangProvider";

/** "Confirmed fit: BYD Seal DM-i · 2024": shown when the part's fit list contains the buyer's default car (the mobile app's rule, by generation). Nothing otherwise. */
export default function ConfirmedFit({ fitsVehicleIds }: { fitsVehicleIds: string[] }) {
  const { defaultVehicle } = useGarage();
  const lang = useLang();
  const t = useT();
  if (!defaultVehicle || !fitsVehicleIds.includes(defaultVehicle.generationId)) return null;
  return (
    <p role="status" className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#e2f4ec] px-3.5 py-1.5 text-sm font-bold text-[#0f6b49]">
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4.5 4.5L19 7" /></svg>
      {t("confirmed_fit_for", { car: vehicleLabel(lang, defaultVehicle) })}
    </p>
  );
}
