import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ProductCategory } from "@/lib/api";

// The four ways to find a part, with the server, the garage and the barcode reader replaced by fixed values.
const m = vi.hoisted(() => ({
  push: vi.fn(),
  garage: { current: { vehicles: [] as unknown[], defaultVehicle: null as unknown, signedIn: false, loading: false, add: vi.fn(async () => {}), remove: vi.fn(), makeDefault: vi.fn() } },
  parts: vi.fn(),
  decode: vi.fn(),
  brands: vi.fn(),
  models: vi.fn(),
  gens: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push, replace: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/find" }));
vi.mock("./GarageProvider", () => ({ useGarage: () => m.garage.current }));
vi.mock("./VehicleCascade", () => ({
  default: ({ onChange, idPrefix }: { onChange: (c: { generationId: string; year: number; label: string } | null) => void; idPrefix: string }) => (
    <button type="button" onClick={() => onChange({ generationId: "g9", year: 2020, label: "BYD Seal · 2020" })}>{`pick ${idPrefix}`}</button>
  ),
}));
vi.mock("@/lib/api", () => ({
  fetchPartsForCategory: (...a: unknown[]) => m.parts(...a),
  decodeVin: (...a: unknown[]) => m.decode(...a),
  fetchVehicleBrands: () => m.brands(),
  fetchModelsForBrand: (...a: unknown[]) => m.models(...a),
  fetchGenerationsForModel: (...a: unknown[]) => m.gens(...a),
}));

import FindTools from "./FindTools";
import { LangProvider } from "./LangProvider";

const categories: ProductCategory[] = [{ id: "brake", nameEn: "Brake System", nameAr: "نظام الفرامل", photoUrl: null, sortOrder: 1, commissionPercent: 10 }, { id: "filters", nameEn: "Filters", nameAr: "فلاتر", photoUrl: null, sortOrder: 2, commissionPercent: 10 }];
const myCar = { generationId: "g1", year: 2024, brand: "BYD", brandAr: null, model: "Seal DM-i", modelAr: null, generation: "2024", yearStart: 2024, yearEnd: 2024, isDefault: true };
const lastPush = () => m.push.mock.lastCall?.[0];
const tool = (props: { initialTab?: "vehicle" | "vin" | "part" | "symptom"; lang?: "en" | "ar" } = {}) => render(<LangProvider lang={props.lang ?? "en"}><FindTools categories={categories} initialTab={props.initialTab} /></LangProvider>);
const signedIn = (signed: boolean, car: unknown = null) => { m.garage.current = { ...m.garage.current, signedIn: signed, defaultVehicle: car, vehicles: car ? [car] : [] }; };

beforeEach(() => {
  vi.clearAllMocks();
  signedIn(false);
  m.parts.mockResolvedValue([{ id: "pt1", categoryId: "brake", nameEn: "Front Brake Disc", nameAr: "قرص فرامل أمامي", sortOrder: 1 }, { id: "pt2", categoryId: "brake", nameEn: "Brake Pads", nameAr: null, sortOrder: 2 }]);
  m.brands.mockResolvedValue([{ id: "b1", name: "BYD", nameAr: "بي واي دي" }]);
  m.models.mockResolvedValue([{ id: "m1", brandId: "b1", name: "Seal DM-i" }]);
  m.gens.mockResolvedValue([{ id: "gen1", modelId: "m1", name: "2024-on", yearStart: 2024, yearEnd: null }]);
  m.decode.mockResolvedValue({ vin: "X", isValidCheckDigit: true, make: "BYD", model: "Seal", modelYear: 2024, source: "local" });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("find a part: the tabs", () => {
  it("opens on the tab it is told to, and switching tabs switches the panel", () => {
    tool({ initialTab: "symptom" });
    expect(screen.getByRole("tab", { name: "By symptom" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("heading", { name: "What is wrong?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "By VIN" }));
    expect(screen.getByRole("tab", { name: "By VIN" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("heading", { name: "Find a car by its VIN" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "What is wrong?" })).not.toBeInTheDocument();
  });
});

describe("the which-part wizard", () => {
  it("CRITICAL: car from the garage, then section, then part: the search opens filtered by category, part AND car", async () => {
    signedIn(true, myCar);
    tool();
    fireEvent.click(screen.getByRole("button", { name: "Use my car: BYD Seal DM-i · 2024" }));
    expect(screen.getByRole("heading", { name: "Which section?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Brake System" }));
    expect(await screen.findByRole("heading", { name: 'Which specific part in "Brake System"?' })).toBeInTheDocument();
    expect(m.parts).toHaveBeenCalledWith("brake");
    fireEvent.click(await screen.findByRole("button", { name: "Front Brake Disc" }));
    expect(lastPush()).toBe("/search?category=brake&part=Front+Brake+Disc&generationId=g1&year=2024");
  });

  it("another car can be chosen instead (brand, model, year), and 'show all of the section' keeps that car", async () => {
    tool();
    expect(screen.queryByRole("button", { name: /Use my car/ })).not.toBeInTheDocument();      // no saved car, so no shortcut
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "pick wz" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Brake System" }));
    const all = await screen.findByRole("link", { name: "Show all of Brake System" });
    expect(all.getAttribute("href")).toBe("/search?category=brake&generationId=g9&year=2020");
  });

  it("the buyer may go on without choosing a car: then nothing about a car is added to the search", async () => {
    tool();
    fireEvent.click(screen.getByRole("button", { name: "Continue without choosing a car" }));
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect((await screen.findByRole("link", { name: "Show all of Filters" })).getAttribute("href")).toBe("/search?category=filters");
    fireEvent.click(await screen.findByRole("button", { name: "Front Brake Disc" }));
    expect(lastPush()).toBe("/search?category=filters&part=Front+Brake+Disc");           // (the mocked parts list is the same for every section)
  });

  it("Back goes to the previous step, and a section with no parts says so", async () => {
    m.parts.mockResolvedValue([]);
    tool();
    fireEvent.click(screen.getByRole("button", { name: "Continue without choosing a car" }));
    fireEvent.click(screen.getByRole("button", { name: "Brake System" }));
    expect(await screen.findByText("This section has no parts listed yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Which section?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Which car is it for?" })).toBeInTheDocument();
  });

  it("CRITICAL: in Arabic the questions, the section and the parts are Arabic (the English part name still goes to the search, because that is what the server filters by)", async () => {
    tool({ lang: "ar" });
    fireEvent.click(screen.getByRole("button", { name: "المتابعة دون اختيار مركبة" }));
    fireEvent.click(screen.getByRole("button", { name: "نظام الفرامل" }));
    expect(await screen.findByRole("heading", { name: 'ما القطعة المحددة في "نظام الفرامل"؟' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "قرص فرامل أمامي" }));
    expect(lastPush()).toBe("/ar/search?category=brake&part=Front+Brake+Disc");
    expect(screen.getByRole("button", { name: "Brake Pads" })).toBeInTheDocument();          // a part with no Arabic name keeps its English one
  });
});

describe("find a car by its VIN", () => {
  const vinTab = () => tool({ initialTab: "vin" });
  const lookUp = async (vin: string) => { fireEvent.change(screen.getByLabelText("VIN"), { target: { value: vin } }); fireEvent.click(screen.getByRole("button", { name: "Find my car" })); };

  it("CRITICAL: a VIN that cannot be valid (wrong length, or the letters I, O, Q) is refused with the reason, and nothing is looked up", async () => {
    vinTab();
    await lookUp("SHORT");
    expect(await screen.findByRole("alert")).toHaveTextContent("A VIN is always 17 characters, without the letters I, O or Q.");
    await lookUp("LGXC16DG2N0000O01");                                                      // an O
    expect(screen.getByRole("alert")).toHaveTextContent("A VIN is always 17 characters");
    expect(m.decode).not.toHaveBeenCalled();
  });

  it("CRITICAL: a VIN that resolves to one of our cars: found, with a link to its parts; signed in it can be saved to the garage", async () => {
    signedIn(true);
    vinTab();
    await lookUp("lgxc16dg2n0000001");                                                      // typed in lower case
    expect(await screen.findByText("Found: BYD Seal DM-i · 2024")).toBeInTheDocument();
    expect(m.decode).toHaveBeenCalledWith("LGXC16DG2N0000001");                             // sent in capitals
    expect(screen.getByRole("link", { name: "Show parts that fit" }).getAttribute("href")).toBe("/search?generationId=gen1&year=2024");
    fireEvent.click(screen.getByRole("button", { name: "Add to my garage" }));
    await waitFor(() => expect(m.garage.current.add).toHaveBeenCalledWith("gen1", 2024));
    expect(await screen.findByRole("button", { name: "Added to your garage" })).toBeDisabled();
  });

  it("CRITICAL: with the garage FULL (5 cars) the Add button is greyed out and says why, with a way to the garage; with room it is not", async () => {
    m.garage.current = { ...m.garage.current, signedIn: true, vehicles: Array.from({ length: 5 }, (_, i) => ({ generationId: `g${i}`, year: 2020 })) };
    vinTab();
    await lookUp("LGXC16DG2N0000001");
    expect(await screen.findByRole("button", { name: "Add to my garage" })).toBeDisabled();
    expect(screen.getByText(/Your garage is full\. You can save up to 5 vehicles. Remove one to add another./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open my garage" }).getAttribute("href")).toBe("/garage");
    expect(m.garage.current.add).not.toHaveBeenCalled();
  });

  it("room for another (4 cars): the button works and no 'full' note is shown", async () => {
    m.garage.current = { ...m.garage.current, signedIn: true, vehicles: Array.from({ length: 4 }, (_, i) => ({ generationId: `g${i}`, year: 2020 })) };
    vinTab();
    await lookUp("LGXC16DG2N0000001");
    expect(await screen.findByRole("button", { name: "Add to my garage" })).toBeEnabled();
    expect(screen.queryByText(/Your garage is full/)).not.toBeInTheDocument();
  });

  it("a refusal from the server (another device filled the garage) shows the server's own message, not a vague error", async () => {
    signedIn(true);
    m.garage.current.add.mockRejectedValueOnce(new Error("You can save up to 5 vehicles. Remove one to add another."));
    vinTab();
    await lookUp("LGXC16DG2N0000001");
    fireEvent.click(await screen.findByRole("button", { name: "Add to my garage" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You can save up to 5 vehicles. Remove one to add another.");
  });

  it("signed out, the car is found but saving needs a sign-in (and says so)", async () => {
    vinTab();
    await lookUp("LGXC16DG2N0000001");
    expect(await screen.findByRole("link", { name: "Sign in to save it to your garage" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add to my garage" })).not.toBeInTheDocument();
  });

  it("CRITICAL: when only part of it can be matched it says exactly how far it got and lets the buyer finish the choice (never guesses)", async () => {
    m.decode.mockResolvedValue({ vin: "X", isValidCheckDigit: true, make: "BYD", model: "Atto 99", modelYear: 2024, source: "local" });
    vinTab();
    await lookUp("LGXC16DG2N0000001");
    expect(await screen.findByText("Decoded: BYD Atto 99 (2024). Please choose your model below.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "pick vinpick" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "pick vinpick" }));
    expect(screen.getByRole("link", { name: "Show parts that fit" }).getAttribute("href")).toBe("/search?generationId=g9&year=2020");
  });

  it("a brand we do not carry, and a VIN that cannot be decoded, each say so", async () => {
    m.decode.mockResolvedValue({ vin: "X", isValidCheckDigit: true, make: "Tesla", model: "Model 3", modelYear: 2021, source: "nhtsa" });
    vinTab();
    await lookUp("LGXC16DG2N0000001");
    expect(await screen.findByText("Decoded: Tesla Model 3 (2021), but this brand isn't in our catalog yet. Please choose your car manually.")).toBeInTheDocument();
    m.decode.mockResolvedValue({ vin: "X", isValidCheckDigit: false, make: null, model: null, modelYear: null, source: "unrecognized" });
    await lookUp("LGXC16DG2N0000002");
    expect(await screen.findByText("We could not recognise this VIN. Choose your car by brand, model and year instead.")).toBeInTheDocument();
  });

  it("a lookup that fails (the server is down) is a plain message, not a crash", async () => {
    m.decode.mockRejectedValue(new Error("down"));
    vinTab();
    await lookUp("LGXC16DG2N0000001");
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
  });
});

describe("find a part by its number", () => {
  const partTab = () => tool({ initialTab: "part" });

  it("CRITICAL: a typed part number opens the search for it (and keeps the buyer's car); nothing is searched while the box is empty", () => {
    partTab();
    expect(screen.getByRole("button", { name: "Search" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Part number"), { target: { value: " 34116792217 " } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(lastPush()).toBe("/search?q=34116792217");
  });

  it("with a saved car, the search is for that car", () => {
    signedIn(true, myCar);
    partTab();
    fireEvent.change(screen.getByLabelText("Part number"), { target: { value: "34116792217" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(lastPush()).toBe("/search?q=34116792217&generationId=g1&year=2024");
  });

  it("CRITICAL: a browser that cannot read barcodes says so and offers typing (the scan buttons are off, not broken)", () => {
    partTab();
    expect(screen.getByText("This browser cannot read barcodes. Type the part number instead.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scan barcode with the camera" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Use a photo of the barcode" })).toBeDisabled();
  });

  it("CRITICAL: a photo of a barcode is read on the device and opens the search for the number in it", async () => {
    vi.stubGlobal("BarcodeDetector", class { detect = async () => [{ rawValue: "ABC-123" }]; });
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ close: vi.fn() })));
    partTab();
    expect(screen.getByRole("button", { name: "Scan barcode with the camera" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Use a photo of the barcode"), { target: { files: [new File(["x"], "box.jpg", { type: "image/jpeg" })] } });
    await waitFor(() => expect(lastPush()).toBe("/search?q=ABC-123"));
    expect(screen.getByText("Found: ABC-123")).toBeInTheDocument();
  });

  it("a photo with no barcode in it says so and searches nothing", async () => {
    vi.stubGlobal("BarcodeDetector", class { detect = async () => []; });
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ close: vi.fn() })));
    partTab();
    fireEvent.change(screen.getByLabelText("Use a photo of the barcode"), { target: { files: [new File(["x"], "box.jpg", { type: "image/jpeg" })] } });
    expect(await screen.findByText("No barcode found in that photo.")).toBeInTheDocument();
    expect(m.push).not.toHaveBeenCalled();
  });

  it("a camera the buyer refused (or that does not exist) is a plain message", async () => {
    vi.stubGlobal("BarcodeDetector", class { detect = async () => []; });
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: vi.fn().mockRejectedValue(new Error("denied")) }, configurable: true });
    partTab();
    fireEvent.click(screen.getByRole("button", { name: "Scan barcode with the camera" }));
    expect(await screen.findByText("The camera is not available. Check the permission, or type the number.")).toBeInTheDocument();
  });
});

describe("shop by symptom", () => {
  it("CRITICAL: the 8 symptoms each open the search for the parts that usually fix it, with the app's own search words", () => {
    tool({ initialTab: "symptom" });
    expect(screen.getAllByRole("link")).toHaveLength(8);
    expect(screen.getByRole("link", { name: "Squealing or grinding when braking" }).getAttribute("href")).toBe("/search?q=brake+pads+disc");
    expect(screen.getByRole("link", { name: "Engine overheating" }).getAttribute("href")).toBe("/search?q=water+pump+head+gasket");
  });

  it("a saved car is kept in every symptom search", () => {
    signedIn(true, myCar);
    tool({ initialTab: "symptom" });
    expect(screen.getByRole("link", { name: "Lights not working" }).getAttribute("href")).toBe("/search?q=headlight+taillight+bulb&generationId=g1&year=2024");
  });

  it("in Arabic the symptoms are the app's Arabic ones, and the links keep /ar", () => {
    tool({ initialTab: "symptom", lang: "ar" });
    const link = screen.getByRole("link", { name: "ارتفاع حرارة المحرك" });
    expect(link.getAttribute("href")).toBe("/ar/search?q=water+pump+head+gasket");
    expect(screen.getByRole("heading", { name: "ما المشكلة؟" })).toBeInTheDocument();
  });
});
