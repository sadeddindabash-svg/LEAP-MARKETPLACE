"use client";

import { useEffect, useState } from "react";
import Link from "@/components/LocLink";
import { fetchProductById, type ProductDetail } from "@/lib/api";
import { vehicleLabel } from "@/lib/garage";
import { fitVerdict } from "@/lib/fitVerdict";
import { pickName } from "@/lib/i18n";
import { useGarage } from "./GarageProvider";
import { useLang, useT } from "./LangProvider";

type Fit = Partial<Pick<ProductDetail, "fitCars" | "fitCarCount" | "fitKeys" | "fitsVehicleIds" | "fitVersions" | "fitVersionNames" | "category" | "part">>;

// What a basket line fits is read once per part and remembered, so the basket does not ask again for every redraw. A part that cannot be read shows nothing.
const remembered = new Map<string, Promise<Fit | null>>();
function loadFit(productId: string): Promise<Fit | null> {
  if (!remembered.has(productId)) {
    remembered.set(productId, fetchProductById(productId).then((p) => (p ? { fitCars: p.fitCars, fitCarCount: p.fitCarCount, fitKeys: p.fitKeys, fitsVehicleIds: p.fitsVehicleIds, fitVersions: p.fitVersions, fitVersionNames: p.fitVersionNames, category: p.category, part: p.part } : null)).catch(() => null));
  }
  return remembered.get(productId) as Promise<Fit | null>;
}

/** What a basket line says about the buyer's car (the default car of My Garage). */
export type CartFitResult =
  | { kind: "fit"; car: string }
  | { kind: "not_fit"; forText: string; car: string; findHref: string }
  | { kind: "need_version"; car: string; versions: string }
  | null;

/**
 * Does this basket line fit the buyer's car? The same rules as the product page (lib/fitVerdict): on the part's list (and the version, when it is narrowed) = fit;
 * a different car or version = not fit (with what it IS for, and a search for this part for the buyer's car); a car whose version is not chosen yet = ask for it.
 * No car in My Garage, or a part that fits any car (no list) = nothing.
 */
export function useCartFit(productId: string): CartFitResult {
  const { defaultVehicle } = useGarage();
  const lang = useLang();
  const [fit, setFit] = useState<{ id: string; fit: Fit | null } | null>(null);
  useEffect(() => {
    if (!defaultVehicle) return;
    let live = true;
    loadFit(productId).then((f) => { if (live) setFit({ id: productId, fit: f }); });
    return () => { live = false; };
  }, [productId, defaultVehicle]);
  const f = fit?.id === productId ? fit.fit : null;
  if (!defaultVehicle || !f) return null;
  const car = vehicleLabel(lang, defaultVehicle);
  const verdict = fitVerdict(defaultVehicle, f, lang);
  const findHref = (() => {
    const q = new URLSearchParams();
    if (f.category) q.set("category", f.category);
    if (f.part) q.set("part", f.part);
    q.set("generationId", defaultVehicle.generationId);
    q.set("year", String(defaultVehicle.year));
    if (defaultVehicle.versionId) q.set("versionId", defaultVehicle.versionId);
    return `/search?${q.toString()}`;
  })();
  if (verdict.kind === "fits" || verdict.kind === "fits_versions") return { kind: "fit", car };
  if (verdict.kind === "need_version") return { kind: "need_version", car, versions: verdict.versions.join(", ") };
  if (verdict.kind === "wrong_version") return { kind: "not_fit", forText: verdict.versions.join(", "), car, findHref };
  const cars = f.fitCars ?? [];
  const total = f.fitCarCount ?? cars.length;
  if (total === 0 || cars.length === 0) return null;                    // fits any car: nothing to say
  const list = cars.map((c) => `${pickName(lang, c.brand ?? "", c.brandAr)} ${pickName(lang, c.model ?? "", c.modelAr)}${c.year ? ` · ${c.year}` : ""}`.trim()).join(", ");
  const more = total > cars.length ? ` (+${total - cars.length})` : "";
  return { kind: "not_fit", forText: `${list}${more}`, car, findHref };
}

/** The ribbon across the corner of the line's photo: green "✓ FIT" / red "✕ NOT FIT" (it moves to the other corner in Arabic). Draws nothing otherwise. */
export function FitRibbon({ fit }: { fit: CartFitResult }) {
  const t = useT();
  if (!fit || fit.kind === "need_version") return null;
  const ok = fit.kind === "fit";
  return (
    <span data-testid="fit-ribbon" data-fit={ok ? "fit" : "not_fit"} aria-hidden="true"
      className={`pointer-events-none absolute -start-10 top-[18px] z-10 w-36 -rotate-[38deg] py-[3px] text-center text-[10px] font-extrabold uppercase tracking-wide text-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] rtl:rotate-[38deg] rtl:tracking-normal ${ok ? "bg-[#1e9d6b]" : "bg-[#c62f26]"}`}>
      {t(ok ? "cart_fit_ribbon_ok" : "cart_fit_ribbon_bad")}
    </span>
  );
}

/** The one line under the part's name that goes with the ribbon. */
export function CartFitLine({ fit }: { fit: CartFitResult }) {
  const t = useT();
  const lang = useLang();
  if (!fit) return null;
  if (fit.kind === "fit") return <p role="status" data-testid="cart-fit" className="mt-2 text-sm font-bold text-[#0f6b49]"><bdi>{t("cart_fit_ok", { car: fit.car })}</bdi></p>;
  if (fit.kind === "need_version") {
    return (
      <p role="status" data-testid="cart-fit-need-version" className="mt-2 text-sm text-ink">
        {t("fit_need_version", { car: fit.car, versions: fit.versions })} <a href={lang === "ar" ? "/ar/garage" : "/garage"} className="font-bold underline">{t("fit_choose_version")}</a>
      </p>
    );
  }
  return (
    <div role="status" data-testid="cart-not-fit" className="mt-2 text-sm">
      <p className="font-bold text-[#a12a21]"><bdi>{t("cart_fit_for", { for: fit.forText, car: fit.car })}</bdi></p>
      <Link href={fit.findHref} className="text-[13px] font-bold text-navy underline underline-offset-4">{t("cart_fit_find")}</Link>
    </div>
  );
}
