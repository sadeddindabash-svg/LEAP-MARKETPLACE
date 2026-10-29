import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import type { Cart } from "@/lib/api";

// ONE CART PER ACCOUNT, in the REAL cart provider with the server and the sign-in state replaced by fixed values: it uses the cart id the server answers with, keeps the "carts combined" notice, gives a signed-out device a fresh empty cart, and EMPTIES the cart after an order.
const m = vi.hoisted(() => ({ user: { current: null as { id: string } | null }, token: { current: null as string | null }, fetchCart: vi.fn(), addCartItem: vi.fn(), clearCart: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchCart: (...a: unknown[]) => m.fetchCart(...a), addCartItem: (...a: unknown[]) => m.addCartItem(...a), clearCart: (...a: unknown[]) => m.clearCart(...a), applyCartPromoCode: vi.fn(), lockCartPrices: vi.fn(), removeCartItem: vi.fn(), setCartItemQuantity: vi.fn() }));
vi.mock("./AuthProvider", () => ({ useAuth: () => ({ user: m.user.current, isLoading: false }), getAuthToken: () => m.token.current }));
import { CartProvider, useCart } from "./CartProvider";
import { LangProvider } from "./LangProvider";

const item = (id = "p1", quantity = 1) => ({ productId: id, quantity, name: "x", price: 10, currencyCode: "USD", supplierName: "s", stockQuantity: 99, imageUrl: null });
const cartOf = (cartId: string, items = [item()], over: Partial<Cart> = {}): Cart => ({ cartId, items, appliedPromoCode: null, appliedDiscountUsd: 0, appliedDiscountSource: "none", loyaltyDiscountPercentage: 0, lockActive: false, lockExpiresAt: null, ...over });
const merge = { itemsAdded: 1, itemsCombined: 1, reduced: [], dropped: [] };
function Probe() {
  const c = useCart();
  return <div><span data-testid="n">{c.itemCount}</span><span data-testid="id">{c.cart?.cartId ?? ""}</span><span data-testid="notice">{c.mergeNotice ? `${c.mergeNotice.itemsAdded}+${c.mergeNotice.itemsCombined}` : "none"}</span><button onClick={() => c.dismissMergeNotice()}>dismiss</button><button onClick={() => c.addItem("p9", 1).catch(() => {})}>add</button><button onClick={() => c.clearAfterOrder()}>clear</button><button onClick={() => c.refreshCart()}>refresh</button></div>;
}
const tree = () => <LangProvider lang="en"><CartProvider><Probe /></CartProvider></LangProvider>;
const cookieId = () => /leap_cart_id=([^;]*)/.exec(document.cookie)?.[1];
beforeEach(() => { vi.clearAllMocks(); m.user.current = null; m.token.current = null; document.cookie = "leap_cart_id=device-cart; path=/"; m.fetchCart.mockImplementation(async (id: string) => cartOf(id)); });

