import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ProductDetail, FitGroup } from "@/lib/api";
import ProductDetails from "./ProductDetails";
import { LangProvider } from "./LangProvider";

// The Technical Specifications: the labels are a column and the values START at the start side (left in English, right in Arabic), the description in the same column.
const product = (over: Partial<ProductDetail> = {}): ProductDetail => ({ id: "p", name: "Pads", brand: "BYD", model: "Seal", year: 2022, oemNumber: "123", description: "Ceramic pads.\nLow dust.", images: [], price: 10, stockQuantity: 5, attributes: [{ name: "Material", value: "Ceramic" }], fitCarCount: 1, ...over } as ProductDetail);
const show = (p: ProductDetail, lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}><ProductDetails product={p} lang={lang} /></LangProvider>);
const rows = (c: HTMLElement) => [...c.querySelectorAll("dl > div")];

describe("every row", () => {
  it("is a grid of a label column and a value column (narrower label on a phone), not a row pushed to both edges", () => {
    const { container } = show(product()); expect(rows(container).length).toBeGreaterThan(5);
    for (const r of rows(container)) { expect(r.className).toContain("grid"); expect(r.className).toContain("grid-cols-[7.5rem_minmax(0,1fr)]"); expect(r.className).toContain("sm:grid-cols-[9.5rem_minmax(0,1fr)]"); expect(r.className).not.toContain("justify-between"); expect(r.className).not.toContain("flex"); expect(r.children[0].tagName).toBe("DT"); expect(r.children[1].tagName).toBe("DD"); }
  });
  it("starts the value at the START side: text-start (left in English, right in Arabic), never text-end and never a fixed left or right", () => {
    for (const lang of ["en", "ar"] as const) { const { container, unmount } = show(product(), lang); for (const dd of container.querySelectorAll("dl dd")) { expect(dd.className).not.toContain("text-end"); expect(dd.className).not.toMatch(/text-(left|right)/); } for (const r of rows(container).slice(0, -1)) expect(r.querySelector("dd")!.className).toContain("text-start"); unmount(); }
  });
});
describe("the description row", () => {
  it("is in the same two columns (its text starts where the other values start), keeps its line breaks, and is not pushed down", () => {
    const { container } = show(product()); const last = rows(container).at(-1)!; expect(last.querySelector("dt")!.textContent).toBe("Description"); expect(last.className).toContain("grid-cols-[7.5rem_minmax(0,1fr)]"); const dd = last.querySelector("dd")!; expect(dd.className).toContain("whitespace-pre-line"); expect(dd.className).not.toContain("mt-1"); expect(dd.textContent).toBe("Ceramic pads.\nLow dust.");
  });
  it("without a description: Not specified, in the same place", () => { const { container } = show(product({ description: "" })); expect(rows(container).at(-1)!.querySelector("dd")!.textContent).toBe("Not specified"); });
});
describe("the Fits row", () => {
  const groups: FitGroup[] = [{ brand: "BYD", model: "Seal", ranges: [[2022, 2024]], vehicleCount: 3 }, { brand: "BYD", model: "Dolphin", ranges: [[2023, 2023]], vehicleCount: 1 }];
  it("its lines start at the start side too (items-start), under the same label column", () => { const { container } = show(product({ fitGroups: groups, fitGroupCount: 2, fitVehicleCount: 4 })); const fits = screen.getByTestId("fits-row"); expect(fits.className).toContain("items-start"); expect(fits.closest("dd")!.className).toContain("text-start"); expect(rows(container)[0].querySelector("dt")!.textContent).toBe("Fits"); });
});
