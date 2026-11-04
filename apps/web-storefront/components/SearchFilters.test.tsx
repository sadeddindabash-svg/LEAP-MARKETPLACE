import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

// The filters of the results page: one bar (section, part, price, delivery, sort), the filters that are on as chips, and the car. Every choice is a new address.
const m = vi.hoisted(() => ({ params: { current: new URLSearchParams() }, push: vi.fn(), parts: vi.fn(), brands: vi.fn(), models: vi.fn(), gens: vi.fn(), gen: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => m.params.current, useRouter: () => ({ push: m.push, replace: vi.fn() }), usePathname: () => "/search" }));
vi.mock("@/lib/api", async () => ({
  ...(await vi.importActual<typeof import("@/lib/api")>("@/lib/api")),
  fetchPartsForCategory: (...a: unknown[]) => m.parts(...a),
  fetchVehicleBrands: () => m.brands(), fetchModelsForBrand: (...a: unknown[]) => m.models(...a), fetchGenerationsForModel: (...a: unknown[]) => m.gens(...a), fetchGeneration: (...a: unknown[]) => m.gen(...a),
}));
vi.mock("./CurrencyProvider", () => ({ useCurrency: () => ({ code: "SAR", rate: 3.75, format: (usd: number) => `SAR ${Math.round(usd * 3.75)}` }) }));
vi.mock("./FitsMyCarToggle", () => ({ default: () => <div data-testid="fits-toggle" /> }));
vi.mock("./SaveSearchButton", () => ({ SaveSearchButton: () => <div data-testid="save-search" /> }));

import { SearchFilters } from "./SearchFilters";
import { LangProvider } from "./LangProvider";

const sections = [{ id: "brake", nameEn: "Brake System", nameAr: "نظام الفرامل" }, { id: "engine", nameEn: "Engine", nameAr: "المحرك" }];
const show = async (query: string, lang: "en" | "ar" = "en") => {
  m.params.current = new URLSearchParams(query);
  await act(async () => { render(<LangProvider lang={lang}><SearchFilters sections={sections} heading={<h1>Title</h1>} /></LangProvider>); });
};
const opened = (name: RegExp) => { fireEvent.click(screen.getByRole("button", { name })); return screen.getByRole("dialog"); };
const pushed = () => new URL(m.push.mock.calls.at(-1)![0] as string, "http://x");

beforeEach(() => {
  vi.clearAllMocks();
  m.brands.mockResolvedValue([{ id: "changan", name: "Changan", nameAr: "شانجان" }, { id: "geely", name: "Geely", nameAr: "جيلي" }]);
  m.models.mockResolvedValue([{ id: "cs75", brandId: "changan", name: "CS75", nameAr: null }, { id: "cs35", brandId: "changan", name: "CS35", nameAr: null }]);
  m.gens.mockResolvedValue([{ id: "cs75_g2", modelId: "cs75", name: "CS75 Plus", yearStart: 2020, yearEnd: null }, { id: "cs75_g1", modelId: "cs75", name: "CS75", yearStart: 2014, yearEnd: 2020 }]);
  m.gen.mockResolvedValue({ id: "cs75_g2", modelId: "cs75", brandId: "changan", name: "CS75 Plus", yearStart: 2020, yearEnd: null });
  m.parts.mockResolvedValue([{ id: "a", categoryId: "brake", nameEn: "Front Brake Disc", nameAr: "قرص فرامل أمامي", sortOrder: 1 }, { id: "b", categoryId: "brake", nameEn: "Brake Pads", nameAr: null, sortOrder: 2 }]);
});

