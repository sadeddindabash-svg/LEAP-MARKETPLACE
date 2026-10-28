import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { FitGroup, ProductDetail } from "@/lib/api";
import ProductChips from "./ProductChips";

// The two chips under the product name: the part class with the part's PHOTO beside it, and what the part fits with the BRAND LOGOS in front. Missing photos and logos leave the chip as it was.
const g = (brand: string, model: string, ranges: Array<[number, number]>, logo: string | null = "/uploads/b.png", over: Partial<FitGroup> = {}): FitGroup => ({ brand, model, ranges, vehicleCount: 1, brandLogoUrl: logo, ...over });
const product = (over: Partial<ProductDetail> = {}): ProductDetail => ({ id: "p", name: "Pads", part: "Brake pads", brand: "BYD", model: "Seal", year: 2022, ...over } as ProductDetail);
const show = (p: ProductDetail, lang: "en" | "ar" = "en") => render(<ProductChips product={p} lang={lang} />);

describe("the part chip", () => {
  it("shows the part class; with the part's photo it has the picture BESIDE the words", () => {
    show(product({ partPhotoUrl: "/uploads/part.png" })); const chip = screen.getByTestId("part-chip"); expect(chip).toHaveTextContent("Brake pads"); const photo = within(chip).getByTestId("part-photo"); expect(photo.querySelector("img")!.getAttribute("src")).toContain("/uploads/part.png"); expect(photo.nextSibling!.textContent).toBe("Brake pads");
  });
  it("the photo is decoration (empty description: the words next to it say what it is) and is a small square", () => { show(product({ partPhotoUrl: "/uploads/part.png" })); const photo = screen.getByTestId("part-photo"); expect(photo.querySelector("img")!.getAttribute("alt")).toBe(""); expect(photo.className).toContain("size-[30px]"); });
  it("a part class without a photo is the chip as it was: only the words", () => { for (const none of [null, undefined, ""]) { const v = show(product({ partPhotoUrl: none })); const chip = screen.getByTestId("part-chip"); expect(chip.querySelector("img")).toBeNull(); expect(chip.textContent).toBe("Brake pads"); v.unmount(); } });
  it("no part at all: no part chip", () => { show(product({ part: null as never, partPhotoUrl: "/uploads/part.png" })); expect(screen.queryByTestId("part-chip")).not.toBeInTheDocument(); });
});

describe("the fitment chip", () => {
  it("the words as before (first model with its years and how many more models)", () => { show(product({ fitGroups: [g("BYD", "Seal", [[2022, 2024]]), g("BYD", "Dolphin", [[2023, 2023]]), g("Toyota", "Camry", [[2020, 2022]])], fitGroupCount: 3 })); expect(screen.getByTestId("fit-chip")).toHaveTextContent("FITS BYD Seal 2022–2024 +2 more models"); });
  it("with the logos of its brands IN FRONT of the words, one per brand, overlapping", () => {
    show(product({ fitGroups: [g("BYD", "Seal", [[2022, 2024]], "/uploads/byd.png"), g("BYD", "Dolphin", [[2023, 2023]], "/uploads/byd.png"), g("Toyota", "Camry", [[2020, 2022]], "/uploads/toy.png")], fitGroupCount: 3 }));
    const chip = screen.getByTestId("fit-chip"); const logos = within(chip).getAllByTestId("fit-logo"); expect(logos).toHaveLength(2); expect(logos[0].querySelector("img")!.getAttribute("src")).toContain("/uploads/byd.png"); expect(logos[1].querySelector("img")!.getAttribute("src")).toContain("/uploads/toy.png"); expect(logos[0].querySelector("img")!.getAttribute("alt")).toBe("BYD");
    expect(logos[1].className).toContain("-ms-2"); expect(logos[0].className).not.toContain("-ms-2"); expect(within(chip).getByTestId("fit-logos").nextSibling!.textContent).toContain("FITS BYD Seal"); expect(within(chip).queryByTestId("fit-logos-more")).not.toBeInTheDocument();
  });
  it("more than three brands: three logos and a +N bubble", () => { const groups = ["A", "B", "C", "D", "E"].map((b) => g(b, "M", [[2022, 2022]], `/uploads/${b}.png`)); show(product({ fitGroups: groups, fitGroupCount: 5 })); expect(screen.getAllByTestId("fit-logo")).toHaveLength(3); expect(screen.getByTestId("fit-logos-more")).toHaveTextContent("+2"); });
  it("brands without a logo: no logos, and the chip is only the words", () => { show(product({ fitGroups: [g("BYD", "Seal", [[2022, 2024]], null)], fitGroupCount: 1 })); const chip = screen.getByTestId("fit-chip"); expect(chip.querySelector("img")).toBeNull(); expect(screen.queryByTestId("fit-logos")).not.toBeInTheDocument(); expect(chip.textContent).toBe("FITS BYD Seal 2022–2024"); });
  it("a part with no fitment at all says it fits all vehicles, with no logo", () => { show(product({ brand: null as never, fitGroups: [], fitGroupCount: 0 })); expect(screen.getByTestId("fit-chip").textContent).toBe("Fits all vehicles"); expect(screen.queryByTestId("fit-logos")).not.toBeInTheDocument(); });
  it("from an older server: the single car as before, with its brand logo when it has one", () => { show(product({ fitGroups: undefined, brandLogoUrl: "/uploads/byd.png" })); const chip = screen.getByTestId("fit-chip"); expect(chip.textContent).toContain("FITS 2022 BYD Seal"); expect(within(chip).getAllByTestId("fit-logo")).toHaveLength(1); });
  it("nothing to say (no brand, no groups): no fit chip at all", () => { show(product({ brand: null as never, model: null as never, year: null as never, fitGroups: undefined })); expect(screen.queryByTestId("fit-chip")).not.toBeInTheDocument(); });
  it("in Arabic the words and the brand name are Arabic", () => { show(product({ fitGroups: [g("BYD", "Seal", [[2022, 2024]], "/uploads/byd.png", { brandAr: "بي واي دي", modelAr: "سيل" })], fitGroupCount: 1 }), "ar"); const chip = screen.getByTestId("fit-chip"); expect(chip.textContent).toContain("بي واي دي سيل 2022–2024"); expect(within(chip).getByTestId("fit-logo").querySelector("img")!.getAttribute("alt")).toBe("بي واي دي"); });
});
