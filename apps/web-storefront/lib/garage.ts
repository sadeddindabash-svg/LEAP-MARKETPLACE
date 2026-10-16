import type { GarageVehicle } from "./api";
import { pickName, type Lang } from "./i18n";

/** "BYD Seal DM-i": the car's name in the page's language (the Arabic brand and model when they have one). */
export function vehicleName(lang: Lang, v: Pick<GarageVehicle, "brand" | "brandAr" | "model" | "modelAr">): string {
  return `${pickName(lang, v.brand, v.brandAr)} ${pickName(lang, v.model, v.modelAr)}`.trim();
}

/** "BYD Seal DM-i · 2024". */
export function vehicleLabel(lang: Lang, v: Pick<GarageVehicle, "brand" | "brandAr" | "model" | "modelAr" | "year">): string {
  return `${vehicleName(lang, v)} · ${v.year}`;
}

/** A car's picture is its YEAR photo, else its BRAND photo, else none (the screen then shows a generic icon): the same order as the mobile app. */
export function vehiclePhoto(v: Pick<GarageVehicle, "generationPhotoUrl" | "brandPhotoUrl">): string | null {
  return v.generationPhotoUrl || v.brandPhotoUrl || null;
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

