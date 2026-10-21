import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// The "Fits my car" switch and the "My vehicle" card sit side by side on the products page and must be the same height: both fill the height of their row (h-full).
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/search" }));
vi.mock("./useLocRouter", () => ({ useLocRouter: () => ({ push: vi.fn() }) }));
vi.mock("./GarageProvider", () => ({ useGarage: () => ({ defaultVehicle: { generationId: "g1", year: 2022, brand: "BAIC", brandAr: null, model: "BJ60", modelAr: null, version: null } }) }));
vi.mock("@/lib/api", () => ({ fetchVehicleBrands: vi.fn(async () => []), fetchModelsForBrand: vi.fn(async () => []), fetchGenerationsForModel: vi.fn(async () => []) }));
import FitsMyCarToggle from "./FitsMyCarToggle";
import { VehicleFilter } from "./VehicleFilter";
import { LangProvider } from "./LangProvider";

describe("equal heights on the products page", () => {
  it("the Fits my car switch fills the height of its row", () => {
    const { getByRole } = render(<LangProvider lang="en"><FitsMyCarToggle /></LangProvider>);
    expect(getByRole("switch").className.split(" ")).toContain("h-full");
  });
  it("the My vehicle card fills the height of its row", () => {
    const { container } = render(<LangProvider lang="en"><VehicleFilter /></LangProvider>);
    expect((container.firstElementChild as HTMLElement).className.split(" ")).toContain("h-full");
  });
});
