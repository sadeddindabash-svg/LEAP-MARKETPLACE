import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { GarageVehicle } from "@/lib/api";

// The garage, the "Shopping for" bar, "Fits my car" and the display currency, with the server and the sign-in state replaced by fixed values.
const m = vi.hoisted(() => ({
  push: vi.fn(),
  search: { current: new URLSearchParams() },
  auth: { current: { user: null as { id: string } | null, isLoading: false, logout: () => {} } },
  garage: { current: [] as unknown[] },
  fetchMyGarage: vi.fn(),
  add: vi.fn(async () => ({})),
  makeDefault: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
  choose: vi.fn(async () => [] as unknown[]),
  rates: { current: {} as Record<string, number> },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push, replace: vi.fn() }), useSearchParams: () => m.search.current, usePathname: () => "/search" }));
vi.mock("./AuthProvider", () => ({ useAuth: () => m.auth.current, getAuthToken: () => "tok" }));
vi.mock("@/lib/api", () => ({
  fetchMyGarage: (...a: unknown[]) => m.fetchMyGarage(...a),
  addVehicleToGarage: (...a: unknown[]) => m.add(...(a as [])),
  removeVehicleFromGarage: (...a: unknown[]) => m.remove(...(a as [])),
  setDefaultVehicle: (...a: unknown[]) => m.makeDefault(...(a as [])),
  chooseGarageVersion: (...a: unknown[]) => m.choose(...(a as [])),
  fetchDisplayRates: vi.fn(async () => m.rates.current),
}));

import { GarageProvider, useGarage } from "./GarageProvider";
import VehicleBar from "./VehicleBar";
import FitsMyCarToggle from "./FitsMyCarToggle";
import { CurrencyProvider } from "./CurrencyProvider";
import CurrencySwitcher from "./CurrencySwitcher";
import { Price } from "./Price";
import { LangProvider } from "./LangProvider";

const car = (over: Partial<GarageVehicle> = {}): GarageVehicle => ({ generationId: "g1", year: 2024, brand: "BYD", brandAr: "بي واي دي", model: "Seal DM-i", modelAr: null, generation: "2024", yearStart: 2024, yearEnd: 2024, isDefault: true, ...over });

function Probe() {
  const g = useGarage();
  return (
    <div>
      <p data-testid="state">{JSON.stringify({ signedIn: g.signedIn, loading: g.loading, n: g.vehicles.length, def: g.defaultVehicle?.generationId ?? null })}</p>
      <button onClick={() => g.add("g2", 2021)}>add</button>
      <button onClick={() => g.makeDefault({ generationId: "g2", year: 2021 })}>default</button>
      <button onClick={() => g.remove({ generationId: "g1", year: 2024 })}>remove</button>
      <button onClick={() => g.add("g2", 2021, "ver_a")}>add-version</button>
      <button onClick={() => g.makeDefault({ generationId: "g2", year: 2021, versionId: "ver_a" })}>default-version</button>
      <button onClick={() => g.remove({ generationId: "g2", year: 2021, versionId: "ver_a" })}>remove-version</button>
      <button onClick={() => g.chooseVersion({ generationId: "g1", year: 2024 }, "ver_z")}>choose-version</button>
    </div>
  );
}
const state = () => JSON.parse(screen.getByTestId("state").textContent || "{}");
const signIn = (id: string | null) => { m.auth.current = { user: id ? { id } : null, isLoading: false, logout: () => {} }; };

beforeEach(() => {
  vi.clearAllMocks();
  signIn(null);
  m.search.current = new URLSearchParams();
  m.fetchMyGarage.mockImplementation(async () => m.garage.current);
  m.garage.current = [car(), car({ generationId: "g2", year: 2021, brand: "Geely", brandAr: null, model: "Coolray", isDefault: false })];
  m.rates.current = {};
  localStorage.clear();
});
afterEach(() => { vi.restoreAllMocks(); });

