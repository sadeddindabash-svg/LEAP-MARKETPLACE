import { describe, it, expect } from "vitest";
import type { QuoteRequest, QuoteRequestItem } from "./api";
import { MAX_QUOTE_ITEMS, bannerKey, canAddItems, canAdjustQuote, canCancel, canOrder, displayStatus, quoteTotal, readyItems, statusColors, statusKey } from "./quotes";
import { timeAgo } from "./time";
import { savedSearchHref } from "./savedSearch";

const item = (over: Partial<QuoteRequestItem> = {}): QuoteRequestItem => ({ id: 1, name: "Part", description: null, referencePhotoUrl: null, quantity: 1, status: "pending", productId: null, ...over });
const request = (over: Partial<QuoteRequest> = {}): QuoteRequest => ({ id: "qr_1", generationId: "g", year: 2020, brand: "BYD", model: "Seal", generation: "G1", status: "draft", createdAt: "2026-10-01T00:00:00Z", submittedAt: null, quotedAt: null, expiresAt: null, items: [], ...over });
const NOW = new Date("2026-10-10T12:00:00Z").getTime();
const future = "2026-10-15T00:00:00Z", past = "2026-10-05T00:00:00Z";

describe("quote request rules (the mobile app's)", () => {
  it("CRITICAL: a quote that is past its date reads 'expired' (the server refuses to order from it too); one still valid, or any other status, is unchanged", () => {
    expect(displayStatus(request({ status: "quoted", expiresAt: past }), NOW)).toBe("expired");
    expect(displayStatus(request({ status: "quoted", expiresAt: future }), NOW)).toBe("quoted");
    expect(displayStatus(request({ status: "quoted", expiresAt: null }), NOW)).toBe("quoted");
    for (const s of ["draft", "submitted", "ordered", "cancelled", "expired"]) expect(displayStatus(request({ status: s, expiresAt: past }), NOW)).toBe(s);
  });
  it("CRITICAL: a request can be cancelled only before it is quoted; items can be added only to a draft; quantities change only on a VALID quote", () => {
    expect(canCancel(request({ status: "draft" }))).toBe(true);
    expect(canCancel(request({ status: "submitted" }))).toBe(true);
    for (const s of ["quoted", "ordered", "cancelled"]) expect(canCancel(request({ status: s })), s).toBe(false);
    expect(canAddItems(request({ status: "draft" }))).toBe(true);
    expect(canAddItems(request({ status: "submitted" }))).toBe(false);
    expect(canAdjustQuote(request({ status: "quoted", expiresAt: future }), NOW)).toBe(true);
    expect(canAdjustQuote(request({ status: "quoted", expiresAt: past }), NOW)).toBe(false);
    expect(canAdjustQuote(request({ status: "submitted" }), NOW)).toBe(false);
  });
  it("CRITICAL: only parts that are priced AND approved can be bought; the total is just those, times their quantities; ordering needs a valid quote and at least one", () => {
    const items = [item({ id: 1, status: "priced", readyToOrder: true, price: 40, quantity: 2 }), item({ id: 2, status: "priced", readyToOrder: false, price: 99 }), item({ id: 3, status: "unavailable" }), item({ id: 4, status: "pending" }), item({ id: 5, status: "priced", readyToOrder: true, price: 10.5, quantity: 3 })];
    const q = request({ status: "quoted", expiresAt: future, items });
    expect(readyItems(q).map((i) => i.id)).toEqual([1, 5]);
    expect(quoteTotal(q)).toBeCloseTo(111.5, 2);
    expect(canOrder(q, NOW)).toBe(true);
    expect(canOrder({ ...q, expiresAt: past }, NOW)).toBe(false);                             // expired
    expect(canOrder({ ...q, status: "submitted" }, NOW)).toBe(false);
    expect(canOrder({ ...q, items: items.slice(1, 4) }, NOW)).toBe(false);                    // nothing ready
    expect(quoteTotal(request({ items: [] }))).toBe(0);
    expect(MAX_QUOTE_ITEMS).toBe(20);
  });
  it("status words and banners exist for every status the app knows; colours are the app's (quoted green, ordered blue, submitted amber, the rest grey)", () => {
    for (const s of ["draft", "submitted", "quoted", "ordered", "expired", "cancelled"]) { expect(statusKey(s), s).not.toBeNull(); expect(bannerKey(s), s).not.toBeNull(); }
    expect(statusKey("something_new")).toBeNull();
    expect(statusColors("quoted").fg).toBe("#0f6b49"); expect(statusColors("ordered").fg).toBe("#1d5fb0"); expect(statusColors("submitted").fg).toBe("#7a4e00"); expect(statusColors("draft").fg).toBe("#53636f");
  });
});

describe("time ago and saved search addresses", () => {
  const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();
  it("reads 'just now', minutes, hours and days (the app's wording), in both languages, and a broken date is blank", () => {
    expect(timeAgo("en", at(20_000), NOW)).toBe("just now");
    expect(timeAgo("en", at(5 * 60_000), NOW)).toBe("5m ago");
    expect(timeAgo("en", at(59 * 60_000), NOW)).toBe("59m ago");
    expect(timeAgo("en", at(3 * 3_600_000), NOW)).toBe("3h ago");
    expect(timeAgo("en", at(2 * 86_400_000), NOW)).toBe("2d ago");
    expect(timeAgo("ar", at(5 * 60_000), NOW)).toBe("منذ 5 د");
    expect(timeAgo("ar", at(2 * 86_400_000), NOW)).toBe("منذ 2 يوم");
    expect(timeAgo("en", "not a date", NOW)).toBe("");
  });
  it("a saved search opens the search with its words and its category, whichever it has", () => {
    expect(savedSearchHref({ searchTerm: "brake disc", category: "brake" })).toBe("/search?q=brake+disc&category=brake");
    expect(savedSearchHref({ searchTerm: "disc", category: null })).toBe("/search?q=disc");
    expect(savedSearchHref({ searchTerm: null, category: "brake" })).toBe("/search?category=brake");
    expect(savedSearchHref({ searchTerm: null, category: null })).toBe("/search");
  });
});
