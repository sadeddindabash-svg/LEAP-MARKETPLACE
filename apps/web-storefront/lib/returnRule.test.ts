import { describe, it, expect } from "vitest";
import { isPartReturnable } from "./orders";

// When does the website offer "Request a return"? The server decides (returnable); the website adds the cancelled rule, and an older server that says nothing is treated as "returnable".
const part = (status: string, returnable?: boolean) => ({ status, returnable });
describe("isPartReturnable", () => {
  it("CRITICAL: cancelled order or cancelled part: never", () => {
    expect(isPartReturnable({ status: "cancelled" }, part("preparing", true))).toBe(false); expect(isPartReturnable({ status: "to_ship" }, part("cancelled", true))).toBe(false); expect(isPartReturnable({ status: "to_ship", supplierSubOrders: [{ status: "cancelled" }] }, part("cancelled"))).toBe(false);
    expect(isPartReturnable({ status: "to_ship", supplierSubOrders: [{ status: "cancelled" }, { status: "cancelled" }] }, part("preparing", true))).toBe(false);
  });
  it("CRITICAL: the server's answer decides for a part that is going: true shows, false (the window has passed) hides", () => { expect(isPartReturnable({ status: "to_ship" }, part("shipped", true))).toBe(true); expect(isPartReturnable({ status: "to_ship" }, part("shipped", false))).toBe(false); });
  it("no answer (an older server) means returnable, unless cancelled", () => { expect(isPartReturnable({ status: "to_ship" }, part("preparing"))).toBe(true); expect(isPartReturnable({ status: "to_ship" }, part("cancelled"))).toBe(false); });
  it("a part still going in a partly cancelled order is returnable", () => { expect(isPartReturnable({ status: "to_ship", supplierSubOrders: [{ status: "cancelled" }, { status: "preparing" }] }, part("preparing", true))).toBe(true); });
});
