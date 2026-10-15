import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { COUNTRIES, countryName, findCountry } from "./countries";
import { EMPTY_ADDRESS, MAX_ADDRESSES, SAUDI_NATIONAL_ADDRESS, addressPayload, addressProblem, fieldsOf, isSaudi, EMAIL_PATTERN, type AddressFields } from "./address";
import { atStockLimit, estimatedWeightKg, hasMultipleSuppliers, isOnSale, leftInStock, lineTotal, loyaltyBeatsPromo, newIdempotencyKey, overStockItems, stockHint, supplierLabel, totals } from "./cart";
import { reverseGeocode, suggestionFrom } from "./nominatim";
import { SERVER_MESSAGES_AR, apiMessage, localizeServerMessage, setErrorLanguage } from "./serverMessages";
import type { CartItem } from "./api";

const item = (over: Partial<CartItem> = {}): CartItem => ({ productId: "p1", quantity: 1, name: "Disc", price: 40, currencyCode: "USD", supplierName: "Supplier LEAP-SLR-AAAA", stockQuantity: 10, ...over });
const addr = (over: Partial<AddressFields> = {}): AddressFields => ({ ...EMPTY_ADDRESS, label: "Home", recipientName: "Sam", phone: "+966500000000", country: "Oman", city: "Muscat", streetAddress: "1 Main St", ...over });

describe("countries", () => {
  it("CRITICAL: they are exactly the server's launch markets (so an address always names a country the server can resolve), each with real Arabic", () => {
    const markets = fs.readFileSync(path.resolve(__dirname, "../../../services/api/src/config/markets.js"), "utf8");
    const server = [...markets.matchAll(/countryCode:\s*'([A-Z]{2})',\s*countryName:\s*"([^"]+)"/g)].map((m) => ({ code: m[1], en: m[2] }));
    expect(server).toHaveLength(40);
    expect(COUNTRIES.map(({ code, en }) => ({ code, en }))).toEqual(server);
    for (const c of COUNTRIES) expect(/[\u0600-\u06FF]/.test(c.ar), c.en).toBe(true);
  });
  it("names follow the language, and a country is found however it was typed (English, Arabic, code), never one we do not serve", () => {
    expect(countryName("en", "Oman")).toBe("Oman");
    expect(countryName("ar", "Oman")).toBe(COUNTRIES.find((c) => c.en === "Oman")!.ar);
    expect(countryName("ar", "Atlantis")).toBe("Atlantis");
    expect(findCountry(" saudi arabia ")?.code).toBe("SA");
    expect(findCountry("SA")?.en).toBe("Saudi Arabia");
    expect(findCountry(COUNTRIES.find((c) => c.code === "AE")!.ar)?.en).toBe("United Arab Emirates");
    expect(findCountry("Atlantis")).toBeUndefined();
    expect(findCountry("")).toBeUndefined();
    expect(findCountry(null)).toBeUndefined();
  });
});

describe("address rules (the mobile app's address form)", () => {
  it("CRITICAL: everything required must be filled, a country we serve chosen, and (for a saved address) a label given", () => {
    expect(addressProblem(addr(), { needLabel: true })).toBeNull();
    expect(addressProblem(addr({ label: "  " }), { needLabel: true })).toBe("fill_every_field");
    expect(addressProblem(addr({ label: "" }), { needLabel: false })).toBeNull();               // an address for one order needs no label
    for (const field of ["recipientName", "phone", "country", "city", "streetAddress"] as const) expect(addressProblem(addr({ [field]: " " }), { needLabel: false }), field).toBe("fill_every_field");
    expect(addressProblem(addr({ country: "Atlantis" }), { needLabel: false })).toBe("country_not_served");
  });
  it("CRITICAL: Saudi Arabia needs its address code (four letters then four numbers); no other country is asked for it", () => {
    expect(SAUDI_NATIONAL_ADDRESS.test("RRRD2929")).toBe(true);
    expect(SAUDI_NATIONAL_ADDRESS.test("rrrd2929")).toBe(true);
    for (const bad of ["RRR2929", "RRRD292", "RRRD29290", "1234ABCD", ""]) expect(SAUDI_NATIONAL_ADDRESS.test(bad), bad).toBe(false);
    expect(isSaudi("Saudi Arabia")).toBe(true);
    expect(isSaudi("Oman")).toBe(false);
    expect(addressProblem(addr({ country: "Saudi Arabia" }), { needLabel: false })).toBe("national_address_format");
    expect(addressProblem(addr({ country: "Saudi Arabia", nationalAddress: "RRRD2929" }), { needLabel: false })).toBeNull();
  });
  it("the saved-address body: English country, empty optional fields as null, the Saudi code in capitals and only for Saudi Arabia", () => {
    expect(addressPayload(addr({ phone: " +968 1 " }))).toEqual({ label: "Home", recipientName: "Sam", phone: "+968 1", country: "Oman", state: null, city: "Muscat", streetAddress: "1 Main St", postalCode: null });
    const saudi = addressPayload(addr({ country: "Saudi Arabia", nationalAddress: "rrrd2929", postalCode: "12345", state: "Riyadh" }), true);
    expect(saudi).toMatchObject({ country: "Saudi Arabia", nationalAddress: "RRRD2929", postalCode: "12345", state: "Riyadh", isDefault: true });
    expect(addressPayload(addr({ country: "oman", nationalAddress: "RRRD2929" }))).not.toHaveProperty("nationalAddress");
    expect(addressPayload(addr({ country: COUNTRIES.find((c) => c.code === "OM")!.ar })).country).toBe("Oman");          // typed in Arabic, stored in English
  });
  it("a saved address becomes form fields (for editing), and the limit is the server's three", () => {
    expect(fieldsOf({ label: "Work", recipientName: "A", phone: "1", country: "Oman", city: "C", streetAddress: "S", postalCode: null })).toMatchObject({ label: "Work", state: "", postalCode: "", nationalAddress: "" });
    expect(MAX_ADDRESSES).toBe(3);
    expect(EMAIL_PATTERN.test("a@b.co")).toBe(true);
    for (const bad of ["a@b", "a b@c.d", "@b.c", "abc"]) expect(EMAIL_PATTERN.test(bad), bad).toBe(false);
  });
});

