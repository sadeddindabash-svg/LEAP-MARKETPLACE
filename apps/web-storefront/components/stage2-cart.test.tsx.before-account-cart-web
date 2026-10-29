import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Cart, CartItem } from "@/lib/api";

// The cart provider (who it speaks as, in which language, what it keeps in step) and the cart page, with the server and the sign-in state replaced by fixed values.
const m = vi.hoisted(() => ({ user: { current: null as { id: string } | null }, token: { current: null as string | null }, cartNow: { current: null as unknown } }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: m.user.current, isLoading: false }), getAuthToken: () => m.token.current }));
vi.mock("./AuthProvider", () => ({ useAuth: () => ({ user: m.user.current, isLoading: false }), getAuthToken: () => m.token.current }));

import { CartProvider, useCart } from "./CartProvider";
import { LangProvider } from "./LangProvider";
import { setErrorLanguage } from "@/lib/serverMessages";

const line = (over: Partial<CartItem> = {}): CartItem => ({ productId: "p1", quantity: 2, name: "Front Brake Disc", price: 40, currencyCode: "USD", supplierName: "Supplier LEAP-SLR-AB12", stockQuantity: 20, imageUrl: null, ...over });
const cartOf = (items: CartItem[], over: Partial<Cart> = {}): Cart => ({ cartId: "c", items, appliedPromoCode: null, appliedDiscountUsd: 0, appliedDiscountSource: "none", loyaltyDiscountPercentage: 0, lockActive: false, lockExpiresAt: null, ...over });

type Call = { url: string; method: string; auth: string | null };
let calls: Call[] = [];
let reply: () => { ok: boolean; status?: number; body: unknown };
function installFetch() {
  calls = [];
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? "GET", auth: ((init?.headers ?? {}) as Record<string, string>).Authorization ?? null });
    const r = reply();
    return { ok: r.ok, status: r.status ?? (r.ok ? 200 : 400), json: async () => r.body } as Response;
  }) as unknown as typeof fetch;
}
const cookieId = () => /leap_cart_id=([^;]*)/.exec(document.cookie)?.[1];

function Probe() {
  const c = useCart();
  return (
    <div>
      <p data-testid="s">{JSON.stringify({ n: c.itemCount, total: c.total, discount: c.summary.discount, source: c.summary.source, lock: c.cart?.lockActive ?? null })}</p>
      <p data-testid="err">{c.error ?? ""}</p>
      <button onClick={() => c.addItem("p9", 1).catch(() => {})}>add</button>
      <button onClick={() => c.updateQuantity("p1", 5)}>qty</button>
      <button onClick={() => c.removeItem("p1")}>remove</button>
      <button onClick={() => c.lockPrices()}>lock</button>
      <button onClick={() => c.applyPromo("SAVE10").catch((e) => { document.title = e.message; })}>promo</button>
      <button onClick={() => c.applyPromo(null)}>unpromo</button>
      <button onClick={() => c.clearAfterOrder()}>clear</button>
    </div>
  );
}
const state = () => JSON.parse(screen.getByTestId("s").textContent || "{}");
const mount = (lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}><CartProvider><Probe /></CartProvider></LangProvider>);

beforeEach(() => {
  document.cookie = "leap_cart_id=; path=/; max-age=0";
  m.user.current = null; m.token.current = null; document.title = "";
  reply = () => ({ ok: true, body: cartOf([line()]) });
  installFetch();
});
afterEach(() => { setErrorLanguage("en"); vi.restoreAllMocks(); });

describe("the cart provider", () => {
  it("CRITICAL: a visitor who is not signed in asks for the cart with no token and in English", async () => {
    mount();
    await waitFor(() => expect(state().n).toBe(2));
    expect(calls[0].url).toMatch(/\/cart\/[0-9a-f-]{36}$/);
    expect(calls[0].auth).toBeNull();
    expect(state()).toMatchObject({ total: 80, discount: 0, source: "none" });
  });

  it("CRITICAL: a signed-in buyer's token goes on EVERY cart call, so the server can apply their own loyalty discount and attach the cart to them", async () => {
    m.user.current = { id: "u1" }; m.token.current = "tok-1";
    mount();
    await waitFor(() => expect(state().n).toBe(2));
    for (const name of ["add", "qty", "remove", "lock", "promo", "unpromo"]) await act(async () => { fireEvent.click(screen.getByText(name)); });
    expect(calls.length).toBe(7);
    expect(calls.every((c) => c.auth === "Bearer tok-1")).toBe(true);
    expect(calls.map((c) => `${c.method} ${c.url.replace(/.*\/cart\/[^/]+/, "")}`)).toEqual(["GET ", "POST /items", "PATCH /items/p1", "DELETE /items/p1", "POST /lock-prices", "PATCH /promo-code", "PATCH /promo-code"]);
  });

  it("the server's discount is shown as it sent it: the one discount it applied, and what is left to pay", async () => {
    reply = () => ({ ok: true, body: cartOf([line()], { appliedDiscountUsd: 12, appliedDiscountSource: "loyalty", loyaltyDiscountPercentage: 15, lockActive: true }) });
    mount();
    await waitFor(() => expect(state().discount).toBe(12));
    expect(state()).toMatchObject({ source: "loyalty", total: 80, lock: true });
  });

  it("CRITICAL: in Arabic every cart call asks for Arabic names (and the language is added correctly to addresses that already have a query)", async () => {
    mount("ar");
    await waitFor(() => expect(state().n).toBe(2));
    await act(async () => { fireEvent.click(screen.getByText("add")); });
    await act(async () => { fireEvent.click(screen.getByText("promo")); });
    expect(calls.map((c) => c.url.replace(/.*\/cart\/[^/?]+/, ""))).toEqual(["?lang=ar", "/items?lang=ar", "/promo-code?lang=ar"]);
  });

  it("CRITICAL: the cart is loaded again when a different buyer signs in, so their discount appears without a reload", async () => {
    const { rerender } = mount();
    await waitFor(() => expect(calls.length).toBe(1));
    m.user.current = { id: "u1" }; m.token.current = "tok-1";
    rerender(<LangProvider lang="en"><CartProvider><Probe /></CartProvider></LangProvider>);
    await waitFor(() => expect(calls.length).toBe(2));
    expect(calls[1].auth).toBe("Bearer tok-1");
  });

  it("a promo code the server refuses throws the server's reason (in Arabic when the page is Arabic) and leaves the cart as it was", async () => {
    mount();
    await waitFor(() => expect(state().n).toBe(2));
    reply = () => ({ ok: false, status: 400, body: { error: "Promo code not found" } });
    await act(async () => { fireEvent.click(screen.getByText("promo")); });
    expect(document.title).toBe("Promo code not found");
    expect(state().n).toBe(2);
  });

  it("CRITICAL: after an order the cart is a brand new empty one at once (the count drops without a reload) and the next calls use the new id", async () => {
    mount();
    await waitFor(() => expect(state().n).toBe(2));
    const before = cookieId();
    reply = () => ({ ok: true, body: cartOf([]) });
    await act(async () => { fireEvent.click(screen.getByText("clear")); });
    expect(state().n).toBe(0);
    expect(cookieId()).toBeTruthy();
    expect(cookieId()).not.toBe(before);
    await waitFor(() => expect(calls.at(-1)?.url).toContain(cookieId() as string));
  });

  it("a price lock that cannot be taken never stops the checkout", async () => {
    mount();
    await waitFor(() => expect(state().n).toBe(2));
    globalThis.fetch = vi.fn(async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    await act(async () => { fireEvent.click(screen.getByText("lock")); });
    expect(state().n).toBe(2);
  });
});
