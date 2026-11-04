"use client";

import { useGarage } from "./GarageProvider";
import { useT } from "./LangProvider";
import { MAX_GARAGE_VEHICLES } from "@/lib/garage";

const R = 26;
const C = 2 * Math.PI * R;

// How full My garage is, in the page's title box (design A): a gold ring that fills as cars are saved, "2/5" inside it, "2 of 5 · cars saved" beside it,
// and "Garage full" at the limit. The ring runs clockwise, and the other way round in Arabic. Nothing shows until the cars are loaded.
export default function GarageMeter() {
  const { vehicles, loading, signedIn } = useGarage();
  const t = useT();
  if (!signedIn || loading) return null;
  const n = Math.min(vehicles.length, MAX_GARAGE_VEHICLES);
  const full = n >= MAX_GARAGE_VEHICLES;
  const label = t("garage_count_of", { n, max: MAX_GARAGE_VEHICLES });
  return (
    <div data-testid="garage-meter" className="flex flex-none items-center gap-3" role="img" aria-label={`${label} · ${full ? t("garage_meter_full") : t("garage_meter_saved")}`}>
      <span className="relative block size-16">
        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" className="rtl:-scale-x-100">
          <circle cx="32" cy="32" r={R} fill="none" stroke="#e8ecf0" strokeWidth="8" />
          {n > 0 && <circle data-testid="garage-meter-fill" cx="32" cy="32" r={R} fill="none" stroke={full ? "#0b2a3c" : "#f3c03b"} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(C * n) / MAX_GARAGE_VEHICLES} ${C}`} transform="rotate(-90 32 32)" />}
        </svg>
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-base font-extrabold text-navy" dir="ltr">{n}/{MAX_GARAGE_VEHICLES}</span>
      </span>
      <span aria-hidden="true">
        <span className="block font-extrabold text-navy">{label}</span>
        <span className="block text-xs font-semibold text-muted">{full ? t("garage_meter_full") : t("garage_meter_saved")}</span>
      </span>
    </div>
  );
}
