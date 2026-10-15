"use client";

import { useSearchParams } from "next/navigation";
import { vehicleLabel } from "@/lib/garage";
import { useGarage } from "./GarageProvider";
import { useLang, useT } from "./LangProvider";
import { useLocRouter } from "./useLocRouter";

/** On the search page: show only the parts that fit the buyer's default car (their garage), or all of them. Not shown without a saved car. */
export default function FitsMyCarToggle() {
  const { defaultVehicle: car } = useGarage();
  const params = useSearchParams();
  const router = useLocRouter();
  const lang = useLang();
  const t = useT();
  if (!car) return null;
  const active = params.get("generationId") === car.generationId && params.get("year") === String(car.year);
  const toggle = () => {
    const next = new URLSearchParams(params.toString());
    if (active) { next.delete("generationId"); next.delete("year"); } else { next.set("generationId", car.generationId); next.set("year", String(car.year)); }
    next.delete("page");
    router.push(`/search?${next.toString()}`);
  };
  return (
    <button type="button" role="switch" aria-checked={active} onClick={toggle}
      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-start text-sm font-semibold ${active ? "border-navy bg-[#f4f8fb]" : "border-line bg-white"}`}>
      <span aria-hidden="true" className={`relative h-6 w-11 flex-none rounded-full ${active ? "bg-navy" : "bg-[#8696a2]"}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${active ? "start-[22px]" : "start-0.5"}`} />
      </span>
      <span>{t("fits_my_car")}<span className="block text-xs font-medium text-muted">{vehicleLabel(lang, car)}</span></span>
    </button>
  );
}
