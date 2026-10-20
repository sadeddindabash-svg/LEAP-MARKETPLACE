import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { VehicleChoice } from "./VehicleCascade";

const m = vi.hoisted(() => ({ versions: vi.fn() }));
vi.mock("@/lib/api", () => ({
  fetchVehicleBrands: async () => [{ id: "b1", name: "AITO", nameAr: "أيتو" }],
  fetchModelsForBrand: async () => [{ id: "m1", brandId: "b1", name: "M5", nameAr: "إم5" }],
  fetchGenerationsForModel: async () => [{ id: "gen22", modelId: "m1", name: "2022", yearStart: 2022, yearEnd: 2022 }, { id: "gen23", modelId: "m1", name: "2023", yearStart: 2023, yearEnd: 2023 }],
  fetchVersionsForGeneration: (...a: unknown[]) => m.versions(...a),
  resolveImageUrl: (u: string) => u,
}));
import VehicleCascade from "./VehicleCascade";
import { LangProvider } from "./LangProvider";

const V1 = { id: "v1", generationId: "gen22", name: "AWD Flagship", nameAr: "دفع كلي فلاجشيب", engine: "1.5T range extender (365 kW)", engineAr: "1.5 لتر موسع مدى", seats: 5, photoUrl: "/uploads/v1.png" };
const V2 = { id: "v2", generationId: "gen22", name: "RWD Standard", nameAr: "دفع خلفي ستاندرد", engine: "Electric (200 kW)", engineAr: "محرك كهربائي", seats: 6, photoUrl: null };

let seen: Array<VehicleChoice | null>;
const show = (props: { withVersions?: boolean } = {}, lang: "en" | "ar" = "en") =>
  render(<LangProvider lang={lang}><VehicleCascade idPrefix="t" onChange={(c) => seen.push(c)} {...props} /></LangProvider>);
const last = () => seen[seen.length - 1];
async function pickYear(year = "gen22:2022", labels = { brand: "Brand", model: "Model", year: "Year" }) {
  fireEvent.change(await screen.findByLabelText(labels.brand, undefined, { timeout: 5000 }), { target: { value: "b1" } });
  await waitFor(() => expect(within(screen.getByLabelText(labels.model)).getAllByRole("option").length).toBeGreaterThan(1));
  fireEvent.change(screen.getByLabelText(labels.model), { target: { value: "m1" } });
  await waitFor(() => expect(within(screen.getByLabelText(labels.year)).getAllByRole("option").length).toBeGreaterThan(1));
  await act(async () => { fireEvent.change(screen.getByLabelText(labels.year), { target: { value: year } }); });
}

beforeEach(() => { seen = []; m.versions.mockReset(); m.versions.mockResolvedValue([]); });
afterEach(() => vi.restoreAllMocks());

