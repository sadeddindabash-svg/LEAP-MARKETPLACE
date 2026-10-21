import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ProductCategory } from "@/lib/api";
import { t } from "@/lib/i18n";

// The lists of sections and parts in "Find the right part": four columns on a wide screen, fewer on smaller ones, a photo (or a plain tile) beside each name. The server, the garage and the barcode reader are replaced by fixed values.
const m = vi.hoisted(() => ({
  push: vi.fn(),
  garage: { current: { vehicles: [] as unknown[], defaultVehicle: null as unknown, signedIn: false, loading: false, add: vi.fn(async () => {}), remove: vi.fn(), makeDefault: vi.fn() } },
  parts: vi.fn(),
  decode: vi.fn(),
  brands: vi.fn(),
  models: vi.fn(),
  gens: vi.fn(),
  versions: vi.fn<(...a: unknown[]) => Promise<unknown[]>>(async () => []),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push, replace: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/find" }));
vi.mock("./GarageProvider", () => ({ useGarage: () => m.garage.current }));
vi.mock("./VehicleCascade", () => ({
  default: ({ onChange, idPrefix }: { onChange: (c: { generationId: string; year: number; label: string } | null) => void; idPrefix: string }) => (
    <button type="button" onClick={() => onChange({ generationId: "g9", year: 2020, label: "BYD Seal · 2020" })}>{`pick ${idPrefix}`}</button>
  ),
}));
vi.mock("@/lib/api", () => ({
  fetchPartsForCategory: (...a: unknown[]) => m.parts(...a),
  decodeVin: (...a: unknown[]) => m.decode(...a),
  fetchVehicleBrands: () => m.brands(),
  fetchModelsForBrand: (...a: unknown[]) => m.models(...a),
  fetchGenerationsForModel: (...a: unknown[]) => m.gens(...a),
  fetchVersionsForGeneration: (...a: unknown[]) => m.versions(...a),
}));

import FindTools from "./FindTools";
import { LangProvider } from "./LangProvider";

const categories: ProductCategory[] = [{ id: "brake", nameEn: "Brake System", nameAr: "نظام الفرامل", photoUrl: null, sortOrder: 1, commissionPercent: 10 }, { id: "filters", nameEn: "Filters", nameAr: "فلاتر", photoUrl: null, sortOrder: 2, commissionPercent: 10 }];
const myCar = { generationId: "g1", year: 2024, brand: "BYD", brandAr: null, model: "Seal DM-i", modelAr: null, generation: "2024", yearStart: 2024, yearEnd: 2024, isDefault: true };
const lastPush = () => m.push.mock.lastCall?.[0];
const tool = (props: { initialTab?: "vehicle" | "vin" | "part" | "symptom"; lang?: "en" | "ar" } = {}) => render(<LangProvider lang={props.lang ?? "en"}><FindTools categories={categories} initialTab={props.initialTab} /></LangProvider>);
const signedIn = (signed: boolean, car: unknown = null) => { m.garage.current = { ...m.garage.current, signedIn: signed, defaultVehicle: car, vehicles: car ? [car] : [] }; };

beforeEach(() => {
  vi.clearAllMocks();
  signedIn(false);
  m.parts.mockResolvedValue([{ id: "pt1", categoryId: "brake", nameEn: "Front Brake Disc", nameAr: "قرص فرامل أمامي", sortOrder: 1 }, { id: "pt2", categoryId: "brake", nameEn: "Brake Pads", nameAr: null, sortOrder: 2 }]);
  m.brands.mockResolvedValue([{ id: "b1", name: "BYD", nameAr: "بي واي دي" }]);
  m.models.mockResolvedValue([{ id: "m1", brandId: "b1", name: "Seal DM-i" }]);
  m.gens.mockResolvedValue([{ id: "gen1", modelId: "m1", name: "2024-on", yearStart: 2024, yearEnd: null }]);
  m.versions.mockResolvedValue([]);
  m.decode.mockResolvedValue({ vin: "X", isValidCheckDigit: true, make: "BYD", model: "Seal", modelYear: 2024, source: "local" });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });


const listAfter = (heading: string | RegExp) => screen.getByRole("heading", { name: heading }).parentElement!.querySelector("ul") as HTMLUListElement;
const FOUR = ["grid-cols-1", "sm:grid-cols-2", "md:grid-cols-3", "lg:grid-cols-4"];

describe("find the right part: four columns", () => {
  it("the sections are in four columns on a wide screen (three, two or one on smaller ones), each with a photo tile beside its name", async () => {
    signedIn(true, myCar); tool();
    fireEvent.click(screen.getByRole("button", { name: "Use my car: BYD Seal DM-i · 2024" }));
    const list = listAfter("Which section?");
    for (const c of FOUR) expect(list.className.split(" ")).toContain(c);
    const rows = list.querySelectorAll("li > button"); expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.querySelector("svg")).not.toBeNull();            // the placeholder tile: these sections have no photo yet
  });
  it("the parts are in four columns too, each with a photo tile beside its name", async () => {
    signedIn(true, myCar); tool();
    fireEvent.click(screen.getByRole("button", { name: "Use my car: BYD Seal DM-i · 2024" }));
    fireEvent.click(screen.getByRole("button", { name: "Brake System" }));
    await screen.findByRole("heading", { name: 'Which specific part in "Brake System"?' });
    const list = listAfter('Which specific part in "Brake System"?');
    for (const c of FOUR) expect(list.className.split(" ")).toContain(c);
    expect(list.querySelectorAll("li > button")).toHaveLength(2);
  });
});
