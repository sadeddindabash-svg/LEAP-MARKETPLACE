import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import type { ProductDetail } from "@/lib/api";
import ProductDetails from "./ProductDetails";

// "Technical Specifications" under the photos, as in the mobile app: which rows appear, in which order, how numbers are written, and what a part with little information shows ("Not specified": every row is always there).
const product = (over: Partial<ProductDetail> = {}) => ({ id: "p1", name: "Front Brake Disc", brand: "BYD", model: "Seal 06 DM-i", year: 2024, oemNumber: "2423423", weightKg: 1.4, lengthCm: 30, widthCm: 20, heightCm: 12, sizeApprox: false, fitCarCount: 1, ...over }) as unknown as ProductDetail;
const rows = (c: HTMLElement) => [...c.querySelectorAll("dl > div")].map((d) => [d.querySelector("dt")!.textContent, d.querySelector("dd")!.textContent]);
const labels = (c: HTMLElement) => rows(c).map((r) => r[0]);

describe("ProductDetails", () => {
  it("shows brand, model, year, part number, dimensions, weight and the description, in that order, under the title Technical Specifications", () => {
    const { container } = render(<ProductDetails product={product({ description: "Fits all Seal models." })} lang="en" />);
    expect(rows(container)).toEqual([["Brand", "BYD"], ["Model", "Seal 06 DM-i"], ["Year", "2024"], ["Part number", "2423423"], ["Dimensions", "30 × 20 × 12 cm"], ["Weight", "1.4 kg"], ["Description", "Fits all Seal models."]]);
    expect(container.querySelector("h2")!.textContent).toBe("Technical Specifications");
  });
  it("the part's own attributes (material, colour...) come after the part number and before the dimensions, in the order given", () => {
    const { container } = render(<ProductDetails product={product({ attributes: [{ name: "Material", value: "Ceramic" }, { name: "Colour", value: "Black" }] })} lang="en" />);
    expect(labels(container)).toEqual(["Brand", "Model", "Year", "Part number", "Material", "Colour", "Dimensions", "Weight", "Description"]); expect(rows(container).slice(4, 6)).toEqual([["Material", "Ceramic"], ["Colour", "Black"]]);
  });
  it("an attribute that is named like a row (or twice) does not break the list", () => { const { container } = render(<ProductDetails product={product({ attributes: [{ name: "Weight", value: "heavy" }, { name: "Weight", value: "again" }] })} lang="en" />); expect(rows(container).filter((r) => r[0] === "Weight")).toHaveLength(3); });
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
  it("EVERY row is always there: one the part does not have says \"Not specified\" (no part number, no weight, an incomplete size, no description)", () => {
    const r = rows(render(<ProductDetails product={product({ oemNumber: null, weightKg: null, heightCm: null, description: null })} lang="en" />).container);
    expect(r.map((x) => x[0])).toEqual(["Brand", "Model", "Year", "Part number", "Dimensions", "Weight", "Description"]); expect(r.slice(3).map((x) => x[1])).toEqual(["Not specified", "Not specified", "Not specified", "Not specified"]); expect(r[0][1]).toBe("BYD");
  });
  it("a part with nothing known still shows the whole card, every row \"Not specified\"", () => {
    const { container } = render(<ProductDetails product={product({ brand: null, model: null, year: null, oemNumber: null, weightKg: null, lengthCm: null, widthCm: null, heightCm: null, description: null })} lang="en" />);
    expect(rows(container)).toHaveLength(7); expect(rows(container).every((r) => r[1] === "Not specified")).toBe(true);
  });
  it("a blank description counts as no description; a long one keeps its line breaks", () => {
    expect(rows(render(<ProductDetails product={product({ description: "   " })} lang="en" />).container)[6][1]).toBe("Not specified");
    const { container } = render(<ProductDetails product={product({ description: "Line one\nLine two" })} lang="en" />); const dd = container.querySelectorAll("dd"); expect(dd[dd.length - 1].className).toContain("whitespace-pre-line"); expect(dd[dd.length - 1].textContent).toBe("Line one\nLine two");
  });
  it("Arabic labels and words", () => {
    const { container } = render(<ProductDetails product={product({ fitCarCount: 4, sizeApprox: true, model: null })} lang="ar" />);
    expect(container.querySelector("h2")!.textContent).toBe("المواصفات الفنية");
    expect(labels(container)).toEqual(["الماركة", "الموديل", "السنة", "رقم القطعة", "الأبعاد", "الوزن", "الوصف"]);
    expect(rows(container)[1][1]).toBe("غير محدد"); expect(rows(container)[2][1]).toBe("2024 · +3 مركبات أخرى"); expect(rows(container)[5][1]).toBe("1.4 kg (تقريبي)"); expect(rows(container)[6][1]).toBe("غير محدد");
  });
  it("is a labelled section with a real description list (so a screen reader reads each name with its value)", () => {
    const { container } = render(<ProductDetails product={product()} lang="en" />);
    expect(container.querySelector("section")!.getAttribute("aria-labelledby")).toBe("product-details-h"); expect(container.querySelectorAll("dt")).toHaveLength(7); expect(container.querySelectorAll("dd")).toHaveLength(7);
  });
});
