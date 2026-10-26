import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import SellerSignals from "./SellerSignals";

// Under the stock box: "Verified seller" and "Ships from China Warehouse" (the country only), each only when the server says so.
const lines = (props: Partial<React.ComponentProps<typeof SellerSignals>>) => { const { container } = render(<SellerSignals lang="en" {...props} />); return { empty: container.innerHTML === "", items: [...container.querySelectorAll("li")].map((l) => l.textContent) }; };
describe("seller signals", () => {
  it("both: Verified seller, and Ships from China Warehouse", () => { expect(lines({ isVerifiedSeller: true, shipsFromCountry: "China" }).items).toEqual(["Verified seller", "Ships from China Warehouse"]); });
  it("only what is known is shown", () => { expect(lines({ isVerifiedSeller: true }).items).toEqual(["Verified seller"]); expect(lines({ shipsFromCountry: "Turkey" }).items).toEqual(["Ships from Turkey Warehouse"]); expect(lines({ isVerifiedSeller: false, shipsFromCountry: "Turkey" }).items).toEqual(["Ships from Turkey Warehouse"]); });
  it("nothing known: nothing drawn at all (no empty gap)", () => { for (const p of [{}, { isVerifiedSeller: false }, { shipsFromCountry: null }, { shipsFromCountry: "" }]) expect(lines(p).empty).toBe(true); });
  it("in Arabic: بائع موثّق and يشحن من مستودع <the Arabic country name when the server has one, else the English one>", () => {
    expect(lines({ lang: "ar", isVerifiedSeller: true, shipsFromCountry: "China", shipsFromCountryAr: "الصين" }).items).toEqual(["بائع موثّق", "يشحن من مستودع الصين"]); expect(lines({ lang: "ar", shipsFromCountry: "China", shipsFromCountryAr: null }).items).toEqual(["يشحن من مستودع China"]); expect(lines({ lang: "ar", shipsFromCountry: "China", shipsFromCountryAr: "  " }).items).toEqual(["يشحن من مستودع China"]);
  });
  it("in English the Arabic name is never used", () => { expect(lines({ shipsFromCountry: "China", shipsFromCountryAr: "الصين" }).items).toEqual(["Ships from China Warehouse"]); });
  it("never shows a supplier's name (the component has no way to: only the country)", () => { const { container } = render(<SellerSignals lang="en" isVerifiedSeller shipsFromCountry="China" {...({ supplierName: "Secret Co" } as object)} />); expect(container.textContent).not.toContain("Secret"); });
  it("the icons are decoration", () => { const { container } = render(<SellerSignals lang="en" isVerifiedSeller shipsFromCountry="China" />); const svgs = [...container.querySelectorAll("svg")]; expect(svgs).toHaveLength(2); for (const s of svgs) expect(s.getAttribute("aria-hidden")).toBe("true"); });
});
