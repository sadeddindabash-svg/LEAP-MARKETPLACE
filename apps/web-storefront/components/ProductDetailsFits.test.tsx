import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ProductDetail, FitGroup } from "@/lib/api";

// The Technical Specifications card with a part that fits many vehicles: ONE "Fits" row instead of a single brand, model and year; "Universal" for a part with no fitment; and the old rows from an older server.
import ProductDetails from "./ProductDetails";
import { LangProvider } from "./LangProvider";

const g = (model: string, ranges: Array<[number, number]>): FitGroup => ({ brand: "BYD", model, ranges, vehicleCount: 1 });
const product = (over: Partial<ProductDetail> = {}): ProductDetail => ({ id: "p", name: "Pads", brand: "BYD", model: "Seal", year: 2022, oemNumber: "123", images: [], price: 10, stockQuantity: 5, attributes: [], fitCarCount: 11, ...over } as ProductDetail);
const show = (p: ProductDetail, lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}><ProductDetails product={p} lang={lang} /></LangProvider>);
const labels = () => screen.getAllByRole("term").map((d) => d.textContent);

describe("a part with fitment groups", () => {
  it("shows ONE Fits row with every model and its years, and no single Brand, Model or Year row", () => {
    show(product({ fitGroups: [g("Seal", [[2022, 2024]]), g("Dolphin", [[2023, 2023]])], fitGroupCount: 2, fitVehicleCount: 4 })); expect(labels()).toContain("Fits"); for (const gone of ["Brand", "Model", "Year"]) expect(labels()).not.toContain(gone);
    expect(screen.getByText("BYD Seal")).toBeInTheDocument(); expect(screen.getByText("2022–2024")).toBeInTheDocument(); expect(screen.getByText("BYD Dolphin")).toBeInTheDocument(); expect(screen.queryByText(/more cars/)).not.toBeInTheDocument();
  });
  it("the Fits row comes first, then the part number and the rest as before", () => { show(product({ fitGroups: [g("Seal", [[2022, 2024]])], fitGroupCount: 1 })); expect(labels().slice(0, 2)).toEqual(["Fits", "Part number"]); });
  it("a long list is collapsed with the link", () => { show(product({ fitGroups: [g("A", [[2022, 2022]]), g("B", [[2022, 2022]]), g("C", [[2022, 2022]]), g("D", [[2022, 2022]])], fitGroupCount: 4, fitVehicleCount: 6 })); expect(screen.getByRole("button")).toHaveTextContent("+1 more model · 6 vehicles in all"); });
  it("in Arabic the label is تناسب", () => { show(product({ fitGroups: [g("Seal", [[2022, 2024]])], fitGroupCount: 1 }), "ar"); expect(labels()).toContain("تناسب"); });
});
describe("a part with no fitment at all", () => {
  it("says it is universal (an empty list from the server), and has no Brand, Model or Year row", () => {
    show(product({ brand: null, model: null, year: null, fitGroups: [], fitGroupCount: 0, fitCarCount: 0 })); expect(screen.getByText("Universal: fits all vehicles")).toBeInTheDocument(); expect(labels()).toContain("Fits"); expect(labels()).not.toContain("Brand");
  });
  it("in Arabic", () => { show(product({ brand: null, model: null, year: null, fitGroups: [], fitGroupCount: 0 }), "ar"); expect(screen.getByText("عامة: تناسب جميع المركبات")).toBeInTheDocument(); });
});
describe("an older server, or fitment that could not be read (no groups at all)", () => {
  it("keeps the old Brand, Model and Year rows exactly as before (with +N more cars), and never says Universal", () => {
    show(product({ fitGroups: undefined })); expect(labels().slice(0, 3)).toEqual(["Brand", "Model", "Year"]); expect(screen.getByText("BYD")).toBeInTheDocument(); expect(screen.getByText("Seal")).toBeInTheDocument(); expect(screen.getByText(/\+10 more cars/)).toBeInTheDocument(); expect(screen.queryByText(/Universal/)).not.toBeInTheDocument();
  });
});
