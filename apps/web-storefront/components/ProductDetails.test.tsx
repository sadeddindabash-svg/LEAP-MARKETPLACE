import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import type { ProductDetail } from "@/lib/api";
import ProductDetails from "./ProductDetails";

// "Product details" under the photos: which rows appear, in which order, how numbers are written, and what a part with little information shows.
const product = (over: Partial<ProductDetail> = {}) => ({ id: "p1", name: "Front Brake Disc", brand: "BYD", model: "Seal 06 DM-i", year: 2024, oemNumber: "2423423", weightKg: 1.4, lengthCm: 30, widthCm: 20, heightCm: 12, sizeApprox: false, fitCarCount: 1, ...over }) as unknown as ProductDetail;
const rows = (c: HTMLElement) => [...c.querySelectorAll("dl > div")].map((d) => [d.querySelector("dt")!.textContent, d.querySelector("dd")!.textContent]);

describe("ProductDetails", () => {
  it("shows brand, model, year, part number, dimensions and weight, in that order", () => {
    const { container } = render(<ProductDetails product={product()} lang="en" />);
    expect(rows(container)).toEqual([["Brand", "BYD"], ["Model", "Seal 06 DM-i"], ["Year", "2024"], ["Part number", "2423423"], ["Dimensions", "30 × 20 × 12 cm"], ["Weight", "1.4 kg"]]);
    expect(container.querySelector("h2")!.textContent).toBe("Product details");
  });
  it("a part that fits several cars shows the first one and how many more", () => {
    expect(rows(render(<ProductDetails product={product({ fitCarCount: 4 })} lang="en" />).container)[2]).toEqual(["Year", "2024 · +3 more cars"]);
    expect(rows(render(<ProductDetails product={product({ fitCarCount: 1 })} lang="en" />).container)[2]).toEqual(["Year", "2024"]);
  });
  it("the wording of 'more cars' is right for one, a few and many, in English and in Arabic", () => {
    const year = (n: number, lang: "en" | "ar") => rows(render(<ProductDetails product={product({ fitCarCount: n })} lang={lang} />).container)[2][1];
    expect(year(2, "en")).toBe("2024 · +1 more car"); expect(year(3, "en")).toBe("2024 · +2 more cars"); expect(year(12, "en")).toBe("2024 · +11 more cars");
    expect(year(2, "ar")).toBe("2024 · +1 مركبة أخرى"); expect(year(4, "ar")).toBe("2024 · +3 مركبات أخرى"); expect(year(12, "ar")).toBe("2024 · +11 مركبة أخرى");
  });
  it("numbers are written cleanly: 1.40 is 1.4, 30.0 is 30, 2.567 is 2.57", () => {
    const r = rows(render(<ProductDetails product={product({ weightKg: 1.4, lengthCm: 30.0, widthCm: 20.5, heightCm: 2.567 })} lang="en" />).container);
    expect(r[4][1]).toBe("30 × 20.5 × 2.57 cm"); expect(r[5][1]).toBe("1.4 kg");
  });
  it("a size that comes from the part is marked approximate, on both the dimensions and the weight; the supplier's own size is not", () => {
    const approx = rows(render(<ProductDetails product={product({ sizeApprox: true })} lang="en" />).container);
    expect(approx[4][1]).toBe("30 × 20 × 12 cm (approx.)"); expect(approx[5][1]).toBe("1.4 kg (approx.)");
    expect(rows(render(<ProductDetails product={product({ sizeApprox: false })} lang="en" />).container)[4][1]).not.toContain("approx");
  });
  it("only the rows the part really has are shown: no part number, no weight, an incomplete size", () => {
    const r = rows(render(<ProductDetails product={product({ oemNumber: null, weightKg: null, heightCm: null })} lang="en" />).container).map((x) => x[0]);
    expect(r).toEqual(["Brand", "Model", "Year"]);
  });
  it("a part with nothing to show leaves no empty box", () => {
    const { container } = render(<ProductDetails product={product({ brand: null, model: null, year: null, oemNumber: null, weightKg: null, lengthCm: null, widthCm: null, heightCm: null })} lang="en" />);
    expect(container).toBeEmptyDOMElement();
  });
  it("Arabic labels and words", () => {
    const { container } = render(<ProductDetails product={product({ fitCarCount: 4, sizeApprox: true })} lang="ar" />);
    expect(container.querySelector("h2")!.textContent).toBe("تفاصيل المنتج");
    expect(rows(container).map((r) => r[0])).toEqual(["الماركة", "الموديل", "السنة", "رقم القطعة", "الأبعاد", "الوزن"]);
    expect(rows(container)[2][1]).toBe("2024 · +3 مركبات أخرى"); expect(rows(container)[5][1]).toBe("1.4 kg (تقريبي)");
  });
  it("is a labelled section with a real description list (so a screen reader reads each name with its value)", () => {
    const { container } = render(<ProductDetails product={product()} lang="en" />);
    expect(container.querySelector("section")!.getAttribute("aria-labelledby")).toBe("product-details-h"); expect(container.querySelectorAll("dt")).toHaveLength(6); expect(container.querySelectorAll("dd")).toHaveLength(6);
  });
});
