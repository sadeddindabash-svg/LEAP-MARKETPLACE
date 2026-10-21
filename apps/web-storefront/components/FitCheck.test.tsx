import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { t } from "@/lib/i18n";

// The "does this part fit YOUR car?" message, with the garage, the language and the product fetch replaced by fixed values.
const m = vi.hoisted(() => ({ car: { current: null as unknown }, lang: { current: "en" as "en" | "ar" }, fetchProduct: vi.fn() }));
vi.mock("./GarageProvider", () => ({ useGarage: () => ({ defaultVehicle: m.car.current }) }));
vi.mock("./LangProvider", () => ({ useLang: () => m.lang.current, useT: () => (key: string, vars?: Record<string, string | number>) => t(m.lang.current, key as never, vars) }));
vi.mock("@/lib/api", () => ({ fetchProductById: (...a: unknown[]) => m.fetchProduct(...a) }));
import FitCheck from "./FitCheck";

const car = (over = {}) => ({ generationId: "g22", year: 2022, brand: "BAIC", brandAr: "بايك", model: "BJ60", modelAr: "بي جيه 60", version: null, ...over });
const fit = (brand: string, model: string, year: number, generationId = "gx") => ({ generationId, year, brand, brandAr: null, model, modelAr: null });
beforeEach(() => { m.car.current = car(); m.lang.current = "en"; m.fetchProduct.mockReset(); });

describe("FitCheck on the product page (the product passes what it carries)", () => {
  it("shows nothing when the buyer has no car in My Garage", () => {
    m.car.current = null;
    const { container } = render(<FitCheck fitCars={[fit("BAIC", "BJ60", 2022, "g22")]} fitCarCount={1} fitKeys={["g22|2022"]} fitsVehicleIds={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("the buyer's car (model AND year) is on the list: the green confirmed fit", () => {
    render(<FitCheck fitCars={[fit("BAIC", "BJ60", 2022, "g22")]} fitCarCount={1} fitKeys={["g22|2022"]} fitsVehicleIds={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Confirmed fit: BAIC BJ60 · 2022"); expect(screen.queryByText("Your car:")).not.toBeInTheDocument();
  });
  it("the same model in another year is NOT a fit: the message names what it fits and the buyer's car", () => {
    m.car.current = car({ year: 2021 });
    render(<FitCheck fitCars={[fit("BAIC", "BJ60", 2022, "g22")]} fitCarCount={1} fitKeys={["g22|2022"]} fitsVehicleIds={[]} />);
    const box = screen.getByRole("status");
    expect(box).toHaveTextContent("This part fits: BAIC BJ60 · 2022"); expect(box).toHaveTextContent("Your car: BAIC BJ60 · 2021"); expect(box).not.toHaveTextContent("Confirmed fit");
  });
  it("a different car: up to three are named and the rest are counted", () => {
    m.car.current = car({ generationId: "g18", year: 2018, brand: "Toyota", brandAr: null, model: "Corolla", modelAr: null });
    render(<FitCheck fitCars={[fit("BAIC", "BJ60", 2022), fit("BAIC", "BJ40", 2021), fit("Honda", "Civic", 2019)]} fitCarCount={5} fitKeys={["a|1", "b|2", "c|3", "d|4", "e|5"]} fitsVehicleIds={[]} />);
    const box = screen.getByRole("status");
    expect(box).toHaveTextContent("This part fits: BAIC BJ60 · 2022, BAIC BJ40 · 2021, Honda Civic · 2019 (+2 more)"); expect(box).toHaveTextContent("Your car: Toyota Corolla · 2018");
  });
  it("it matches against EVERY car the part fits, not only the few that are named", () => {
    render(<FitCheck fitCars={[fit("A", "A", 2010), fit("B", "B", 2011), fit("C", "C", 2012)]} fitCarCount={40} fitKeys={["x|1", "y|2", "g22|2022"]} fitsVehicleIds={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Confirmed fit");
  });
  it("Arabic: the wording and the Arabic names", () => {
    m.lang.current = "ar"; m.car.current = car({ generationId: "g18", year: 2018, brand: "Toyota", brandAr: "تويوتا", model: "Corolla", modelAr: "كورولا" });
    render(<FitCheck fitCars={[{ generationId: "g22", year: 2022, brand: "BAIC", brandAr: "بايك", model: "BJ60", modelAr: "بي جيه 60" }]} fitCarCount={1} fitKeys={["g22|2022"]} fitsVehicleIds={[]} />);
    const box = screen.getByRole("status");
    expect(box).toHaveTextContent("هذه القطعة تناسب: بايك بي جيه 60 · 2022"); expect(box).toHaveTextContent("سيارتك: تويوتا كورولا · 2018");
  });
  it("a part that only has the older fit list still gets the green message when its model matches", () => {
    render(<FitCheck fitsVehicleIds={["g22"]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Confirmed fit");
  });
  it("a part that fits any car (no fitment list) shows nothing", () => {
    const { container } = render(<FitCheck fitCars={[]} fitCarCount={0} fitKeys={[]} fitsVehicleIds={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("FitCheck in the cart (only the part is given: its fit is read from the product)", () => {
  it("reads the product once and shows the message; the same part is not read again", async () => {
    m.car.current = car({ generationId: "g18", year: 2018, brand: "Toyota", brandAr: null, model: "Corolla", modelAr: null });
    m.fetchProduct.mockResolvedValue({ fitCars: [fit("BAIC", "BJ60", 2022, "g22")], fitCarCount: 1, fitKeys: ["g22|2022"], fitsVehicleIds: [] });
    const first = render(<FitCheck productId="cart-p1" />);
    expect(await screen.findByText("This part fits:")).toBeInTheDocument(); first.unmount();
    render(<FitCheck productId="cart-p1" />); expect(await screen.findByText("This part fits:")).toBeInTheDocument();
    expect(m.fetchProduct).toHaveBeenCalledTimes(1);
  });
  it("a part that cannot be read shows nothing (and does not crash the cart)", async () => {
    m.fetchProduct.mockRejectedValue(new Error("down"));
    const { container } = render(<FitCheck productId="cart-p2" />);
    await waitFor(() => expect(m.fetchProduct).toHaveBeenCalled()); expect(container).toBeEmptyDOMElement();
  });
  it("without a car in My Garage nothing is read at all", () => {
    m.car.current = null; render(<FitCheck productId="cart-p3" />); expect(m.fetchProduct).not.toHaveBeenCalled();
  });
});
