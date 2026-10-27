import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import type { Cart } from "@/lib/api";

// The REAL cart provider with the server replaced by fixed answers: the summary it gives the pages includes the shipping fee the server sent, and follows it when the cart changes.
const m = vi.hoisted(() => ({ fetchCart: vi.fn(), addCartItem: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchCart: (...a: unknown[]) => m.fetchCart(...a), addCartItem: (...a: unknown[]) => m.addCartItem(...a), applyCartPromoCode: vi.fn(), lockCartPrices: vi.fn(), removeCartItem: vi.fn(), setCartItemQuantity: vi.fn() }));
vi.mock("./AuthProvider", () => ({ useAuth: () => ({ user: null, isLoading: false }), getAuthToken: () => null }));
import { CartProvider, useCart } from "./CartProvider";
import { LangProvider } from "./LangProvider";

const item = (price: number, quantity = 1) => ({ productId: `p${price}`, quantity, name: "x", price, currencyCode: "USD", supplierName: "s", stockQuantity: 99, imageUrl: null });
const cartOf = (items: ReturnType<typeof item>[], shipping?: Cart["shipping"], over: Partial<Cart> = {}): Cart => ({ cartId: "c", items, appliedPromoCode: null, appliedDiscountUsd: 0, appliedDiscountSource: "none", loyaltyDiscountPercentage: 0, shipping, ...over } as Cart);
const ship = (over = {}) => ({ enabled: true, thresholdUsd: 50, feeUsd: 5, chargedUsd: 5, remainingUsd: 30, qualifies: false, waivedByPromo: false, ...over });
function Probe() { const { summary, cart, addItem } = useCart(); return <div><span data-testid="total">{summary.total}</span><span data-testid="fee">{summary.shippingFee}</span><span data-testid="goods">{summary.goods}</span><span data-testid="shipping">{cart?.shipping ? "yes" : "no"}</span><button onClick={() => addItem("p1", 1)}>add</button></div>; }
const show = () => render(<LangProvider lang="en"><CartProvider><Probe /></CartProvider></LangProvider>);
beforeEach(() => { vi.clearAllMocks(); document.cookie = "leap_cart_id=c; path=/"; });

describe("the cart provider's summary", () => {
  it("includes the shipping fee the server sent: goods 20 + fee 5 = a total of 25", async () => {
    m.fetchCart.mockResolvedValue(cartOf([item(20)], ship())); show(); await waitFor(() => expect(screen.getByTestId("shipping")).toHaveTextContent("yes"));
    expect(screen.getByTestId("goods")).toHaveTextContent("20"); expect(screen.getByTestId("fee")).toHaveTextContent("5"); expect(screen.getByTestId("total")).toHaveTextContent("25");
  });
  it("no fee when the server says free (at the limit): the total is just the goods", async () => {
    m.fetchCart.mockResolvedValue(cartOf([item(60)], ship({ chargedUsd: 0, remainingUsd: 0, qualifies: true }))); show(); await waitFor(() => expect(screen.getByTestId("shipping")).toHaveTextContent("yes")); expect(screen.getByTestId("fee")).toHaveTextContent("0"); expect(screen.getByTestId("total")).toHaveTextContent("60");
  });
  it("with a server that sends no shipping answer (rule off, or an older server) the total is as it always was", async () => {
    m.fetchCart.mockResolvedValue(cartOf([item(20)], undefined)); show(); await waitFor(() => expect(screen.getByTestId("goods")).toHaveTextContent("20")); expect(screen.getByTestId("shipping")).toHaveTextContent("no"); expect(screen.getByTestId("fee")).toHaveTextContent("0"); expect(screen.getByTestId("total")).toHaveTextContent("20");
  });
  it("follows the cart as it changes: adding a part that reaches the limit removes the fee from the total", async () => {
    m.fetchCart.mockResolvedValue(cartOf([item(20)], ship())); show(); await waitFor(() => expect(screen.getByTestId("total")).toHaveTextContent("25"));
    m.addCartItem.mockResolvedValue(cartOf([item(20), item(40)], ship({ chargedUsd: 0, remainingUsd: 0, qualifies: true }))); await act(async () => { screen.getByText("add").click(); });
    await waitFor(() => expect(screen.getByTestId("total")).toHaveTextContent("60")); expect(screen.getByTestId("fee")).toHaveTextContent("0");
  });
  it("a discount comes off the goods first, then the fee is added (60 less 12, plus 5 = 53)", async () => {
    m.fetchCart.mockResolvedValue(cartOf([item(60)], ship(), { appliedDiscountUsd: 12, appliedDiscountSource: "promo" })); show(); await waitFor(() => expect(screen.getByTestId("shipping")).toHaveTextContent("yes")); expect(screen.getByTestId("goods")).toHaveTextContent("48"); expect(screen.getByTestId("total")).toHaveTextContent("53");
  });
});
