import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// The "Parts Fit with my Car" switch adds the buyer's VERSION to the filter, and removes it with the filter.
const m = vi.hoisted(() => ({ car: { current: null as unknown }, search: { current: "" }, push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams(m.search.current), usePathname: () => "/search" }));
vi.mock("./useLocRouter", () => ({ useLocRouter: () => ({ push: m.push }) }));
vi.mock("./GarageProvider", () => ({ useGarage: () => ({ defaultVehicle: m.car.current }) }));
import FitsMyCarToggle from "./FitsMyCarToggle";
import { LangProvider } from "./LangProvider";

const car = (over = {}) => ({ generationId: "g1", year: 2023, brand: "BYD", brandAr: null, model: "Seal", modelAr: null, versionId: "v2", version: { name: "Performance AWD", nameAr: null }, ...over });
const pushed = () => new URL(`http://x${m.push.mock.lastCall?.[0]}`).searchParams;
const show = () => render(<LangProvider lang="en"><FitsMyCarToggle /></LangProvider>);
beforeEach(() => { m.car.current = car(); m.search.current = ""; m.push.mockReset(); });

describe("switching 'Parts Fit with my Car' on", () => {
  it("CRITICAL: sets generationId, year AND the version of the buyer's car", () => { show(); fireEvent.click(screen.getByRole("switch")); const p = pushed(); expect(p.get("generationId")).toBe("g1"); expect(p.get("year")).toBe("2023"); expect(p.get("versionId")).toBe("v2"); });
  it("a saved car with no version sets no version, and removes a stale one left in the address", () => { m.car.current = car({ versionId: null, version: null }); m.search.current = "q=disc&versionId=old"; show(); fireEvent.click(screen.getByRole("switch")); const p = pushed(); expect(p.get("generationId")).toBe("g1"); expect(p.has("versionId")).toBe(false); expect(p.get("q")).toBe("disc"); });
  it("the other filters stay", () => { m.search.current = "category=brake&q=pads&page=3"; show(); fireEvent.click(screen.getByRole("switch")); const p = pushed(); expect(p.get("category")).toBe("brake"); expect(p.get("q")).toBe("pads"); expect(p.has("page")).toBe(false); });
});
describe("switching it off", () => {
  it("CRITICAL: removes the car, the year AND the version", () => { m.search.current = "generationId=g1&year=2023&versionId=v2&q=disc"; show(); expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true"); fireEvent.click(screen.getByRole("switch")); const p = pushed(); expect(p.has("generationId")).toBe(false); expect(p.has("year")).toBe(false); expect(p.has("versionId")).toBe(false); expect(p.get("q")).toBe("disc"); });
});
