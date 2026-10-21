// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// The door for the next batch of a list, for the "same model" list (and the batch size now passed on to the same-brand list too).
const m = vi.hoisted(() => ({ paginated: vi.fn(), sameBrand: vi.fn(), sameModel: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchProductsPaginated: (...a: unknown[]) => m.paginated(...a), fetchSameBrand: (...a: unknown[]) => m.sameBrand(...a), fetchSameModel: (...a: unknown[]) => m.sameModel(...a) }));
import { GET } from "./route";
import { NetworkError } from "@/lib/net";

let counter = 0;
const ask = (query: string) => GET(new NextRequest(`http://localhost:3001/api/products?${query}`, { headers: { "x-forwarded-for": `10.1.0.${++counter}` } }));
beforeEach(() => { m.paginated.mockReset(); m.sameBrand.mockReset(); m.sameModel.mockReset(); m.sameModel.mockResolvedValue([{ id: "m1" }]); m.sameBrand.mockResolvedValue([{ id: "b1" }]); });

describe("the 'same model' list through the door", () => {
  it("asks the shop for that product's model, for that page and that batch size, in that language, and answers the items (it has no total)", async () => {
    const res = await ask("kind=sameModel&productId=p_9&page=2&limit=8&lang=ar");
    expect(res.status).toBe(200); expect(await res.json()).toEqual({ items: [{ id: "m1" }], total: null });
    expect(m.sameModel).toHaveBeenCalledWith("p_9", "ar", 2, 8); expect(m.sameBrand).not.toHaveBeenCalled(); expect(m.paginated).not.toHaveBeenCalled();
  });
  it("the same-brand list is told the batch size too, and never the model list", async () => {
    await ask("kind=sameBrand&productId=p_9&page=3&limit=8");
    expect(m.sameBrand).toHaveBeenCalledWith("p_9", "en", 3, 8); expect(m.sameModel).not.toHaveBeenCalled();
  });
  it("a missing or odd product id is refused and nothing is asked of the shop", async () => {
    for (const bad of ["kind=sameModel", "kind=sameModel&productId=a%20b", "kind=sameModel&productId=../secret", "kind=sameModel&productId=p_1&page=0", "kind=sameModel&productId=p_1&limit=500"]) { expect((await ask(bad)).status, bad).toBe(400); }
    expect(m.sameModel).not.toHaveBeenCalled();
  });
  it("the message for an unknown list names all four kinds", async () => {
    const res = await ask("kind=admin"); expect(res.status).toBe(400); expect((await res.json()).error).toBe("kind must be search, sameBrand, sameModel or newest");
  });
  it("when the shop cannot be reached the answer is 503, not a crash", async () => {
    m.sameModel.mockRejectedValue(new NetworkError()); expect((await ask("kind=sameModel&productId=p_1")).status).toBe(503);
  });
});
