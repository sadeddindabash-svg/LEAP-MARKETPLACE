"use client";

import Link from "@/components/LocLink";
import { vehicleLabel, searchHrefFor } from "@/lib/garage";
import { useAuth } from "./AuthProvider";
import { useGarage } from "./GarageProvider";
import { useLang, useT } from "./LangProvider";

/** "Shopping for BYD Seal DM-i · 2024 (Change)": the signed-in buyer's default car, under the menu. Nothing is shown to visitors who are not signed in. */
export default function VehicleBar() {
  const { user } = useAuth();
  const { defaultVehicle: car, loading } = useGarage();
  const lang = useLang();
  const t = useT();
  if (!user || loading) return null;
  return (
    <div className="border-b border-line bg-white text-ink">
      <div className="mx-auto flex min-h-12 max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 sm:px-8">
        {car ? (
          <>
            <span className="text-[13px] text-muted">{t("shopping_for")}</span>
            <Link href={searchHrefFor(car)} className="inline-flex min-h-9 items-center rounded-full bg-navy px-3.5 text-sm font-bold text-white">{vehicleLabel(lang, car)}</Link>
            <Link href="/garage" className="text-sm underline underline-offset-4">{t("change")}</Link>
          </>
        ) : (
          <Link href="/garage" className="text-sm font-semibold text-navy underline underline-offset-4">{t("add_your_car")}</Link>
        )}
      </div>
    </div>
  );
}
