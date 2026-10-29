"use client";

import { useEffect, useState } from "react";
import { fetchProductById, type ProductDetail } from "@/lib/api";
import { vehicleLabel } from "@/lib/garage";
import { fitVerdict } from "@/lib/fitVerdict";
import { pickName } from "@/lib/i18n";
import { useGarage } from "./GarageProvider";
import { useLang, useT } from "./LangProvider";

type Fit = Partial<Pick<ProductDetail, "fitCars" | "fitCarCount" | "fitKeys" | "fitsVehicleIds" | "fitVersions" | "fitVersionNames">>;
type Props = Fit & { productId?: string };

const TEXT = {
  en: { fits: "This part fits:", yourCar: "Your car:", more: (n: number) => `+${n} more` },
  ar: { fits: "هذه القطعة تناسب:", yourCar: "سيارتك:", more: (n: number) => `+${n} أخرى` },
} as const;

// What a cart item fits is read once per part and remembered, so a cart does not ask again for every redraw. A part that cannot be read simply shows no message.
const remembered = new Map<string, Promise<Fit | null>>();
function loadFit(productId: string): Promise<Fit | null> {
  if (!remembered.has(productId)) {
    remembered.set(productId, fetchProductById(productId).then((p) => (p ? { fitCars: p.fitCars, fitCarCount: p.fitCarCount, fitKeys: p.fitKeys, fitsVehicleIds: p.fitsVehicleIds, fitVersions: p.fitVersions, fitVersionNames: p.fitVersionNames } : null)).catch(() => null));
  }
  return remembered.get(productId) as Promise<Fit | null>;
}

/**
 * Tells the buyer whether a part fits THEIR car (the default car of My Garage), on the product page and in the cart:
 *   - their car (model and year) is on the part's fitment list  ->  the green "Confirmed fit: <your car>";
 *   - it is not  ->  "This part fits: BAIC BJ60 · 2022 (+2 more). Your car: Toyota Corolla · 2018." (information only: the buyer can still order);
 *   - no car in My Garage, or the part fits any car (no fitment list)  ->  nothing.
 * The product page passes what the product already carries; in the cart only the productId is given and the fit is read from the product. A part that only has the older fit list
 * (generations without a year) still gets the green message when its model matches.
 */
export default function FitCheck({ productId, fitCars, fitCarCount, fitKeys, fitsVehicleIds, fitVersions, fitVersionNames }: Props) {
  const { defaultVehicle } = useGarage();
  const lang = useLang();
  const t = useT();
  const given = fitCars !== undefined || fitsVehicleIds !== undefined;
  const [loaded, setLoaded] = useState<Fit | null>(null);
  useEffect(() => {
    if (given || !productId || !defaultVehicle) return;
    let live = true;
    loadFit(productId).then((f) => { if (live) setLoaded(f); });
    return () => { live = false; };
  }, [given, productId, defaultVehicle]);

  const fit: Fit | null = given ? { fitCars, fitCarCount, fitKeys, fitsVehicleIds, fitVersions, fitVersionNames } : loaded;
  if (!defaultVehicle || !fit) return null;

  const verdict = fitVerdict(defaultVehicle, fit, lang);
  if (verdict.kind === "fits" || verdict.kind === "fits_versions") {
    return (
      <>
        <p role="status" className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#e2f4ec] px-3.5 py-1.5 text-sm font-bold text-[#0f6b49]">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          {t("confirmed_fit_for", { car: vehicleLabel(lang, defaultVehicle) })}
        </p>
        {verdict.kind === "fits_versions" && <p data-testid="fit-versions" className="mt-1 text-[13px] text-muted">{t("fit_part_is_for", { versions: verdict.versions.join(", ") })}</p>}
      </>
    );
  }
  if (verdict.kind === "wrong_version") {
    return (
      <div role="status" data-testid="fit-wrong-version" className="mt-3 rounded-xl border border-[#f0d9a0] bg-[#fff8e5] px-4 py-3 text-sm leading-relaxed text-[#7a4e00]">
        <p><strong>{t("fit_wrong_version")}</strong></p>
        <p>{t("fit_wrong_version_detail", { versions: verdict.versions.join(", "), car: vehicleLabel(lang, defaultVehicle) })}</p>
      </div>
    );
  }
  if (verdict.kind === "need_version") {
    return (
      <div role="status" data-testid="fit-need-version" className="mt-3 rounded-xl border border-line bg-[#eef1f3] px-4 py-3 text-sm leading-relaxed text-ink">
        <p>{t("fit_need_version", { car: vehicleLabel(lang, defaultVehicle), versions: verdict.versions.join(", ") })} <a href={lang === "ar" ? "/ar/garage" : "/garage"} className="font-bold underline">{t("fit_choose_version")}</a></p>
      </div>
    );
  }
  const cars = fit.fitCars ?? [];
  const total = fit.fitCarCount ?? cars.length;
  if (total === 0 || cars.length === 0) return null;
  const x = TEXT[lang] ?? TEXT.en;
  const list = cars.map((c) => `${pickName(lang, c.brand ?? "", c.brandAr)} ${pickName(lang, c.model ?? "", c.modelAr)}${c.year ? ` · ${c.year}` : ""}`.trim()).join(", ");
  return (
    <div role="status" className="mt-3 rounded-xl bg-[#fdf3e1] px-4 py-3 text-sm leading-relaxed text-[#7a4e00]">
      <p><strong>{x.fits}</strong> {list}{total > cars.length ? ` (${x.more(total - cars.length)})` : ""}</p>
      <p><strong>{x.yourCar}</strong> {vehicleLabel(lang, defaultVehicle)}</p>
    </div>
  );
}
