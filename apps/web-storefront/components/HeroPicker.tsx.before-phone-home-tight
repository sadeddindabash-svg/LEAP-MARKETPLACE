"use client";

import { useState } from "react";
import { useT } from "@/components/LangProvider";
import { useLocRouter } from "@/components/useLocRouter";
import VehicleCascade, { type VehicleChoice } from "@/components/VehicleCascade";

/** The home page's vehicle picker: brand, model, year, then "Show parts that fit" opens the search page filtered to that car. */
export default function HeroPicker() {
  const t = useT();
  const router = useLocRouter();
  const [choice, setChoice] = useState<VehicleChoice | null>(null);
  return (
    <div className="rounded-[14px] border border-line border-t-[6px] border-t-signal bg-white p-6">
      <h2 className="mb-4 text-xl font-bold">{t("picker_title")}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (choice) router.push(`/search?generationId=${encodeURIComponent(choice.generationId)}&year=${choice.year}`);
        }}
      >
        <VehicleCascade idPrefix="hp" onChange={setChoice} />
        <button type="submit" disabled={!choice} className="mt-4 min-h-13 w-full rounded-[10px] bg-signal text-base font-bold text-on-signal hover:bg-signal-dark disabled:cursor-not-allowed disabled:opacity-50">
          {t("picker_cta")}
        </button>
      </form>
    </div>
  );
}