describe("the cart id the server answers with", () => {
  it("CRITICAL: signing in joined this device's cart to the account cart: the device uses the account cart's id from then on (cookie, and every later call)", async () => {
    m.user.current = { id: "u1" }; m.token.current = "tok"; m.fetchCart.mockResolvedValue(cartOf("ACCOUNT", [item("p1", 2), item("p2")], { merge })); render(tree());
    await waitFor(() => expect(cookieId()).toBe("ACCOUNT")); expect(screen.getByTestId("n")).toHaveTextContent("3"); expect(screen.getByTestId("id")).toHaveTextContent("ACCOUNT");
    m.addCartItem.mockResolvedValue(cartOf("ACCOUNT", [item("p9")])); await act(async () => { screen.getByText("add").click(); }); expect(m.addCartItem.mock.calls[0][0]).toBe("ACCOUNT");
  });
  it("a normal answer (the same id) changes nothing: the cookie stays and no extra request is made", async () => { render(tree()); await waitFor(() => expect(screen.getByTestId("id")).toHaveTextContent("device-cart")); expect(cookieId()).toBe("device-cart"); expect(m.fetchCart).toHaveBeenCalledTimes(1); });
  it("an answer to adding an item that is another cart (the account cart) is adopted too", async () => { render(tree()); await waitFor(() => expect(screen.getByTestId("id")).toHaveTextContent("device-cart")); m.addCartItem.mockResolvedValue(cartOf("ACCOUNT")); await act(async () => { screen.getByText("add").click(); }); await waitFor(() => expect(cookieId()).toBe("ACCOUNT")); });
});
describe("the notice that carts were combined", () => {
  it("CRITICAL: kept from the answer that combined them, until it is dismissed; later answers without it do not bring it back or remove it", async () => {
    m.user.current = { id: "u1" }; m.token.current = "tok"; m.fetchCart.mockResolvedValueOnce(cartOf("ACCOUNT", [item()], { merge })); m.fetchCart.mockImplementation(async (id: string) => cartOf(id)); render(tree());
    await waitFor(() => expect(screen.getByTestId("notice")).toHaveTextContent("1+1")); await act(async () => { screen.getByText("refresh").click(); }); expect(screen.getByTestId("notice")).toHaveTextContent("1+1");
    await act(async () => { screen.getByText("dismiss").click(); }); expect(screen.getByTestId("notice")).toHaveTextContent("none"); await act(async () => { screen.getByText("refresh").click(); }); expect(screen.getByTestId("notice")).toHaveTextContent("none");
  });
  it("no notice at all when nothing was combined", async () => { render(tree()); await waitFor(() => expect(screen.getByTestId("id")).toHaveTextContent("device-cart")); expect(screen.getByTestId("notice")).toHaveTextContent("none"); });
});
describe("signing out", () => {
  it("CRITICAL: the device gets a FRESH EMPTY guest cart (a new id), the account's items and notice are gone from the screen", async () => {
    m.user.current = { id: "u1" }; m.token.current = "tok"; m.fetchCart.mockResolvedValue(cartOf("ACCOUNT", [item("p1", 2)], { merge })); const { rerender } = render(tree()); await waitFor(() => expect(cookieId()).toBe("ACCOUNT"));
    m.user.current = null; m.token.current = null; m.fetchCart.mockImplementation(async (id: string) => cartOf(id, [])); await act(async () => { rerender(tree()); });
    await waitFor(() => expect(cookieId()).not.toBe("ACCOUNT")); expect(cookieId()).toBeTruthy(); expect(screen.getByTestId("n")).toHaveTextContent("0"); expect(screen.getByTestId("notice")).toHaveTextContent("none"); expect(m.fetchCart.mock.calls.at(-1)?.[0]).not.toBe("ACCOUNT");
  });
  it("a page that simply loads with nobody signed in does NOT start a new cart, and signing IN does not either", async () => {
    const { rerender } = render(tree()); await waitFor(() => expect(screen.getByTestId("id")).toHaveTextContent("device-cart")); expect(cookieId()).toBe("device-cart");
    m.user.current = { id: "u1" }; m.token.current = "tok"; await act(async () => { rerender(tree()); }); await waitFor(() => expect(m.fetchCart.mock.calls.at(-1)?.[1]).toMatchObject({ token: "tok" })); expect(cookieId()).toBe("device-cart");
  });
});
describe("after an order", () => {
  it("CRITICAL: a signed-in buyer's cart is EMPTIED on the server (the same cart) and shown empty at once; the id does not change", async () => {
    m.user.current = { id: "u1" }; m.token.current = "tok"; m.fetchCart.mockResolvedValue(cartOf("ACCOUNT", [item("p1", 2)])); m.clearCart.mockResolvedValue(cartOf("ACCOUNT", [])); render(tree()); await waitFor(() => expect(screen.getByTestId("n")).toHaveTextContent("2"));
    await act(async () => { screen.getByText("clear").click(); }); expect(screen.getByTestId("n")).toHaveTextContent("0"); expect(m.clearCart).toHaveBeenCalledTimes(1); expect(m.clearCart.mock.calls[0][0]).toBe("ACCOUNT"); expect(m.clearCart.mock.calls[0][2] ?? m.clearCart.mock.calls[0][1]).toMatchObject({ token: "tok" }); expect(cookieId()).toBe("ACCOUNT");
  });
  it("a guest still gets a brand new empty cart (as before) and no server call to empty one", async () => { m.fetchCart.mockImplementation(async (id: string) => cartOf(id, id === "device-cart" ? [item()] : [])); render(tree()); await waitFor(() => expect(screen.getByTestId("n")).toHaveTextContent("1")); await act(async () => { screen.getByText("clear").click(); }); expect(screen.getByTestId("n")).toHaveTextContent("0"); expect(cookieId()).not.toBe("device-cart"); expect(m.clearCart).not.toHaveBeenCalled(); });
  it("if the server cannot be reached the cart on screen is still empty and nothing breaks", async () => { m.user.current = { id: "u1" }; m.token.current = "tok"; m.clearCart.mockRejectedValue(new Error("down")); render(tree()); await waitFor(() => expect(screen.getByTestId("n")).toHaveTextContent("1")); await act(async () => { screen.getByText("clear").click(); }); expect(screen.getByTestId("n")).toHaveTextContent("0"); });
});
