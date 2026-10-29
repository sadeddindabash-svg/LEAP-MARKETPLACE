import { describe, it, expect, vi } from "vitest";
import type { OrderDetail, SupplierSubOrder } from "./api";
import { STAGES, activeShipmentCount, buyerFacingStatus, formatDate, hasArabicLetters, isOrderCancellable, isPartiallyCancellable, isSubOrderCancellable, needsEnglishAddressCheck, reorder, reorderLines, showTrackingLink, statusLabel, subOrderStage } from "./orders";

const hub = (status: string | null) => (status ? { id: 1, status, updatedAt: "x", events: [] } : null);
const part = (status: string, hubStatus: string | null = null, over: Partial<SupplierSubOrder> = {}): SupplierSubOrder => ({ subOrderId: 1, supplierId: "s", supplierName: "Supplier LEAP-SLR-AB12", status, trackingNumber: null, hubId: null, hubName: null, hubShipment: hub(hubStatus), items: [], ...over });
const order = (parts: SupplierSubOrder[], over: Partial<OrderDetail> = {}): OrderDetail => ({ id: "o1", userId: "u", guestEmail: null, isGuestOrder: false, status: "to_ship", displayStatus: "to_ship", total: 10, discountAmount: 0, promoCode: null, currencyCode: "USD", placedAt: "2026-10-01T10:00:00Z", address: null, supplierSubOrders: parts, ...over });

describe("where a part is (the mobile app's stage rules)", () => {
  it("CRITICAL: 'dispute' is never shown to a buyer, and pending and preparing are as they are", () => {
    expect(buyerFacingStatus("dispute")).toBe("preparing");
    expect(buyerFacingStatus("delivered")).toBe("delivered");
    expect(subOrderStage(part("dispute"))).toBe("preparing");
    expect(subOrderStage(part("pending"))).toBe("pending");
    expect(subOrderStage(part("preparing", "delivered"))).toBe("preparing");                       // not yet shipped by the supplier: the hub cannot change that
  });
  it("CRITICAL: before the hub has the part, 'shipped' only means it went to OUR hub, so the buyer still sees 'preparing'", () => {
    expect(subOrderStage(part("shipped", null))).toBe("preparing");
    expect(subOrderStage(part("delivered", null))).toBe("delivered");                              // an older order from before the hub existed
    expect(subOrderStage(part("cancelled", null))).toBe("cancelled");
  });
  it("once the hub has it: sent to the buyer is shipped, received is delivered, anything else is still preparing", () => {
    expect(subOrderStage(part("shipped", "shipped_to_buyer"))).toBe("shipped");
    expect(subOrderStage(part("shipped", "delivered"))).toBe("delivered");
    for (const inHub of ["received", "inspected", "packed"]) expect(subOrderStage(part("shipped", inHub))).toBe("preparing");
    expect(STAGES).toEqual(["pending", "preparing", "shipped", "delivered"]);
  });
});

describe("what can be cancelled", () => {
  it("CRITICAL: a part can be cancelled until it has left for the buyer, and never when it went back to the supplier or was discarded", () => {
    expect(isSubOrderCancellable(part("preparing"))).toBe(true);
    expect(isSubOrderCancellable(part("shipped", "received"))).toBe(true);
    expect(isSubOrderCancellable(part("shipped", "shipped_to_buyer"))).toBe(false);
    expect(isSubOrderCancellable(part("shipped", "delivered"))).toBe(false);
    expect(isSubOrderCancellable(part("shipped", "returned_to_supplier"))).toBe(false);
    expect(isSubOrderCancellable(part("shipped", "discarded_at_hub"))).toBe(false);
    expect(isSubOrderCancellable(part("cancelled"))).toBe(false);
  });
  it("CRITICAL: the whole order can be cancelled only while EVERY part can; when only some can, each of those gets its own 'cancel this part'", () => {
    const open = part("preparing"), gone = part("shipped", "shipped_to_buyer");
    expect(isOrderCancellable(order([open, open]))).toBe(true);
    expect(isOrderCancellable(order([open, gone]))).toBe(false);
    expect(isOrderCancellable(order([open], { status: "cancelled" }))).toBe(false);
    expect(isPartiallyCancellable(order([open, gone]))).toBe(true);
    expect(isPartiallyCancellable(order([open, open]))).toBe(false);                               // all can: the whole order is cancelled instead
    expect(isPartiallyCancellable(order([gone, gone]))).toBe(false);                               // none can
    expect(isPartiallyCancellable(order([open, gone], { status: "cancelled" }))).toBe(false);
  });
});

describe("the other rules of the order page", () => {
  it("the English address is checked only while it is a machine's guess ('auto') and there is an address", () => {
    const en = (source: string) => ({ recipientName: "A", country: "Oman", city: "C", streetAddress: "S", state: null, source, confirmed: source === "buyer", updatedAt: null });
    const addr = { recipientName: "A", phone: "1", country: "Oman", city: "C", streetAddress: "S", postalCode: null, source: "buyer" };
    expect(needsEnglishAddressCheck({ address: addr, addressEnglish: en("auto") })).toBe(true);
    for (const done of ["same", "buyer", "admin"]) expect(needsEnglishAddressCheck({ address: addr, addressEnglish: en(done) }), done).toBe(false);
    expect(needsEnglishAddressCheck({ address: null, addressEnglish: en("auto") })).toBe(false);
    expect(needsEnglishAddressCheck({ address: addr, addressEnglish: null })).toBe(false);
  });
  it("the tracking page is offered until every part is delivered (and there is something to track)", () => {
    expect(showTrackingLink(order([part("shipped", "shipped_to_buyer"), part("shipped", "delivered")]))).toBe(true);
    expect(showTrackingLink(order([part("shipped", "delivered")]))).toBe(false);
    expect(showTrackingLink(order([]))).toBe(false);
  });
  it("Arabic letters are found (English-only fields refuse them), and the active shipments are counted", () => {
    expect(hasArabicLetters("12 Al Noor St")).toBe(false);
    expect(hasArabicLetters("شارع النور")).toBe(true);
    expect(hasArabicLetters("Street شارع")).toBe(true);
    const o = (displayStatus: string, status = "x") => ({ displayStatus, status });
    expect(activeShipmentCount([o("shipped"), o("to_ship"), o("processing"), o("delivered"), o("cancelled"), o("", "shipped")])).toBe(4);
    expect(activeShipmentCount([])).toBe(0);
  });
});

