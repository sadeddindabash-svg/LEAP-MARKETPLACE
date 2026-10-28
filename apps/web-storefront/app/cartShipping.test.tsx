import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Cart, CartItem, PaymentMethod, SavedAddress } from "@/lib/api";
import { totals } from "@/lib/cart";

// Free shipping on the cart page and the checkout page: the fee line, the note with the progress bar, the icon over Checkout, and the total that includes the fee. The cart, the sign-in state, the server and the location lookup are replaced by fixed values.
const m = vi.hoisted(() => ({
  cart: { current: null as unknown },
  user: { current: null as { id: string; email: string } | null },
  push: vi.fn(),
  placeOrder: vi.fn(),
  createAddress: vi.fn(),
  fetchMyAddresses: vi.fn(),
  methods: vi.fn(),
  position: vi.fn(),
  reverse: vi.fn(),
}));
vi.mock("@/components/CartProvider", () => ({ useCart: () => m.cart.current }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: m.user.current, isLoading: false }), getAuthToken: () => (m.user.current ? "tok" : null) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push, replace: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/checkout" }));
vi.mock("@/lib/api", () => ({
  placeOrder: (...a: unknown[]) => m.placeOrder(...a),
  createAddress: (...a: unknown[]) => m.createAddress(...a),
  fetchMyAddresses: (...a: unknown[]) => m.fetchMyAddresses(...a),
  fetchPaymentMethodsForCountry: (...a: unknown[]) => m.methods(...a),
  resolveImageUrl: (u: string) => u,
}));
vi.mock("@/lib/nominatim", () => ({ currentPosition: (...a: unknown[]) => m.position(...a), reverseGeocode: (...a: unknown[]) => m.reverse(...a) }));

import CartPage from "./cart/page";
import CheckoutPage from "./checkout/page";
import { LangProvider } from "@/components/LangProvider";

const line = (over: Partial<CartItem> = {}): CartItem => ({ productId: "p1", quantity: 2, name: "Front Brake Disc", price: 40, currencyCode: "USD", supplierName: "Supplier LEAP-SLR-AB12", stockQuantity: 20, imageUrl: null, ...over });
const cartOf = (items: CartItem[], over: Partial<Cart> = {}): Cart => ({ cartId: "c", items, appliedPromoCode: null, appliedDiscountUsd: 0, appliedDiscountSource: "none", loyaltyDiscountPercentage: 0, lockActive: false, lockExpiresAt: null, ...over });
function setCart(cart: Cart | null, over: Record<string, unknown> = {}) {
  const items = cart?.items ?? [];
  m.cart.current = {
    cart, isLoading: false, error: null,
    itemCount: items.reduce((n, i) => n + i.quantity, 0), total: items.reduce((s, i) => s + i.price * i.quantity, 0),
    summary: totals({ items, appliedDiscountUsd: cart?.appliedDiscountUsd, appliedDiscountSource: cart?.appliedDiscountSource, loyaltyDiscountPercentage: cart?.loyaltyDiscountPercentage, appliedPromoCode: cart?.appliedPromoCode, shipping: cart?.shipping }),
    addItem: vi.fn(async () => {}), updateQuantity: vi.fn(async () => {}), removeItem: vi.fn(async () => {}), lockPrices: vi.fn(async () => {}), applyPromo: vi.fn(async () => {}), clearAfterOrder: vi.fn(),
    ...over,
  };
}
const ctx = () => m.cart.current as Record<string, ReturnType<typeof vi.fn>>;
const show = (node: React.ReactNode, lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}>{node}</LangProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  m.user.current = null;
  setCart(cartOf([line()]));
  m.fetchMyAddresses.mockResolvedValue([]);
  m.methods.mockResolvedValue([]);
  m.placeOrder.mockResolvedValue({ id: "ord_1", total: 80, currencyCode: "USD" });
  m.createAddress.mockResolvedValue({});
  m.position.mockResolvedValue(null);
  m.reverse.mockResolvedValue(null);
});


