"use client";

import { useState } from "react";
import { useLang, useT } from "@/components/LangProvider";
import { fitGroupName, formatRanges } from "@/lib/fitGroups";
import type { FitGroup } from "@/lib/api";

/** How many models are shown before "+N more models". */
export const FIT_LINES = 3;

/**
 * The "Fits" row of the Technical Specifications card: every model the part fits with its years ("BYD Seal  2022–2024"), three lines to start with and then "+2 more models · 11 vehicles in all", which opens the whole list ("Show fewer" closes it).
 * `groupCount` is how many models the part really fits (the server sends up to 60 lines; if there are more, the list says how many are not shown).
 */
export default function FitsRow({ groups, groupCount, vehicleCount }: { groups: FitGroup[]; groupCount?: number; vehicleCount?: number }) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const total = Math.max(groupCount ?? groups.length, groups.length);
  const collapsible = groups.length > FIT_LINES;
  const shown = open || !collapsible ? groups : groups.slice(0, FIT_LINES);
  const hidden = total - FIT_LINES;                              // models behind the "+N more" link
  const unlisted = total - groups.length;                         // models the server did not send at all
  const more = hidden === 1 ? t("fits_more_model_one") : t("fits_more_models", { n: hidden });
  return (
    <div data-testid="fits-row" className="flex flex-col items-start gap-0.5 font-semibold leading-snug">
      {shown.map((g) => (
        <div key={`${g.brand}|${g.model}`} data-testid="fit-line" className="flex gap-3.5">
          <span>{fitGroupName(lang, g)}</span>
          <span className="min-w-[5.25rem] text-start font-medium text-muted">{formatRanges(g.ranges)}</span>
        </div>
      ))}
      {open && unlisted > 0 && <div data-testid="fit-unlisted" className="font-medium text-muted">{t("fits_more_models", { n: unlisted })}</div>}
      {collapsible && (
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="mt-1 text-sm font-medium text-navy underline underline-offset-2">
          {open ? t("fits_show_fewer") : `${more}${vehicleCount ? ` · ${t("fits_vehicles_in_all", { n: vehicleCount })}` : ""}`}
        </button>
      )}
    </div>
  );
}
