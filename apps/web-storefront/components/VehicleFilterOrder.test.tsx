import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// "My vehicle" on the products page: Brand -> Model -> YEAR -> GENERATION (the same order as My Garage), with the shop's brands, models and generations replaced by fixed ones.
const m = vi.hoisted(() => ({ push: vi.fn(), params: { current: "" } }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(m.params.current), usePathname: () => "/search", useRouter: () => ({ push: m.push }) }));
vi.mock("@/components/useLocRouter", () => ({ useLocRouter: () => ({ push: m.push }) }));
const gen = (id: string, name: string, yearStart: number, yearEnd: number | null) => ({ id, name, yearStart, yearEnd });
vi.mock("@/lib/api", () => ({
  fetchVehicleBrands: vi.fn(async () => [{ id: "b1", name: "BYD", nameAr: "بي واي دي" }]),
  fetchModelsForBrand: vi.fn(async () => [{ id: "m1", name: "Seal", nameAr: "سيل" }, { id: "m2", name: "Dolphin", nameAr: "دولفين" }, { id: "m3", name: "Atto", nameAr: "أتو" }]),
  fetchGenerationsForModel: vi.fn(async (modelId: string) => (modelId === "m1" ? [gen("g1", "First", 2018, 2021), gen("g2", "Second", 2020, 2023), gen("g3", "Third", 2024, null)] : modelId === "m3" ? [gen("g8", "Eight", 2019, 2022)] : [gen("g9", "Only", 2022, 2022)])),
}));
import { VehicleFilter } from "./VehicleFilter";
import { LangProvider } from "./LangProvider";

const show = (lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}><VehicleFilter /></LangProvider>);
const pick = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const options = (label: string) => [...(screen.getByLabelText(label) as HTMLSelectElement).options].map((o) => o.textContent);
const chooseModel = async (modelId = "m1") => { show(); await screen.findByRole("option", { name: "BYD" }); pick("Select brand…", "b1"); await screen.findByRole("option", { name: "Seal" }); pick("Select model…", modelId); await screen.findByLabelText("Select year…"); };
beforeEach(() => { m.push.mockClear(); m.params.current = ""; });

describe("the steps are brand, model, year, generation", () => {
  it("only the brand at first; the model after the brand; the YEAR after the model; no generation yet", async () => {
    show(); await screen.findByRole("option", { name: "BYD" });
    expect(screen.queryByLabelText("Select model…")).not.toBeInTheDocument(); pick("Select brand…", "b1");
    await screen.findByRole("option", { name: "Seal" }); expect(screen.queryByLabelText("Select year…")).not.toBeInTheDocument(); pick("Select model…", "m1");
    expect(await screen.findByLabelText("Select year…")).toBeInTheDocument(); expect(screen.queryByLabelText("Select generation…")).not.toBeInTheDocument();
  });
  it("the years offered are every year any generation of the model covers, each once, newest first (and an open-ended generation runs to this year)", async () => {
    await chooseModel(); const years = options("Select year…").slice(1).map(Number); const now = new Date().getFullYear();
    expect(years[0]).toBe(now); expect(years).toEqual([...years].sort((a, b) => b - a)); expect(new Set(years).size).toBe(years.length);
    expect(years).toContain(2020); expect(years).toContain(2018); expect(years).not.toContain(2017); expect(years).toHaveLength(now - 2018 + 1);
  });
  it("a year covered by ONE generation is applied at once, with no generation question", async () => {
    await chooseModel(); pick("Select year…", "2018");
    await waitFor(() => expect(m.push).toHaveBeenCalledWith("/search?generationId=g1&year=2018")); expect(screen.queryByLabelText("Select generation…")).not.toBeInTheDocument();
  });
  it("a year covered by TWO generations asks which one, offering exactly those two, and applies nothing until it is chosen", async () => {
    await chooseModel(); pick("Select year…", "2021");
    expect(await screen.findByLabelText("Select generation…")).toBeInTheDocument(); expect(options("Select generation…")).toEqual(["Select generation…", "First (2018–2021)", "Second (2020–2023)"]); expect(m.push).not.toHaveBeenCalled();
    pick("Select generation…", "g2"); expect(m.push).toHaveBeenCalledWith("/search?generationId=g2&year=2021");
  });
  it("an open-ended generation reads 'present' in its name", async () => {
    await chooseModel(); pick("Select year…", String(new Date().getFullYear())); expect(m.push).toHaveBeenCalledWith(`/search?generationId=g3&year=${new Date().getFullYear()}`);
  });
  it("changing the year takes the generation question away or asks it again, and changing the model starts over", async () => {
    await chooseModel(); pick("Select year…", "2021"); await screen.findByLabelText("Select generation…"); pick("Select year…", "2019");
    await waitFor(() => expect(screen.queryByLabelText("Select generation…")).not.toBeInTheDocument()); expect(m.push).toHaveBeenLastCalledWith("/search?generationId=g1&year=2019");
    pick("Select model…", "m2"); await waitFor(() => expect(options("Select year…")).toEqual(["Select year…", "2022"])); expect((screen.getByLabelText("Select year…") as HTMLSelectElement).value).toBe("");
  });
  it("switching to another model that ALSO covers the chosen year does not keep that year or its generation question", async () => {
    await chooseModel(); pick("Select year…", "2021"); await screen.findByLabelText("Select generation…"); m.push.mockClear();
    pick("Select model…", "m3"); await screen.findByRole("option", { name: "2019" });
    expect((screen.getByLabelText("Select year…") as HTMLSelectElement).value).toBe(""); expect(screen.queryByLabelText("Select generation…")).not.toBeInTheDocument(); expect(m.push).not.toHaveBeenCalled();
  });
  it("a model with a single generation of one year offers that year and applies it", async () => {
    await chooseModel("m2"); pick("Select year…", "2022"); expect(m.push).toHaveBeenCalledWith("/search?generationId=g9&year=2022");
  });
  it("there is no 'any year' choice any more: a specific year is chosen", async () => {
    await chooseModel(); expect(options("Select year…").some((o) => /any year/i.test(o ?? ""))).toBe(false);
  });
  it("the other search words and the section are kept when a vehicle is chosen, and Clear removes only the vehicle", async () => {
    m.params.current = "q=disc&category=brake&generationId=g1&year=2019"; await chooseModel(); pick("Select year…", "2018");
    expect(m.push).toHaveBeenCalledWith("/search?q=disc&category=brake&generationId=g1&year=2018");
    fireEvent.click(screen.getByRole("button", { name: "Clear" })); expect(m.push).toHaveBeenLastCalledWith("/search?q=disc&category=brake");
  });
  it("Arabic wording", async () => {
    show("ar"); await screen.findByRole("option", { name: "بي واي دي" }); pick("اختر الماركة…", "b1"); await screen.findByRole("option", { name: "سيل" }); pick("اختر الموديل…", "m1");
    expect(await screen.findByLabelText("اختر السنة…")).toBeInTheDocument();
  });
});
