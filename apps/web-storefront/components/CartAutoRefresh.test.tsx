import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import type { Cart } from "@/lib/api";

// The signed-in buyer's cart is read again every 5 seconds (the phone and the website stay in step), quietly; a guest's cart is not (nothing else changes it). The REAL cart provider with the server replaced by fixed values.
const m = vi.hoisted(() => ({ user: { current: null as { id: string } | null }, token: { current: null as string | null }, fetchCart: vi.fn(), addCartItem: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchCart: (...a: unknown[]) => m.fetchCart(...a), addCartItem: (...a: unknown[]) => m.addCartItem(...a), clearCart: vi.fn(), applyCartPromoCode: vi.fn(), lockCartPrices: vi.fn(), removeCartItem: vi.fn(), setCartItemQuantity: vi.fn() }));
vi.mock("./AuthProvider", () => ({ useAuth: () => ({ user: m.user.current, isLoading: false }), getAuthToken: () => m.token.current }));
import { CartProvider, useCart } from "./CartProvider";
import { LangProvider } from "./LangProvider";

const item = (id: string, quantity = 1) => ({ productId: id, quantity, name: id, price: 10, currencyCode: "USD", supplierName: "s", stockQuantity: 99, imageUrl: null });
const cartOf = (items: ReturnType<typeof item>[], cartId = "ACC"): Cart => ({ cartId, items, appliedPromoCode: null, appliedDiscountUsd: 0, appliedDiscountSource: "none", loyaltyDiscountPercentage: 0, lockActive: false, lockExpiresAt: null });
function Probe() { const c = useCart(); return <div><span data-testid="n">{c.itemCount}</span><button onClick={() => c.addItem("p9", 1).catch(() => {})}>add</button></div>; }
const mount = () => render(<LangProvider lang="en"><CartProvider><Probe /></CartProvider></LangProvider>);
const tick = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); document.cookie = "leap_cart_id=ACC; path=/"; m.user.current = { id: "u1" }; m.token.current = "tok"; m.fetchCart.mockResolvedValue(cartOf([item("p1")])); });
afterEach(() => { vi.useRealTimers(); });

describe("the cart refreshes by itself", () => {
  it("CRITICAL: a signed-in buyer's cart is read again every 5 seconds, and what changed elsewhere (the phone) appears", async () => {
    mount(); await tick(0); expect(screen.getByTestId("n")).toHaveTextContent("1"); const calls = m.fetchCart.mock.calls.length;
    m.fetchCart.mockResolvedValue(cartOf([item("p1"), item("p2", 2)])); await tick(5000); expect(m.fetchCart.mock.calls.length).toBe(calls + 1); expect(screen.getByTestId("n")).toHaveTextContent("3");
    m.fetchCart.mockResolvedValue(cartOf([])); await tick(5000); expect(screen.getByTestId("n")).toHaveTextContent("0");
  });
  it("a guest's cart is NOT polled (nothing else can change it)", async () => { m.user.current = null; m.token.current = null; mount(); await tick(0); const calls = m.fetchCart.mock.calls.length; await tick(30000); expect(m.fetchCart.mock.calls.length).toBe(calls); });
  it("CRITICAL: an error keeps the cart on screen (no empty cart, no error)", async () => { mount(); await tick(0); m.fetchCart.mockRejectedValue(new Error("down")); await tick(5000); expect(screen.getByTestId("n")).toHaveTextContent("1"); });
  it("CRITICAL: a refresh that was overtaken by the buyer's own change is dropped, so it can never bring back an old cart", async () => {
    mount(); await tick(0); let answerOld: (c: Cart) => void = () => {}; m.fetchCart.mockImplementationOnce(() => new Promise<Cart>((resolve) => { answerOld = resolve; })); await tick(5000);
    m.addCartItem.mockResolvedValue(cartOf([item("p1"), item("p9")])); await act(async () => { screen.getByText("add").click(); }); expect(screen.getByTestId("n")).toHaveTextContent("2");
    await act(async () => { answerOld(cartOf([item("p1")])); await vi.advanceTimersByTimeAsync(0); }); expect(screen.getByTestId("n")).toHaveTextContent("2");
  });
  it("the combined-carts notice and the account cart's id still come through a refresh", async () => { mount(); await tick(0); m.fetchCart.mockResolvedValue(cartOf([item("p1"), item("p3")], "OTHER")); await tick(5000); await tick(0); expect(/leap_cart_id=([^;]*)/.exec(document.cookie)?.[1]).toBe("OTHER"); expect(screen.getByTestId("n")).toHaveTextContent("2"); });
});
