import type { GarageVehicle } from "./api";
import { pickName, t, type Lang } from "./i18n";

/** "BYD Seal DM-i": the car's name in the page's language (the Arabic brand and model when they have one). */
export function vehicleName(lang: Lang, v: Pick<GarageVehicle, "brand" | "brandAr" | "model" | "modelAr">): string {
  return `${pickName(lang, v.brand, v.brandAr)} ${pickName(lang, v.model, v.modelAr)}`.trim();
}

/** "BYD Seal DM-i · 2024", and "AITO M5 · 2022 · AWD Flagship" when the car has a version (in the page's language). */
export function vehicleLabel(lang: Lang, v: Pick<GarageVehicle, "brand" | "brandAr" | "model" | "modelAr" | "year"> & { version?: { name: string; nameAr?: string | null } | null }): string {
  const base = `${vehicleName(lang, v)} · ${v.year}`;
  return v.version ? `${base} · ${pickName(lang, v.version.name, v.version.nameAr)}` : base;
}

/** A car's picture is its VERSION's photo, else its YEAR photo, else its BRAND photo, else none (the screen then shows a generic icon). */
export function vehiclePhoto(v: Pick<GarageVehicle, "generationPhotoUrl" | "brandPhotoUrl"> & { version?: { photoUrl?: string | null } | null }): string | null {
  return v.version?.photoUrl || v.generationPhotoUrl || v.brandPhotoUrl || null;
}

/** What tells two saved cars apart: the year's id, the year, and the version (two versions of one year are two cars; no version is its own kind). */
export function vehicleKey(v: Pick<GarageVehicle, "generationId" | "year"> & { versionId?: string | null }): string {
  return `${v.generationId}:${v.year}:${v.versionId ?? ""}`;
}

/** "1 seat", "2 seats", "5 seats" and in Arabic "مقعد واحد", "مقعدان", "5 مقاعد", "11 مقعدًا" (the right form for each number). */
export function seatsText(lang: Lang, seats: number): string {
  const key = seats === 1 ? "seats_one" : seats === 2 ? "seats_two" : lang === "ar" && seats > 10 ? "seats_many" : "seats_other";
  return t(lang, key, { n: seats });
}

/** The car that drives "Shopping for" and "Fits my car": the one marked default, else the first saved. */
export function defaultVehicle(list: GarageVehicle[]): GarageVehicle | null {
  return list.find((v) => v.isDefault) ?? list[0] ?? null;
}

/** The search address for a car's parts. */
export function searchHrefFor(v: Pick<GarageVehicle, "generationId" | "year">): string {
  return `/search?generationId=${encodeURIComponent(v.generationId)}&year=${v.year}`;
}

/**
 * How many cars a buyer can save. The SERVER enforces it (services/api/src/modules/garage/routes.js, the same number); this is only so the page can show "3 of 5" and not offer
 * what the server would refuse. A real-server test fails if the two ever disagree.
 */
export const MAX_GARAGE_VEHICLES = 5;
/** The garage is full when the buyer has the limit (or, from before the limit existed, more): they can keep every car but cannot add another. */
export const isGarageFull = (count: number): boolean => count >= MAX_GARAGE_VEHICLES;