describe("cart rules (the mobile app's cart)", () => {
  it("CRITICAL: the stock hint appears only when 5 or fewer would remain; 'only N left' until zero, then the limit message", () => {
    expect(stockHint(item({ quantity: 1, stockQuantity: 10 }))).toBeNull();                      // 9 would remain
    expect(stockHint(item({ quantity: 4, stockQuantity: 10 }))).toBeNull();                      // 6
    expect(stockHint(item({ quantity: 5, stockQuantity: 10 }))).toEqual({ kind: "only", left: 5 });
    expect(stockHint(item({ quantity: 9, stockQuantity: 10 }))).toEqual({ kind: "only", left: 1 });
    expect(stockHint(item({ quantity: 10, stockQuantity: 10 }))).toEqual({ kind: "limit" });
    expect(stockHint(item({ quantity: 12, stockQuantity: 10 }))).toEqual({ kind: "limit" });
    expect(atStockLimit(item({ quantity: 10, stockQuantity: 10 }))).toBe(true);
    expect(atStockLimit(item({ quantity: 9, stockQuantity: 10 }))).toBe(false);
    expect(leftInStock(item({ quantity: 12, stockQuantity: 10 }))).toBe(0);
  });
  it("CRITICAL: lines asking for more than is in stock are found (they block the order); the wait-and-ship choice needs more than one supplier", () => {
    const cart = { items: [item({ productId: "a", quantity: 3, stockQuantity: 3 }), item({ productId: "b", name: "Short", quantity: 4, stockQuantity: 2 })] };
    expect(overStockItems(cart).map((i) => i.name)).toEqual(["Short"]);
    expect(hasMultipleSuppliers({ items: [item(), item({ productId: "b" })] })).toBe(false);
    expect(hasMultipleSuppliers({ items: [item(), item({ productId: "b", supplierName: "Supplier LEAP-SLR-BBBB" })] })).toBe(true);
    expect(hasMultipleSuppliers({ items: [] })).toBe(false);
  });
  it("CRITICAL: the total is the subtotal minus the ONE discount the server applied, never negative, and the discount can never exceed the subtotal", () => {
    const base = { items: [item({ price: 40, quantity: 2 }), item({ productId: "b", price: 20 })] };           // subtotal 100
    expect(totals({ ...base, appliedDiscountUsd: 0, appliedDiscountSource: "none" })).toMatchObject({ subtotal: 100, discount: 0, total: 100, source: "none" });
    expect(totals({ ...base, appliedDiscountUsd: 15, appliedDiscountSource: "loyalty", loyaltyDiscountPercentage: 15 })).toMatchObject({ discount: 15, total: 85, source: "loyalty", loyaltyPercent: 15 });
    expect(totals({ ...base, appliedDiscountUsd: 10, appliedDiscountSource: "promo", appliedPromoCode: "SAVE10" })).toMatchObject({ discount: 10, total: 90, source: "promo", promoCode: "SAVE10" });
    expect(totals({ ...base, appliedDiscountUsd: 500, appliedDiscountSource: "promo" }).total).toBe(0);      // capped at the subtotal
    expect(totals({ ...base, appliedDiscountUsd: -5, appliedDiscountSource: "promo" }).discount).toBe(0);
    expect(totals({ items: [] })).toMatchObject({ subtotal: 0, discount: 0, total: 0, source: "none" });    // the fields a cart may not have yet
  });
  it("the app's message when a promo code was tried but the loyalty discount is bigger", () => {
    expect(loyaltyBeatsPromo({ appliedDiscountSource: "loyalty", appliedPromoCode: "SAVE5" })).toBe(true);
    expect(loyaltyBeatsPromo({ appliedDiscountSource: "loyalty", appliedPromoCode: null })).toBe(false);
    expect(loyaltyBeatsPromo({ appliedDiscountSource: "promo", appliedPromoCode: "SAVE5" })).toBe(false);
  });
  it("line total, sale price and estimated weight (shown when ANY line has one; a line without counts as zero)", () => {
    expect(lineTotal(item({ price: 12.5, quantity: 3 }))).toBe(37.5);
    expect(isOnSale(item({ price: 40, originalPrice: 50 }))).toBe(true);
    expect(isOnSale(item({ price: 40, originalPrice: 40 }))).toBe(false);
    expect(isOnSale(item({ price: 40, originalPrice: null }))).toBe(false);
    expect(estimatedWeightKg({ items: [item(), item({ productId: "b" })] })).toBeNull();
    expect(estimatedWeightKg({ items: [item({ weightKg: 2.5, quantity: 2 }), item({ productId: "b", weightKg: null })] })).toBe(5);
  });
  it("the supplier label uses the page's word for Supplier (the code after it is kept); the idempotency key is unique each time", () => {
    expect(supplierLabel("Supplier LEAP-SLR-AB12", "المورد")).toBe("المورد LEAP-SLR-AB12");
    expect(supplierLabel("Supplier LEAP-SLR-BBBB", "Supplier")).toBe("Supplier LEAP-SLR-BBBB");
    expect(supplierLabel(null, "المورد")).toBe("");
    expect(new Set(Array.from({ length: 50 }, newIdempotencyKey)).size).toBe(50);
  });
});

