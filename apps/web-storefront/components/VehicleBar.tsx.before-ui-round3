"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "@/components/LocLink";
import { resolveImageUrl } from "@/lib/api";
import { vehicleLabel } from "@/lib/garage";
import { useAuth } from "./AuthProvider";
import { useGarage } from "./GarageProvider";
import { useLang, useT } from "./LangProvider";

/**
 * The "Shopping for" container, like the mobile app's card: the small label, the buyer's default car in a dark chip ("BYD Seal DM-i · 2024", plus its version when it has one) and the car's picture in an angled panel (its version's
 * photo, else its year's, else its brand's, else a plain car icon). The whole container opens My garage. It is shown to everyone: with no car (or signed out) it says "Add a vehicle". While the sign-in or the garage is still being
 * read it is an empty box of the same size, so the page never jumps and never shows a wrong word.
 *
 * Two places, one at a time: `where="menu"` is the end of the menu row (computer screens: the row is 48 px high and the container 40 px, so the row does not grow); `where="row"` is its own row under the menu (phones and
 * narrow screens). A car name that is too long for the space is cut with "…" on one line; the full text is in the tooltip and in the accessible name.
 */
function CarIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" />
    </svg>
  );
}

const CARD = "group flex h-10 w-full min-w-0 items-center overflow-hidden rounded-[10px] border border-line bg-chalk text-ink hover:border-navy";

export default function VehicleBar({ where }: { where: "menu" | "row" }) {
  const { user, isLoading } = useAuth();
  const { defaultVehicle: car, loading } = useGarage();
  const lang = useLang();
  const t = useT();
  const [failedPhotos, setFailedPhotos] = useState<string[]>([]);

  const place = (card: React.ReactNode) =>
    where === "menu" ? (
      <div data-where="menu" className="ms-auto hidden min-w-[17rem] max-w-[34rem] shrink lg:block">{card}</div>
    ) : (
      <div data-where="row" className="border-b border-line bg-white lg:hidden"><div className="mx-auto max-w-7xl px-4 py-1.5 sm:px-8">{card}</div></div>
    );

  if (isLoading || (user && loading)) return place(<div aria-hidden="true" data-testid="vehicle-card-loading" className="h-10 w-full rounded-[10px] bg-chalk" />);

  const label = <span className="text-[9.5px] leading-none text-muted">{t("shopping_for")}</span>;

  if (!user || !car) {
    return place(
      <Link href="/garage" data-testid="vehicle-card" data-state="empty" aria-label={`${t("shopping_for")}: ${t("add_a_vehicle")}`} className={CARD}>
        <CarIcon className="ms-3 shrink-0 text-muted" />
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 ps-2 pe-2">
          {label}
          <span className="truncate text-[13px] font-semibold leading-4 text-navy">{t("add_a_vehicle")}</span>
        </span>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="me-3 shrink-0 text-muted rtl:rotate-180"><path d="m9 18 6-6-6-6" /></svg>
      </Link>,
    );
  }

  const full = vehicleLabel(lang, car);
  // The car's pictures, most specific first (its version's photo, its year's, its brand's: the order of vehiclePhoto() in lib/garage.ts). One that cannot be loaded is skipped: the next is tried before the plain icon.
  const photo = [car.version?.photoUrl, car.generationPhotoUrl, car.brandPhotoUrl].find((u): u is string => !!u && !failedPhotos.includes(u)) ?? null;
  return place(
    <Link href="/garage" data-testid="vehicle-card" data-state="car" aria-label={`${t("shopping_for")}: ${full}`} title={full} className={CARD}>
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 ps-3 pe-2">
        {label}
        <span className="block w-fit max-w-full truncate rounded-md bg-navy px-2 py-0.5 font-plate text-[12px] font-bold leading-4 text-white">{full}</span>
      </span>
      <span data-testid="vehicle-card-picture" className="relative h-full w-24 shrink-0 bg-white [clip-path:polygon(22%_0,100%_0,100%_100%,0_100%)] rtl:[clip-path:polygon(0_0,78%_0,100%_100%,0_100%)]">
        {photo ? (
          <Image src={resolveImageUrl(photo)} alt="" fill sizes="96px" unoptimized className="object-contain p-1" onError={() => setFailedPhotos((f) => [...f, photo])} />
        ) : (
          <span className="grid h-full w-full place-items-center text-muted"><CarIcon /></span>
        )}
      </span>
    </Link>,
  );
}