describe("status words and dates", () => {
  it("CRITICAL: the status is in the page's language (the app's own words); one the app has no word for is plain words, never blank; dispute reads as preparing", () => {
    expect(statusLabel("en", "to_ship")).toBe("To ship");
    expect(statusLabel("ar", "to_ship")).toBe("قيد الشحن");
    expect(statusLabel("ar", "delivered")).toBe("تم التسليم");
    expect(statusLabel("en", "dispute")).toBe("Preparing");
    expect(statusLabel("en", "in_review")).toBe("In Review");
    expect(statusLabel("ar", "in_review")).toBe("In Review");
  });
  it("dates use Western digits in both languages, and a broken date is blank", () => {
    expect(formatDate("en", "2026-10-01T10:00:00Z")).toMatch(/Oct 1, 2026/);
    expect(formatDate("ar", "2026-10-01T10:00:00Z")).toMatch(/2026/);
    expect(formatDate("ar", "2026-10-01T10:00:00Z")).not.toMatch(/[٠-٩]/);
    expect(formatDate("en", "not a date")).toBe("");
  });
});

describe("reorder", () => {
  const two = order([part("delivered", null, { items: [{ productId: "a", name: "Disc", quantity: 2, unitPrice: 1 }] }), part("delivered", null, { items: [{ productId: "b", name: "Filter", quantity: 1, unitPrice: 1 }] })]);
  it("takes every item of every part as it was ordered", () => {
    expect(reorderLines(two)).toEqual([{ productId: "a", quantity: 2, name: "Disc" }, { productId: "b", quantity: 1, name: "Filter" }]);
  });
  it("CRITICAL: a line that cannot be added is named and does not stop the others", async () => {
    const add = vi.fn(async (id: string) => { if (id === "a") throw new Error("out of stock"); });
    expect(await reorder(reorderLines(two), add)).toEqual({ added: 1, failed: ["Disc"] });
    expect(add).toHaveBeenCalledTimes(2);
    expect(await reorder([], add)).toEqual({ added: 0, failed: [] });
    expect(await reorder(reorderLines(two), async () => { throw new Error("x"); })).toEqual({ added: 0, failed: ["Disc", "Filter"] });
  });
});

describe("an order that is over for good", () => {
  const part = (status: string) => ({ status, hubShipment: null });
  it("isOrderFullyCancelled: cancelled, or every part cancelled; not when one part is still going; not for an order with no parts", async () => {
    const { isOrderFullyCancelled } = await import("./orders");
    expect(isOrderFullyCancelled({ status: "cancelled" })).toBe(true); expect(isOrderFullyCancelled({ supplierSubOrders: [{ status: "cancelled" }] })).toBe(true);      // no status given: the parts decide expect(isOrderFullyCancelled({ status: "to_ship", supplierSubOrders: [{ status: "cancelled" }, { status: "cancelled" }] })).toBe(true);
    expect(isOrderFullyCancelled({ status: "to_ship", supplierSubOrders: [{ status: "cancelled" }, { status: "preparing" }] })).toBe(false); expect(isOrderFullyCancelled({ status: "to_ship", supplierSubOrders: [] })).toBe(false); expect(isOrderFullyCancelled({})).toBe(false);
  });
  it("showTrackingLink: never for an order that is over; a cancelled part is not 'still to deliver'", async () => {
    const { showTrackingLink } = await import("./orders");
    expect(showTrackingLink({ status: "cancelled", supplierSubOrders: [part("cancelled")] } as never)).toBe(false); expect(showTrackingLink({ status: "cancelled", supplierSubOrders: [part("preparing")] } as never)).toBe(false); expect(showTrackingLink({ status: "to_ship", supplierSubOrders: [part("cancelled"), part("cancelled")] } as never)).toBe(false);
    expect(showTrackingLink({ status: "to_ship", supplierSubOrders: [part("cancelled"), part("preparing")] } as never)).toBe(true); expect(showTrackingLink({ status: "to_ship", supplierSubOrders: [] } as never)).toBe(false);
    expect(showTrackingLink({ status: "to_ship", supplierSubOrders: [part("cancelled"), { status: "shipped", hubShipment: { status: "delivered" } }] } as never)).toBe(false);
  });
  it("needsEnglishAddressCheck: not for an order that is over, still for one that is going", async () => {
    const { needsEnglishAddressCheck } = await import("./orders"); const base = { address: { country: "Oman" }, addressEnglish: { source: "auto" } } as never;
    expect(needsEnglishAddressCheck({ ...(base as object), status: "cancelled" } as never)).toBe(false); expect(needsEnglishAddressCheck({ ...(base as object), status: "to_ship", supplierSubOrders: [{ status: "cancelled" }] } as never)).toBe(false);
    expect(needsEnglishAddressCheck({ ...(base as object), status: "to_ship", supplierSubOrders: [{ status: "preparing" }] } as never)).toBe(true); expect(needsEnglishAddressCheck(base)).toBe(true);
  });
});