describe("the garage", () => {
  it("CRITICAL: signed out there is no garage and nothing is fetched; signed in, the buyer's cars load with the default one picked out", async () => {
    render(<GarageProvider><Probe /></GarageProvider>);
    expect(state()).toEqual({ signedIn: false, loading: false, n: 0, def: null });
    expect(m.fetchMyGarage).not.toHaveBeenCalled();
  });

  it("signed in: loads the cars, and the default is the one marked default", async () => {
    signIn("u1");
    render(<GarageProvider><Probe /></GarageProvider>);
    expect(state().loading).toBe(true);
    await waitFor(() => expect(state()).toEqual({ signedIn: true, loading: false, n: 2, def: "g1" }));
    expect(m.fetchMyGarage).toHaveBeenCalledWith("tok");
  });

  it("CRITICAL: every change goes to the server and then the list is loaded again, so what is shown is what is saved", async () => {
    signIn("u1");
    render(<GarageProvider><Probe /></GarageProvider>);
    await waitFor(() => expect(state().n).toBe(2));
    await act(async () => { fireEvent.click(screen.getByText("add")); });
    expect(m.add).toHaveBeenCalledWith("tok", "g2", 2021, undefined);                       // a car without a version: none is sent
    await act(async () => { fireEvent.click(screen.getByText("default")); });
    expect(m.makeDefault).toHaveBeenCalledWith("tok", "g2", 2021, undefined);
    await act(async () => { fireEvent.click(screen.getByText("remove")); });
    expect(m.remove).toHaveBeenCalledWith("tok", "g1", 2024, undefined);
    expect(m.fetchMyGarage).toHaveBeenCalledTimes(4);                  // once on sign-in, then once after each of the three changes
  });

  it("CRITICAL: adding, choosing the default and removing a car all name its VERSION, and \"choose its version\" sends the version for that exact car; each is followed by a reload", async () => {
    signIn("u1");
    render(<GarageProvider><Probe /></GarageProvider>);
    await waitFor(() => expect(state().n).toBe(2));
    await act(async () => { fireEvent.click(screen.getByText("add-version")); });
    expect(m.add).toHaveBeenCalledWith("tok", "g2", 2021, "ver_a");
    await act(async () => { fireEvent.click(screen.getByText("default-version")); });
    expect(m.makeDefault).toHaveBeenCalledWith("tok", "g2", 2021, "ver_a");
    await act(async () => { fireEvent.click(screen.getByText("remove-version")); });
    expect(m.remove).toHaveBeenCalledWith("tok", "g2", 2021, "ver_a");
    await act(async () => { fireEvent.click(screen.getByText("choose-version")); });
    expect(m.choose).toHaveBeenCalledWith("tok", "g1", 2024, "ver_z");
    expect(m.fetchMyGarage).toHaveBeenCalledTimes(5);
  });

  it("CRITICAL: when somebody else signs in, the previous buyer's cars are never shown to them", async () => {
    signIn("u1");
    const { rerender } = render(<GarageProvider><Probe /></GarageProvider>);
    await waitFor(() => expect(state().n).toBe(2));
    m.garage.current = [car({ generationId: "other", isDefault: true })];
    signIn("u2");
    rerender(<GarageProvider><Probe /></GarageProvider>);
    expect(state().n).toBe(0);                                         // not u1's cars, while u2's load
    await waitFor(() => expect(state()).toMatchObject({ n: 1, def: "other", loading: false }));
    signIn(null);
    rerender(<GarageProvider><Probe /></GarageProvider>);
    expect(state()).toMatchObject({ signedIn: false, n: 0 });
  });

  it("a garage that cannot be loaded is simply empty (never a crash)", async () => {
    signIn("u1");
    m.fetchMyGarage.mockRejectedValue(new Error("down"));
    render(<GarageProvider><Probe /></GarageProvider>);
    await waitFor(() => expect(state()).toMatchObject({ n: 0, loading: false }));
  });
});

