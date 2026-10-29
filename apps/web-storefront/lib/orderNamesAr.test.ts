import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchOrderById } from "./api";

// What the website asks the shop's API when it opens an order: ?lang=ar only in Arabic, together with the guest's email when there is one.
afterEach(() => { vi.unstubAllGlobals(); });
async function urlOf(call: () => Promise<unknown>) {
  const urls: string[] = []; vi.stubGlobal("fetch", vi.fn(async (url: string) => { urls.push(String(url)); return new Response(JSON.stringify({ id: "o1", supplierSubOrders: [] }), { status: 200, headers: { "Content-Type": "application/json" } }); }));
  await call(); return urls[0] ?? "";
}
describe("fetchOrderById and the language", () => {
  it("CRITICAL: in Arabic the request carries lang=ar", async () => { expect(await urlOf(() => fetchOrderById("tok", "ord_1", null, "ar"))).toMatch(/\/order\/ord_1\?lang=ar$/); });
  it("in English, or with no language (every older caller), nothing is added", async () => {
    expect(await urlOf(() => fetchOrderById("tok", "ord_1", null, "en"))).toMatch(/\/order\/ord_1$/); expect(await urlOf(() => fetchOrderById("tok", "ord_1"))).toMatch(/\/order\/ord_1$/); expect(await urlOf(() => fetchOrderById("tok", "ord_1", null, undefined))).not.toContain("lang");
  });
  it("a guest in Arabic sends both the email and the language; the order id is encoded", async () => {
    const url = await urlOf(() => fetchOrderById(null, "LP 1/2", "sam@example.com", "ar")); expect(url).toContain("/order/LP%201%2F2?"); expect(url).toContain("guestEmail=sam%40example.com"); expect(url).toContain("lang=ar");
  });
});
