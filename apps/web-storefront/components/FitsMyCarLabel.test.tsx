import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// The label of the switch on the products page: "Parts Fit with my Car" (قطع تناسب مركبتي in Arabic), with the buyer's car under it.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/search" }));
vi.mock("./useLocRouter", () => ({ useLocRouter: () => ({ push: vi.fn() }) }));
vi.mock("./GarageProvider", () => ({ useGarage: () => ({ defaultVehicle: { generationId: "g1", year: 2022, brand: "BAIC", brandAr: "بايك", model: "BJ60", modelAr: "بي جيه 60", version: null } }) }));
import FitsMyCarToggle from "./FitsMyCarToggle";
import { LangProvider } from "./LangProvider";

describe("the switch label", () => {
  it("English: Parts Fit with my Car, and the car under it", () => {
    const { getByRole } = render(<LangProvider lang="en"><FitsMyCarToggle /></LangProvider>);
    expect(getByRole("switch").textContent).toContain("Parts Fit with my Car"); expect(getByRole("switch").textContent).toContain("BAIC BJ60 · 2022");
  });
  it("Arabic: قطع تناسب مركبتي", () => {
    const { getByRole } = render(<LangProvider lang="ar"><FitsMyCarToggle /></LangProvider>);
    expect(getByRole("switch").textContent).toContain("قطع تناسب مركبتي");
  });
});