const ship = (over: Record<string, unknown> = {}) => ({ enabled: true, thresholdUsd: 50, feeUsd: 5, chargedUsd: 5, remainingUsd: 30, qualifies: false, waivedByPromo: false, ...over });
const small = () => setCart(cartOf([line({ quantity: 1, price: 20 })], { shipping: ship() } as never)); const big = () => setCart(cartOf([line({ quantity: 2, price: 30 })], { shipping: ship({ chargedUsd: 0, remainingUsd: 0, qualifies: true }) } as never));
const checkout = () => screen.getByRole("link", { name: /Checkout/ });
const summaryOf = () => screen.getByRole("complementary");

describe("the cart page", () => {
  it("under the limit: the fee line, the note with the missing amount, a total that includes the fee, and NO icon over Checkout", () => {
    small(); show(<CartPage />); const s = within(summaryOf()); expect(s.getByText("Shipping fees")).toBeInTheDocument(); expect(s.getByTestId("shipping-fee")).toHaveTextContent("+$5"); expect(s.getByTestId("shipping-hint")).toHaveTextContent("Add $30 more for free shipping");
    expect(s.getByText("Total").parentElement).toHaveTextContent("$25"); expect(screen.queryByTestId("free-shipping-badge")).not.toBeInTheDocument(); expect(s.getByText("Subtotal").parentElement).toHaveTextContent("$20");
  });
  it("at the limit: the fee struck through and Free, the green note, the total WITHOUT a fee, and the Free shipping icon over Checkout (inside its link)", () => {
    big(); show(<CartPage />); const s = within(summaryOf()); expect(s.getByTestId("shipping-fee-struck")).toHaveTextContent("$5"); expect(s.getByText("Free")).toBeInTheDocument(); expect(s.getByTestId("shipping-hint").getAttribute("data-state")).toBe("reached");
    expect(s.getByText("Total").parentElement).toHaveTextContent("$60"); const link = checkout(); expect(link.getAttribute("href")).toBe("/checkout"); expect(within(link).getByTestId("free-shipping-badge")).toHaveTextContent("Free shipping"); expect(link.className.split(" ")).toContain("relative");
  });
  it("the fee line and the note sit between the lines of the summary and the Total (after the weight)", () => {
    small(); show(<CartPage />); const text = summaryOf().textContent!; expect(text.indexOf("Subtotal")).toBeLessThan(text.indexOf("Shipping fees")); expect(text.indexOf("Shipping fees")).toBeLessThan(text.indexOf("Add $30 more")); expect(text.indexOf("Add $30 more")).toBeLessThan(text.indexOf("Total"));
  });
  it("a free-shipping promo code: Free, the code's note and the icon", () => {
    setCart(cartOf([line({ quantity: 1, price: 20 })], { shipping: ship({ chargedUsd: 0, waivedByPromo: true }) } as never)); show(<CartPage />); expect(screen.getByTestId("shipping-hint").getAttribute("data-state")).toBe("promo"); expect(screen.getByTestId("free-shipping-badge")).toBeInTheDocument(); expect(within(summaryOf()).getByText("Total").parentElement).toHaveTextContent("$20");
  });
  it("with the rule off, or a server that sends nothing, the cart page is exactly as before (no fee line, no note, no icon)", () => {
    for (const shipping of [undefined, ship({ enabled: false, chargedUsd: 0, qualifies: true })]) { setCart(cartOf([line({ quantity: 1, price: 20 })], { shipping } as never)); const v = show(<CartPage />); expect(screen.queryByText("Shipping fees")).not.toBeInTheDocument(); expect(screen.queryByTestId("shipping-hint")).not.toBeInTheDocument(); expect(screen.queryByTestId("free-shipping-badge")).not.toBeInTheDocument(); expect(within(summaryOf()).getByText("Total").parentElement).toHaveTextContent("$20"); v.unmount(); }
  });
  it("in Arabic the lines are Arabic", () => { small(); show(<CartPage />, "ar"); expect(screen.getByText("رسوم الشحن")).toBeInTheDocument(); expect(screen.getByTestId("shipping-hint")).toHaveTextContent("أضف $30 للحصول على شحن مجاني"); });
});
describe("the checkout page", () => {
  it("shows the shipping fee line and a total that includes it", async () => {
    small(); show(<CheckoutPage />); const s = within(await screen.findByRole("complementary")); expect(s.getByText("Shipping fees")).toBeInTheDocument(); expect(s.getByTestId("shipping-fee")).toHaveTextContent("+$5"); expect(s.getByText("Total").parentElement).toHaveTextContent("$25");
  });
  it("at the limit the fee is struck through and the total has no fee", async () => { big(); show(<CheckoutPage />); const s = within(await screen.findByRole("complementary")); expect(s.getByTestId("shipping-fee-struck")).toBeInTheDocument(); expect(s.getByText("Total").parentElement).toHaveTextContent("$60"); });
  it("with the rule off it is as before", async () => { setCart(cartOf([line({ quantity: 1, price: 20 })])); show(<CheckoutPage />); const s = within(await screen.findByRole("complementary")); expect(s.queryByText("Shipping fees")).not.toBeInTheDocument(); expect(s.getByText("Total").parentElement).toHaveTextContent("$20"); });
});

