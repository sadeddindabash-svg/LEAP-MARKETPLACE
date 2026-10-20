import { describe, it, expect, afterEach, vi } from "vitest";
import type { GarageVehicle } from "./api";
import { defaultVehicle, searchHrefFor, seatsText, vehicleKey, vehicleLabel, vehicleName, vehiclePhoto } from "./garage";
import { barcodeSupported, readBarcode, readBarcodeFromFile } from "./barcode";

const car = (over: Partial<GarageVehicle> = {}): GarageVehicle => ({ generationId: "g1", year: 2024, brand: "BYD", brandAr: "بي واي دي", model: "Seal DM-i", modelAr: null, generation: "2024", yearStart: 2024, yearEnd: 2024, isDefault: false, ...over });

describe("garage helpers", () => {
  it("the car's name and label follow the page's language, with the English name where there is no Arabic one", () => {
    expect(vehicleName("en", car())).toBe("BYD Seal DM-i");
    expect(vehicleName("ar", car())).toBe("بي واي دي Seal DM-i");
    expect(vehicleLabel("en", car())).toBe("BYD Seal DM-i · 2024");
    expect(vehicleLabel("ar", car({ modelAr: "سيل" }))).toBe("بي واي دي سيل · 2024");
  });

  it("CRITICAL: a car's picture is its year photo, else its brand photo, else none (the mobile app's order)", () => {
    expect(vehiclePhoto(car({ generationPhotoUrl: "/y.jpg", brandPhotoUrl: "/b.jpg" }))).toBe("/y.jpg");
    expect(vehiclePhoto(car({ generationPhotoUrl: null, brandPhotoUrl: "/b.jpg" }))).toBe("/b.jpg");
    expect(vehiclePhoto(car({ generationPhotoUrl: null, brandPhotoUrl: null }))).toBeNull();
    expect(vehiclePhoto(car())).toBeNull();
  });

  it("the default car is the one marked default, else the first saved, else none", () => {
    const a = car({ generationId: "a" }), b = car({ generationId: "b", isDefault: true });
    expect(defaultVehicle([a, b])?.generationId).toBe("b");
    expect(defaultVehicle([a])?.generationId).toBe("a");
    expect(defaultVehicle([])).toBeNull();
  });

  it("a car's parts are found at its search address", () => {
    expect(searchHrefFor(car({ generationId: "gen_bmw_f20", year: 2017 }))).toBe("/search?generationId=gen_bmw_f20&year=2017");
    expect(searchHrefFor(car({ generationId: "a&b" }))).toBe("/search?generationId=a%26b&year=2024");
  });
});

describe("barcode reading", () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  const withDetector = (detect: (s: unknown) => Promise<Array<{ rawValue: string }>>) =>
    vi.stubGlobal("BarcodeDetector", class { detect = detect; });

  it("says whether this browser can read barcodes at all", () => {
    expect(barcodeSupported()).toBe(false);
    withDetector(async () => []);
    expect(barcodeSupported()).toBe(true);
  });

  it("CRITICAL: returns the first code found, trimmed; null when there is none or the browser cannot read barcodes", async () => {
    expect(await readBarcode({} as ImageBitmapSource)).toBeNull();                         // no detector in this browser
    withDetector(async () => [{ rawValue: "  34116792217 " }, { rawValue: "other" }]);
    expect(await readBarcode({} as ImageBitmapSource)).toBe("34116792217");
    withDetector(async () => []);
    expect(await readBarcode({} as ImageBitmapSource)).toBeNull();
    withDetector(async () => [{ rawValue: "   " }]);
    expect(await readBarcode({} as ImageBitmapSource)).toBeNull();
  });

  it("a photo is read on the device and the picture is released afterwards", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ close })));
    withDetector(async () => [{ rawValue: "ABC-123" }]);
    expect(await readBarcodeFromFile(new Blob(["x"]))).toBe("ABC-123");
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe("a saved car with a VERSION", () => {
  const version = { id: "v1", name: "AWD Flagship", nameAr: "دفع كلي فلاجشيب", engine: "1.5T", engineAr: "1.5 لتر", seats: 5, photoUrl: "/uploads/v.png" };
  it("CRITICAL: the label adds the version in the page's language (English name where there is no Arabic one); a car without one is labelled as before", () => {
    expect(vehicleLabel("en", car({ version }))).toBe("BYD Seal DM-i · 2024 · AWD Flagship");
    expect(vehicleLabel("ar", car({ version }))).toBe("بي واي دي Seal DM-i · 2024 · دفع كلي فلاجشيب");
    expect(vehicleLabel("ar", car({ version: { ...version, nameAr: null } }))).toBe("بي واي دي Seal DM-i · 2024 · AWD Flagship");
    expect(vehicleLabel("en", car({ version: null }))).toBe("BYD Seal DM-i · 2024");
    expect(vehicleLabel("en", car())).toBe("BYD Seal DM-i · 2024");
  });
  it("CRITICAL: the picture is the version's photo, else the year's, else the brand's, else none", () => {
    expect(vehiclePhoto(car({ version, generationPhotoUrl: "/y.png", brandPhotoUrl: "/b.png" }))).toBe("/uploads/v.png");
    expect(vehiclePhoto(car({ version: { ...version, photoUrl: null }, generationPhotoUrl: "/y.png", brandPhotoUrl: "/b.png" }))).toBe("/y.png");
    expect(vehiclePhoto(car({ version: null, generationPhotoUrl: null, brandPhotoUrl: "/b.png" }))).toBe("/b.png");
    expect(vehiclePhoto(car({ version: null, generationPhotoUrl: null, brandPhotoUrl: null }))).toBeNull();
  });
  it("CRITICAL: two versions of one year are two different cars (and a car with no version is a third kind)", () => {
    const keys = [vehicleKey(car()), vehicleKey(car({ versionId: "a" })), vehicleKey(car({ versionId: "b" })), vehicleKey(car({ versionId: null })), vehicleKey(car({ year: 2023 }))];
    expect(new Set(keys).size).toBe(4);                                              // no version and null are the same kind
    expect(keys[0]).toBe(keys[3]);
  });
  it("seats are written in the right form: 1 seat, 2 seats, 5 seats; Arabic: مقعد واحد, مقعدان, 5 مقاعد, 11 مقعدًا", () => {
    expect([1, 2, 5, 12].map((n) => seatsText("en", n))).toEqual(["1 seat", "2 seats", "5 seats", "12 seats"]);
    expect([1, 2, 5, 10, 11, 12].map((n) => seatsText("ar", n))).toEqual(["مقعد واحد", "مقعدان", "5 مقاعد", "10 مقاعد", "11 مقعدًا", "12 مقعدًا"]);
  });
});