describe("finding an address from the buyer's location (the app's rules)", () => {
  it("CRITICAL: the street is house number and road (else the whole name), the city is the first of city, town, village, county", () => {
    expect(suggestionFrom({ address: { house_number: "12", road: "Al Noor St", city: "Muscat", country: "Oman" } })).toEqual({ streetAddress: "12 Al Noor St", city: "Muscat", country: "Oman" });
    expect(suggestionFrom({ address: { road: "Al Noor St", town: "Sohar", country: "Oman" } })).toEqual({ streetAddress: "Al Noor St", city: "Sohar", country: "Oman" });
    expect(suggestionFrom({ address: { village: "V", county: "C", country: "Oman" }, display_name: "A place, V, Oman" })).toEqual({ streetAddress: "A place, V, Oman", city: "V", country: "Oman" });
    expect(suggestionFrom({ address: { county: "C" } })).toEqual({ streetAddress: "", city: "C", country: "" });
    expect(suggestionFrom({})).toBeNull();
    expect(suggestionFrom(null)).toBeNull();
  });
  it("it is an AID: any failure (a refusal, no network, nothing found) is null, never an error", async () => {
    const ok = (body: unknown) => (async () => ({ ok: true, json: async () => body }) as Response) as unknown as typeof fetch;
    expect(await reverseGeocode(1, 2, ok({ address: { road: "R", city: "C", country: "Oman" } }))).toEqual({ streetAddress: "R", city: "C", country: "Oman" });
    expect(await reverseGeocode(1, 2, (async () => ({ ok: false }) as Response) as unknown as typeof fetch)).toBeNull();
    expect(await reverseGeocode(1, 2, (async () => { throw new Error("offline"); }) as unknown as typeof fetch)).toBeNull();
    expect(await reverseGeocode(1, 2, ok({}))).toBeNull();
  });
});

describe("server messages in Arabic (the mobile app's own list)", () => {
  afterEach(() => setErrorLanguage("en"));
  it("CRITICAL: the list is EXACTLY the mobile app's (generated from its file), so the two cannot drift apart", () => {
    const dart = fs.readFileSync(path.resolve(__dirname, "../../mobile/lib/core/server_messages.dart"), "utf8");
    const body = dart.slice(dart.indexOf("const Map<String, String> kServerMessagesAr = {"), dart.indexOf("\n};"));
    const q = String.raw`(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")`;
    const clean = (v: string) => v.replace(/\\(['"])/g, "$1");
    const rows = [...body.matchAll(new RegExp(String.raw`^\s*${q}\s*:\s*${q}\s*,`, "gm"))].map((m) => [clean(m[1] ?? m[2]), clean(m[3] ?? m[4])]);
    expect(rows.length).toBeGreaterThan(80);
    expect(Object.entries(SERVER_MESSAGES_AR)).toEqual(rows);
  });
  it("an exact message is translated, the generic ones too (keeping the code), an unknown one stays English", () => {
    const [english, arabic] = Object.entries(SERVER_MESSAGES_AR)[0];
    expect(localizeServerMessage(english)).toBe(arabic);
    expect(localizeServerMessage(`Failed to load orders (500)`)).toContain("(500)");
    expect(/[\u0600-\u06FF]/.test(localizeServerMessage("Failed to load orders (500)"))).toBe(true);
    expect(localizeServerMessage("Could not reach the server: timeout")).toContain("timeout");
    expect(localizeServerMessage("Something nobody translated")).toBe("Something nobody translated");
  });
  it("CRITICAL: only an Arabic page gets Arabic errors; English stays exactly as the server wrote it; blank stays blank", () => {
    const [english, arabic] = Object.entries(SERVER_MESSAGES_AR)[0];
    expect(apiMessage(english)).toBe(english);
    setErrorLanguage("ar");
    expect(apiMessage(english)).toBe(arabic);
    expect(apiMessage(undefined)).toBe("");
    expect(apiMessage("")).toBe("");
  });
});