describe("the Shopping for bar", () => {
  const bar = (lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}><GarageProvider><VehicleBar /></GarageProvider></LangProvider>);

  it("shows nothing to a visitor who is not signed in", () => {
    bar();
    expect(screen.queryByText("Shopping for")).not.toBeInTheDocument();
    expect(screen.queryByText(/Add your car/)).not.toBeInTheDocument();
  });

  it("CRITICAL: shows the default car, linking to its parts, and Change opens the garage; in Arabic the Arabic name and /ar links", async () => {
    signIn("u1");
    bar();
    expect(await screen.findByText("BYD Seal DM-i · 2024")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "BYD Seal DM-i · 2024" }).getAttribute("href")).toBe("/search?generationId=g1&year=2024");
    expect(screen.getByRole("link", { name: "Change" }).getAttribute("href")).toBe("/garage");
  });

  it("in Arabic it speaks Arabic and every link keeps /ar", async () => {
    signIn("u1");
    bar("ar");
    expect(await screen.findByText("بي واي دي Seal DM-i · 2024")).toBeInTheDocument();
    expect(screen.getByText("التسوق لسيارة")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "تغيير" }).getAttribute("href")).toBe("/ar/garage");
  });

  it("a signed-in buyer with no saved car is invited to add one", async () => {
    signIn("u1");
    m.garage.current = [];
    bar();
    expect(await screen.findByRole("link", { name: "Add your car to see the parts that fit it" })).toBeInTheDocument();
  });
});

describe("Fits my car", () => {
  const toggle = () => render(<LangProvider lang="en"><GarageProvider><FitsMyCarToggle /></GarageProvider></LangProvider>);

  it("is not shown without a saved car", () => {
    toggle();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("CRITICAL: switching it on filters the search to the default car (and drops the page number); switching it off removes the filter and keeps the rest", async () => {
    signIn("u1");
    m.search.current = new URLSearchParams("category=brake&page=3");
    toggle();
    const sw = await screen.findByRole("switch");
    expect(sw.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(sw);
    expect(m.push.mock.lastCall?.[0]).toBe("/search?category=brake&generationId=g1&year=2024");
  });

  it("when the car is already applied the switch is on, and clicking it clears just that filter", async () => {
    signIn("u1");
    m.search.current = new URLSearchParams("category=brake&generationId=g1&year=2024");
    toggle();
    const sw = await screen.findByRole("switch");
    expect(sw.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(sw);
    expect(m.push.mock.lastCall?.[0]).toBe("/search?category=brake");
  });
});

describe("display currency", () => {
  let container: HTMLElement;
  const stage = (lang: "en" | "ar" = "en") => { ({ container } = render(<LangProvider lang={lang}><CurrencyProvider><Price usd={40} /> <CurrencySwitcher /></CurrencyProvider></LangProvider>)); };
  const priceText = () => (container.querySelector("span")?.textContent || "").replace(/\u00a0/g, " ");

  it("CRITICAL: prices are in US dollars until the server's rates arrive, and with no rates there is nothing to choose", async () => {
    stage();
    expect(priceText()).toBe("$40");
    await act(async () => {});
    expect(screen.queryByLabelText("Currency")).not.toBeInTheDocument();
  });

  it("a remembered choice is used once the rates are there", async () => {
    m.rates.current = { SAR: 3.75, AED: 3.67 };
    localStorage.setItem("leap_currency", "SAR");
    stage();
    await waitFor(() => expect(priceText()).toBe("SAR 150"));
  });

  it("CRITICAL: choosing a currency changes every price at once and is remembered", async () => {
    m.rates.current = { SAR: 3.75, AED: 3.67 };
    stage();
    const select = await screen.findByLabelText("Currency");
    expect([...(select as HTMLSelectElement).options].map((o) => o.value)).toEqual(["USD", "AED", "SAR"]);
    fireEvent.change(select, { target: { value: "AED" } });
    await waitFor(() => expect(priceText()).toBe("AED 147"));
    expect(localStorage.getItem("leap_currency")).toBe("AED");
  });

  it("a remembered currency the server no longer has a rate for is ignored (dollars), never a broken price", async () => {
    m.rates.current = { SAR: 3.75 };
    localStorage.setItem("leap_currency", "XYZ");
    stage();
    await act(async () => {});
    expect(priceText()).toBe("$40");
  });

  it("with no choice, the browser's region picks the default: an Arabic browser in Saudi Arabia sees riyals, in Arabic digits on the Arabic site", async () => {
    m.rates.current = { SAR: 3.75 };
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("ar-SA");
    stage("ar");
    await waitFor(() => expect(priceText()).toBe("١٥٠ ر.س"));
  });
});
