import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { t } from "@/lib/i18n";

// The fit message with versions: the same four states as the drawing, in English and Arabic (the garage, the language and the product fetch replaced by fixed values).
const m = vi.hoisted(() => ({ car: { current: null as unknown }, lang: { current: "en" as "en" | "ar" }, fetchProduct: vi.fn() }));
vi.mock("./GarageProvider", () => ({ useGarage: () => ({ defaultVehicle: m.car.current }) }));
vi.mock("./LangProvider", () => ({ useLang: () => m.lang.current, useT: () => (key: string, vars?: Record<string, string | number>) => t(m.lang.current, key as never, vars) }));
vi.mock("@/lib/api", () => ({ fetchProductById: (...a: unknown[]) => m.fetchProduct(...a) }));
import FitCheck from "./FitCheck";

const car = (over = {}) => ({ generationId: "g", year: 2023, brand: "BYD", brandAr: "بي واي دي", model: "Seal", modelAr: "سيل", versionId: "v2", version: { name: "Performance AWD", nameAr: null }, ...over });
const fitCar = { generationId: "g", year: 2023, brand: "BYD", brandAr: null, model: "Seal", modelAr: null };
const NAMES = { v1: { name: "Premium RWD" }, v2: { name: "Performance AWD" }, v3: { name: "Excellence AWD" } };
const show = (extra = {}) => render(<FitCheck fitCars={[fitCar]} fitCarCount={1} fitKeys={["g|2023"]} fitsVehicleIds={[]} fitVersionNames={NAMES} {...extra} />);
beforeEach(() => { m.car.current = car(); m.lang.current = "en"; m.fetchProduct.mockReset(); });

describe("1. the part fits all versions (most parts)", () => {
  it("the green confirmed fit WITH the buyer's version, and no version line", () => { show(); expect(screen.getByRole("status")).toHaveTextContent("Confirmed fit: BYD Seal · 2023 · Performance AWD"); expect(screen.queryByTestId("fit-versions")).not.toBeInTheDocument(); expect(screen.queryByTestId("fit-wrong-version")).not.toBeInTheDocument(); });
  it("a saved car with no version is also confirmed (nothing to compare)", () => { m.car.current = car({ versionId: null, version: null }); show(); expect(screen.getByRole("status")).toHaveTextContent("Confirmed fit: BYD Seal · 2023"); });
});
describe("2. narrowed, and the buyer's version is one of them", () => {
  it("CRITICAL: confirmed fit, and it says which versions the part is for", () => { show({ fitVersions: { "g|2023": ["v2", "v3"] } }); expect(screen.getByRole("status")).toHaveTextContent("Confirmed fit"); expect(screen.getByTestId("fit-versions")).toHaveTextContent("This part is for: Performance AWD, Excellence AWD"); });
});
describe("3. narrowed to OTHER versions", () => {
  it("CRITICAL: amber, \"Doesn't fit your version\", names the versions and the buyer's car, and says the buyer can still order; NOT the green message", () => {
    show({ fitVersions: { "g|2023": ["v1"] } }); const box = screen.getByTestId("fit-wrong-version"); expect(box).toHaveTextContent("Doesn't fit your version."); expect(box).toHaveTextContent("This part is for Premium RWD."); expect(box).toHaveTextContent("Your car: BYD Seal · 2023 · Performance AWD"); expect(box).toHaveTextContent("You can still order it."); expect(screen.queryByText(/Confirmed fit/)).not.toBeInTheDocument();
  });
});
describe("4. narrowed, and the saved car has no version", () => {
  it("CRITICAL: grey, asks the buyer to choose a version, with a link to the garage", () => {
    m.car.current = car({ versionId: null, version: null }); show({ fitVersions: { "g|2023": ["v2"] } }); const box = screen.getByTestId("fit-need-version"); expect(box).toHaveTextContent("This part fits only some versions of BYD Seal · 2023: Performance AWD."); const link = within(box).getByRole("link", { name: "Choose your version to check" }); expect(link.getAttribute("href")).toBe("/garage"); expect(screen.queryByText(/Confirmed fit/)).not.toBeInTheDocument();
  });
});
describe("5. unchanged behaviour", () => {
  it("another year is still \"This part fits: ... Your car: ...\" (information), versions or not", () => { m.car.current = car({ year: 2021 }); show({ fitVersions: { "g|2023": ["v1"] } }); expect(screen.getByRole("status")).toHaveTextContent("This part fits: BYD Seal · 2023"); expect(screen.getByRole("status")).toHaveTextContent("Your car:"); expect(screen.queryByTestId("fit-wrong-version")).not.toBeInTheDocument(); });
  it("no car in My Garage: nothing", () => { m.car.current = null; const { container } = show({ fitVersions: { "g|2023": ["v1"] } }); expect(container).toBeEmptyDOMElement(); });
  it("in the cart (only the product id is given) the versions come from the product it reads", async () => {
    m.fetchProduct.mockResolvedValue({ fitCars: [fitCar], fitCarCount: 1, fitKeys: ["g|2023"], fitsVehicleIds: [], fitVersions: { "g|2023": ["v1"] }, fitVersionNames: NAMES }); render(<FitCheck productId="p1" />); expect(await screen.findByTestId("fit-wrong-version")).toBeInTheDocument();
  });
});
describe("in Arabic", () => {
  it("the messages are Arabic and the link goes to the Arabic garage", () => {
    m.lang.current = "ar"; m.car.current = car({ versionId: null, version: null }); show({ fitVersions: { "g|2023": ["v2"] } }); const box = screen.getByTestId("fit-need-version"); expect(box.textContent).toMatch(/هذه القطعة تناسب بعض إصدارات/); expect(within(box).getByRole("link").getAttribute("href")).toBe("/ar/garage");
  });
  it("wrong version in Arabic", () => { m.lang.current = "ar"; show({ fitVersions: { "g|2023": ["v1"] } }); expect(screen.getByTestId("fit-wrong-version").textContent).toMatch(/لا تناسب إصدار سيارتك/); });
});
