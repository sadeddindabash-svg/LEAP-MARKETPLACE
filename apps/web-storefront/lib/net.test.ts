import { describe, it, expect, afterEach, vi } from "vitest";
import { NetworkError, isShopReachable, netFetch } from "./net";
import { fetchProductsPaginated } from "./api";
import { networkMessage, setErrorLanguage } from "./serverMessages";

afterEach(() => { setErrorLanguage("en"); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const offline = () => vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));

describe("when the server cannot be reached", () => {
  it("CRITICAL: a refused connection becomes a readable message (never the browser's 'Failed to fetch'), in the page's language", async () => {
    offline();
    await expect(netFetch("http://localhost:4000/x")).rejects.toThrow("We can't reach the server. Please check your connection and try again.");
    setErrorLanguage("ar");
    await expect(netFetch("http://localhost:4000/x")).rejects.toThrow(networkMessage());
    expect(networkMessage()).toMatch(/[\u0600-\u06FF]/);
  });
  it("CRITICAL: it is still a TypeError, so the checkout can tell 'no answer at all' (keep the duplicate-order key) from 'the server refused' (new key)", async () => {
    offline();
    const error = await netFetch("http://localhost:4000/x").catch((e) => e);
    expect(error).toBeInstanceOf(NetworkError);
    expect(error).toBeInstanceOf(TypeError);
  });
  it("an answer from the server, even an error, is passed on untouched; an aborted request is not disguised", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "nope" }), { status: 500 })));
    const res = await netFetch("http://localhost:4000/x");
    expect(res.status).toBe(500);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("aborted", "AbortError"); }));
    await expect(netFetch("http://localhost:4000/x")).rejects.toMatchObject({ name: "AbortError" });
  });
  it("the shop is reachable only when its health answer is OK", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    expect(await isShopReachable("http://localhost:4000")).toBe(true);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    expect(await isShopReachable("http://localhost:4000")).toBe(false);
    offline();
    expect(await isShopReachable("http://localhost:4000")).toBe(false);
  });
  it("CRITICAL: the product list says so when the shop is unreachable (an empty list would wrongly say no part matches); a normal empty answer does not", async () => {
    offline();
    expect(await fetchProductsPaginated({ search: "disc" })).toEqual({ items: [], total: 0, unreachable: true });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    expect(await fetchProductsPaginated({ search: "disc" })).toEqual({ items: [], total: 0 });
  });
});
