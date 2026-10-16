// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ paginated: vi.fn(), sameBrand: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchProductsPaginated: (...a: unknown[]) => m.paginated(...a), fetchSameBrand: (...a: unknown[]) => m.sameBrand(...a) }));
import { GET } from "./route";
import { NetworkError } from "@/lib/net";

let counter = 0;
const ask = (query: string, visitor = `10.0.0.${++counter}`) => GET(new NextRequest(`http://localhost:3001/api/products?${query}`, { headers: { "x-forwarded-for": visitor } }));
beforeEach(() => { m.paginated.mockReset(); m.sameBrand.mockReset(); m.paginated.mockResolvedValue({ items: [{ id: "p1" }], total: 100 }); m.sameBrand.mockResolvedValue([{ id: "p2" }]); });

describe("the door for the next page of a list", () => {
  it("CRITICAL: a search page is fetched as a CONTINUATION (more) with exactly the filters asked for, and answers items and total", async () => {
    const res = await ask("kind=search&q=disc&category=brake&generationId=g1&year=2018&page=3&limit=24&lang=ar");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [{ id: "p1" }], total: 100 });
    expect(m.paginated).toHaveBeenCalledWith({ search: "disc", category: "brake", part: undefined, generationId: "g1", year: 2018, page: 3, limit: 24, lang: "ar", more: true });
  });
  it("the newest list asks for the newest, and the same-brand list for that product's brand (it has no total)", async () => {
    await ask("kind=newest&page=2&limit=10");
    expect(m.paginated).toHaveBeenCalledWith({ sort: "newest", page: 2, limit: 10, lang: "en", more: true });
    const res = await ask("kind=sameBrand&productId=p_9&page=2");
    expect(m.sameBrand).toHaveBeenCalledWith("p_9", "en", 2);
    expect(await res.json()).toEqual({ items: [{ id: "p2" }], total: null });
  });
  it("CRITICAL: a question that is not valid is refused (400) and NEVER reaches the shop's API", async () => {
    for (const bad of ["page=0", "limit=500", "kind=admin", "category=../x", "kind=sameBrand"]) {
      const res = await ask(bad);
      expect(res.status, bad).toBe(400);
      expect((await res.json()).error).toBeTruthy();
    }
    expect(m.paginated).not.toHaveBeenCalled();
    expect(m.sameBrand).not.toHaveBeenCalled();
  });
  it("CRITICAL: one visitor can ask 120 times a minute, the 121st is refused with how long to wait; another visitor is not affected", async () => {
    const greedy = "203.0.113.7";
    for (let i = 0; i < 120; i++) expect((await ask("kind=newest", greedy)).status).toBe(200);
    const refused = await ask("kind=newest", greedy);
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await ask("kind=newest", "203.0.113.8")).status).toBe(200);
  });
  it("when the shop cannot be reached it says so (503), whichever list was asked for", async () => {
    m.paginated.mockResolvedValue({ items: [], total: 0, unreachable: true });
    expect((await ask("kind=search")).status).toBe(503);
    m.sameBrand.mockRejectedValue(new NetworkError());
    const res = await ask("kind=sameBrand&productId=p_1");
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/reach the server/);
  });
  it("the buyer's own browser may keep an answer for 30 seconds, a shared cache may not", async () => {
    const res = await ask("kind=newest");
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=30");
  });
});