describe("the vehicle chooser's Version step", () => {
  it("CRITICAL: without withVersions it stops at the year exactly as before and never asks for versions (the home page picker, search filter and part requests)", async () => {
    show();
    await pickYear();
    expect(last()).toEqual({ generationId: "gen22", year: 2022, label: "AITO M5 · 2022" });
    expect(m.versions).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Version")).not.toBeInTheDocument();
  });

  it("with versions asked for, a year that has NONE completes at the year as before", async () => {
    show({ withVersions: true });
    await pickYear();
    await waitFor(() => expect(last()).toEqual({ generationId: "gen22", year: 2022, label: "AITO M5 · 2022" }), { timeout: 5000 });
    expect(m.versions).toHaveBeenCalledWith("gen22");
    expect(screen.queryByLabelText("Version")).not.toBeInTheDocument();
  });

  it("CRITICAL: a year WITH versions is not a complete choice until a version is chosen; then the car carries its version and the label names it", async () => {
    m.versions.mockResolvedValue([V1, V2]);
    show({ withVersions: true });
    await pickYear();
    const select = await screen.findByLabelText("Version", undefined, { timeout: 5000 });
    expect(last()).toBeNull();                                                         // not complete yet
    expect(screen.getByText("Choose the version to save this car")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "AWD Flagship · 1.5T range extender (365 kW) · 5 seats" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "RWD Standard · Electric (200 kW) · 6 seats" })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "v1" } });
    expect(last()).toMatchObject({ generationId: "gen22", year: 2022, versionId: "v1", label: "AITO M5 · 2022 · AWD Flagship", version: { id: "v1", seats: 5 } });
    const preview = screen.getByTestId("version-preview");
    expect(within(preview).getByText("AWD Flagship")).toBeInTheDocument();
    expect(within(preview).getByText("1.5T range extender (365 kW)")).toBeInTheDocument();
    expect(within(preview).getByText("5 seats")).toBeInTheDocument();
    expect(screen.queryByText("Choose the version to save this car")).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: "" } });                                // back to "Choose version"
    expect(last()).toBeNull();
  });

  it("CRITICAL: choosing another year clears the version (and the choice is incomplete again), and another brand clears everything", async () => {
    m.versions.mockResolvedValue([V1, V2]);
    show({ withVersions: true });
    await pickYear();
    fireEvent.change(await screen.findByLabelText("Version", undefined, { timeout: 5000 }), { target: { value: "v2" } });
    expect(last()).toMatchObject({ versionId: "v2" });
    m.versions.mockResolvedValue([{ ...V1, id: "v3", generationId: "gen23", name: "2023 Edition" }]);
    await act(async () => { fireEvent.change(screen.getByLabelText("Year"), { target: { value: "gen23:2023" } }); });
    await screen.findByRole("option", { name: /2023 Edition/ }, { timeout: 5000 });
    expect(last()).toBeNull();
    expect((screen.getByLabelText("Version") as HTMLSelectElement).value).toBe("");
    fireEvent.change(screen.getByLabelText("Brand"), { target: { value: "" } });
    expect(last()).toBeNull();
    expect(screen.queryByLabelText("Version")).not.toBeInTheDocument();
  });

  it("CRITICAL: a late answer for a year the buyer has already left is dropped (it can never complete the wrong car)", async () => {
    let releaseOld: (v: unknown) => void = () => {};
    m.versions.mockImplementation((id: string) => (id === "gen22" ? new Promise((resolve) => { releaseOld = resolve; }) : Promise.resolve([])));
    show({ withVersions: true });
    await pickYear("gen22:2022");                                                        // its versions are still on the way...
    await act(async () => { fireEvent.change(screen.getByLabelText("Year"), { target: { value: "gen23:2023" } }); });   // ...the buyer chooses another year (no versions)
    await waitFor(() => expect(last()).toEqual({ generationId: "gen23", year: 2023, label: "AITO M5 · 2023" }), { timeout: 5000 });
    await act(async () => { releaseOld([V1, V2]); });                                    // the old answer arrives
    expect(screen.queryByLabelText("Version")).not.toBeInTheDocument();
    expect(last()).toEqual({ generationId: "gen23", year: 2023, label: "AITO M5 · 2023" });
  });

  it("in Arabic the version, engine and seats are Arabic (the seats in the right form)", async () => {
    m.versions.mockResolvedValue([V1, V2, { ...V1, id: "v4", name: "Two seater", nameAr: "ثنائي", engineAr: "محرك", seats: 2 }]);
    show({ withVersions: true }, "ar");
    await pickYear("gen22:2022", { brand: "الماركة", model: "الموديل", year: "السنة" });
    await screen.findByLabelText("الفئة", undefined, { timeout: 5000 });
    expect(screen.getByRole("option", { name: "دفع كلي فلاجشيب · 1.5 لتر موسع مدى · 5 مقاعد" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "ثنائي · محرك · مقعدان" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("الفئة"), { target: { value: "v1" } });
    expect(last()).toMatchObject({ label: "أيتو إم5 · 2022 · دفع كلي فلاجشيب" });
  });

  it("CRITICAL: the Version block spans the FULL width (col-span-full), never a fixed 3 columns: the garage page stacks the dropdowns in ONE column, and a 3-column span there made the Brand, Model and Year dropdowns overlap", () => {
    const source = readFileSync(join(__dirname, "VehicleCascade.tsx"), "utf-8");
    expect(source).toContain("col-span-full");
    expect(source).not.toMatch(/sm:col-span-3/);
  });
});