describe("You saved on the cart page counts the free shipping", () => {
  const saved = () => within(summaryOf()).queryByTestId("you-saved"); const detail = () => within(summaryOf()).queryByTestId("you-saved-detail");
  const freeBig = (over: Partial<Cart> = {}) => setCart(cartOf([line({ quantity: 2, price: 39 })], { shipping: ship({ chargedUsd: 0, remainingUsd: 0, qualifies: true }), ...over } as never));
  it("free shipping reached and NO discount: the line appears (it used to be hidden): You saved $5, with \"Free shipping\" under it", () => { freeBig(); show(<CartPage />); expect(saved()).toHaveTextContent("You saved $5"); expect(detail()).toHaveTextContent("Free shipping"); expect(detail()!.textContent).not.toContain("Discount"); });
  it("a discount AND free shipping: one total (8 + 5 = 13) with the split under it", () => { freeBig({ appliedDiscountUsd: 8, appliedDiscountSource: "promo", appliedPromoCode: "WELCOME8" }); show(<CartPage />); expect(saved()).toHaveTextContent("You saved $13"); expect(detail()).toHaveTextContent("Discount $8 · Free shipping $5"); });
  it("a discount only (a fee is charged): as before, one line and nothing under it", () => { setCart(cartOf([line({ quantity: 1, price: 40 })], { appliedDiscountUsd: 4, appliedDiscountSource: "promo", appliedPromoCode: "SAVE4", shipping: ship({ chargedUsd: 5, remainingUsd: 15, qualifies: false }) } as never)); show(<CartPage />); expect(saved()).toHaveTextContent("You saved $4"); expect(detail()).toBeNull(); });
  it("nothing saved at all (a small cart, a fee charged, no discount): no You saved line", () => { small(); show(<CartPage />); expect(saved()).toBeNull(); expect(detail()).toBeNull(); });
  it("the rule off: a discount alone is the line, as before; no discount: no line", () => { setCart(cartOf([line({ quantity: 1, price: 40 })], { appliedDiscountUsd: 4, appliedDiscountSource: "promo", appliedPromoCode: "SAVE4" } as never)); show(<CartPage />); expect(saved()).toHaveTextContent("You saved $4"); expect(detail()).toBeNull(); });
  it("the amount is under the Total, in green, the split in the small grey text", () => { freeBig(); show(<CartPage />); const s = saved()!; expect(s.className).toContain("text-[#0f6b49]"); expect(detail()!.className).toContain("text-muted"); expect(within(summaryOf()).getByText("Total").parentElement!.nextElementSibling).toBe(s); });
  it("in Arabic: وفّرت with the Arabic split", () => { freeBig({ appliedDiscountUsd: 8, appliedDiscountSource: "promo", appliedPromoCode: "W" }); show(<CartPage />, "ar"); expect(saved()!.textContent).toMatch(/وفّرت/); expect(detail()!.textContent).toMatch(/الخصم .* · الشحن المجاني /); });
  it("a free-shipping promo code below the limit also counts", () => { setCart(cartOf([line({ quantity: 1, price: 30 })], { shipping: ship({ chargedUsd: 0, qualifies: false, waivedByPromo: true, remainingUsd: 20 }) } as never)); show(<CartPage />); expect(saved()).toHaveTextContent("You saved $5"); });
});