describe("the filter bar", () => {
  it("CRITICAL: shows each filter as 'Label: value', with the sort at the end; the title and the car are there too", async () => {
    await show("category=brake&part=Brake%20Pads&maxPrice=133.33&maxDeliveryDays=7&sort=price_asc");
    const bar = screen.getByRole("group", { name: "Filters" });
    expect(within(bar).getByRole("button", { name: /Section:\s*Brake System/ })).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: /Part:\s*Brake Pads/ })).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: /Price:\s*Up to SAR 500/ })).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: /Delivery:\s*Within 7 days/ })).toBeInTheDocument();
    expect(within(bar).getAllByRole("button").at(-1)).toHaveTextContent("Sort:Price: low to high");
    expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
    expect(screen.getByTestId("fits-toggle")).toBeInTheDocument();
  });

  it("CRITICAL: choosing another section drops the part and the page, and keeps everything else", async () => {
    await show("q=pads&category=brake&part=Brake%20Pads&generationId=g1&year=2019&sort=newest&page=3");
    fireEvent.click(within(opened(/Section:/)).getByRole("button", { name: "Engine" }));
    const url = pushed();
    expect(url.pathname).toBe("/search");
    expect(url.searchParams.get("category")).toBe("engine");
    expect(url.searchParams.has("part")).toBe(false); expect(url.searchParams.has("page")).toBe(false);
    expect(url.searchParams.get("q")).toBe("pads"); expect(url.searchParams.get("generationId")).toBe("g1"); expect(url.searchParams.get("sort")).toBe("newest");
  });

  it("the part dropdown is off until a section is chosen", async () => {
    await show("");
    expect(screen.getByRole("button", { name: /Part:\s*Choose a section first/ })).toBeDisabled();
    expect(m.parts).not.toHaveBeenCalled();
  });

  it("the part dropdown lists the parts of the chosen section; choosing one keeps its English name in the address", async () => {
    await show("category=brake");
    expect(m.parts).toHaveBeenCalledWith("brake");
    fireEvent.click(within(opened(/Part:/)).getByRole("button", { name: "Front Brake Disc" }));
    expect(pushed().searchParams.get("part")).toBe("Front Brake Disc");
  });

  it("CRITICAL: a price typed in the buyer's currency is kept in dollars (riyals / 3.75)", async () => {
    await show("category=brake");
    const dialog = opened(/Price:/);
    fireEvent.change(within(dialog).getByPlaceholderText("Min"), { target: { value: "100" } });
    fireEvent.change(within(dialog).getByPlaceholderText("Max"), { target: { value: "300" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Show results" }));
    expect(pushed().searchParams.get("minPrice")).toBe("26.67"); expect(pushed().searchParams.get("maxPrice")).toBe("80");
  });

  it("the quick prices are round numbers in the buyer's currency", async () => {
    await show("");
    const dialog = opened(/Price:/);
    expect(within(dialog).getByRole("button", { name: "Under SAR 100" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Over SAR 500" }));
    expect(pushed().searchParams.get("minPrice")).toBe("133.33"); expect(pushed().searchParams.has("maxPrice")).toBe(false);
  });

  it("delivery and sort are chosen from their lists; 'Best match' removes the sort", async () => {
    await show("sort=newest");
    fireEvent.click(within(opened(/Delivery:/)).getByRole("button", { name: "Within 3 days" }));
    expect(pushed().searchParams.get("maxDeliveryDays")).toBe("3");
    fireEvent.click(within(opened(/Sort:/)).getByRole("button", { name: "Best match" }));
    expect(pushed().searchParams.has("sort")).toBe(false);
  });

  it("Escape closes an open dropdown", async () => {
    await show("");
    opened(/Sort:/);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("the chips", () => {
  it("CRITICAL: each filter that is on is a chip; its × removes only that filter; 'Clear all' removes them all, the car too", async () => {
    await show("q=pads&category=brake&part=Brake%20Pads&minPrice=26.67&maxDeliveryDays=7&brandId=changan&modelId=cs75&year=2022");
    fireEvent.click(screen.getByRole("button", { name: /^From SAR 100/ }));
    expect(pushed().searchParams.has("minPrice")).toBe(false); expect(pushed().searchParams.get("part")).toBe("Brake Pads");
    fireEvent.click(screen.getByRole("button", { name: /^Brake System/ }));
    expect(pushed().searchParams.has("category")).toBe(false); expect(pushed().searchParams.has("part")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(pushed().search).toBe("");
    fireEvent.click(screen.getByRole("button", { name: /^Changan CS75 2022/ }));
    expect(pushed().search).toBe("?q=pads&category=brake&part=Brake+Pads&minPrice=26.67&maxDeliveryDays=7");          // the car chip removes the whole car, nothing else
  });

  it("with no filter on there is no chip and no 'Clear all'", async () => {
    await show("");
    expect(screen.queryByRole("button", { name: "Clear all" })).not.toBeInTheDocument();
  });
});

describe("in Arabic", () => {
  it("the labels and the section names are Arabic", async () => {
    await show("category=brake&maxDeliveryDays=14", "ar");
    expect(screen.getByRole("button", { name: /القسم:\s*نظام الفرامل/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /التوصيل:\s*خلال 14 يوم/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /الترتيب:\s*الأنسب/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /الماركة:\s*كل الماركات/ })).toBeInTheDocument();
  });
});

describe("the car, step by step (each step filters at once)", () => {
  it("CRITICAL: a brand alone filters to that brand: the model and year wait for it", async () => {
    await show("category=lights");
    expect(screen.getByRole("button", { name: /Model:\s*Choose a brand first/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Year:\s*Choose a model first/ })).toBeDisabled();
    fireEvent.click(within(opened(/Brand:/)).getByRole("button", { name: "Changan" }));
    expect(pushed().search).toBe("?category=lights&brandId=changan");
  });

  it("CRITICAL: then a model narrows to that model, keeping the brand (and the section)", async () => {
    await show("category=lights&brandId=changan");
    expect(m.models).toHaveBeenCalledWith("changan");
    fireEvent.click(within(opened(/Model:/)).getByRole("button", { name: "CS75" }));
    expect(pushed().search).toBe("?category=lights&brandId=changan&modelId=cs75");
  });

  it("CRITICAL: then a year narrows to that year; when only one generation was made that year it is chosen too", async () => {
    await show("brandId=changan&modelId=cs75");
    const dialog = opened(/Year:/);
    expect(within(dialog).getAllByRole("button").map((b) => b.textContent)).toContain("2022");
    fireEvent.click(within(dialog).getByRole("button", { name: "2022" }));
    expect(pushed().search).toBe("?brandId=changan&modelId=cs75&generationId=cs75_g2&year=2022");
  });

  it("a year in which two generations were made filters by the model and year, and offers the generation as an extra step", async () => {
    await show("brandId=changan&modelId=cs75&year=2020");
    fireEvent.click(within(opened(/Year:/)).getByRole("button", { name: "2020" }));
    expect(pushed().search).toBe("?brandId=changan&modelId=cs75&year=2020");
    fireEvent.click(within(opened(/Generation:/)).getByRole("button", { name: "CS75 Plus" }));
    expect(pushed().searchParams.get("generationId")).toBe("cs75_g2");
  });

  it("a new brand drops the old model and year; 'All brands' removes the car", async () => {
    await show("brandId=changan&modelId=cs75&generationId=cs75_g2&year=2022");
    fireEvent.click(within(opened(/Brand:/)).getByRole("button", { name: "Geely" }));
    expect(pushed().search).toBe("?brandId=geely");
    fireEvent.click(within(opened(/Brand:/)).getByRole("button", { name: "All brands" }));
    expect(pushed().search).toBe("");
  });

  it("a car that arrives as a generation only (the garage car) shows its brand and model", async () => {
    await show("generationId=cs75_g2&year=2022");
    expect(m.gen).toHaveBeenCalledWith("cs75_g2");
    expect(await screen.findByRole("button", { name: /Brand:\s*Changan/ })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Model:\s*CS75/ })).toBeInTheDocument();
  });
});
