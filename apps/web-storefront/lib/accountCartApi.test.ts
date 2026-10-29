import { describe, it, expect, vi, afterEach } from "vitest";
import { clearCart, fetchCart } from "./api";

// What the website sends and reads for the ONE account cart: emptying the cart after an order, and the "carts combined" answer.
afterEach(() => { vi.unstubAllGlobals(); });
async function calls(answer: unknown, run: () => Promise<unknown>) {
  const seen: { url: string; method: string; auth: string | null }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => { seen.push({ url: String(url), method: init?.method ?? "GET", auth: ((init?.headers ?? {}) as Record<string, string>).Authorization ?? null }); return new Response(JSON.stringify(answer), { status: 200, headers: { "Content-Type": "application/json" } }); }));
  const result = await run(); return { seen, result };
}
describe("emptying the cart after an order", () => {
  it("CRITICAL: a POST to /cart/<id>/clear as the signed-in buyer", async () => {
    const { seen } = await calls({ cartId: "ACC", items: [] }, () => clearCart("ACC", { token: "tok" })); expect(seen).toHaveLength(1); expect(seen[0].method).toBe("POST"); expect(seen[0].url).toMatch(/\/cart\/ACC\/clear(\?|$)/); expect(seen[0].auth).toBe("Bearer tok");
  });
  it("the answer is the empty cart", async () => { const { result } = await calls({ cartId: "ACC", items: [] }, () => clearCart("ACC")); expect(result).toEqual({ cartId: "ACC", items: [] }); });
});
describe("the answer that combined the carts", () => {
  it("CRITICAL: the cart read keeps the account cart's id and the merge summary exactly as the server sent them", async () => {
    const merge = { itemsAdded: 1, itemsCombined: 1, reduced: [{ productId: "p2", name: "Oil Filter", from: 3, to: 2 }], dropped: [] };
    const { result } = await calls({ cartId: "ACCOUNT", items: [], merge }, () => fetchCart("device-cart", { token: "tok" })); expect((result as { cartId: string }).cartId).toBe("ACCOUNT"); expect((result as { merge: unknown }).merge).toEqual(merge);
  });
});
