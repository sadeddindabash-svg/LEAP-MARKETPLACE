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

// ONE CART PER ACCOUNT: after signing in, when this device's basket was combined with the account basket, the basket page says so (once, until dismissed), in English and Arabic.
const show = (node: React.ReactNode, lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}>{node}</LangProvider>);
const merge = (over = {}) => ({ itemsAdded: 2, itemsCombined: 1, reduced: [{ productId: "p2", name: "Oil Filter", from: 3, to: 2 }], dropped: [{ productId: "p4", name: "Air Filter" }], ...over });
beforeEach(() => { vi.clearAllMocks(); m.user.current = null; });

describe("the notice on the basket page", () => {
  it("CRITICAL: says the baskets were combined, how many items were added, which quantity was lowered for stock and what could not be added", () => {
    setCart(cartOf([line()]), { mergeNotice: merge(), dismissMergeNotice: vi.fn() }); show(<CartPage />);
    const box = screen.getByTestId("cart-merge-notice"); expect(box).toHaveTextContent("We combined this device's basket with your account basket."); expect(box).toHaveTextContent("3 items were added."); expect(box).toHaveTextContent("The quantity of “Oil Filter” was lowered to 2: that is all we have in stock."); expect(box).toHaveTextContent("“Air Filter” was not added: it is out of stock.");
  });
  it("one item: \"1 item was added.\"; nothing lowered or dropped: only the title and the count", () => {
    setCart(cartOf([line()]), { mergeNotice: merge({ itemsAdded: 1, itemsCombined: 0, reduced: [], dropped: [] }), dismissMergeNotice: vi.fn() }); show(<CartPage />); const box = screen.getByTestId("cart-merge-notice"); expect(box).toHaveTextContent("1 item was added."); expect(box).not.toHaveTextContent("lowered"); expect(box).not.toHaveTextContent("not added");
  });
  it("it is shown on an EMPTY basket too (everything combined was dropped)", () => {
    setCart(cartOf([]), { mergeNotice: merge({ itemsAdded: 0, itemsCombined: 0, reduced: [], dropped: [{ productId: "p4", name: "Air Filter" }] }), dismissMergeNotice: vi.fn() }); show(<CartPage />); expect(screen.getByTestId("cart-merge-notice")).toHaveTextContent("“Air Filter” was not added"); expect(screen.getByTestId("cart-merge-notice")).not.toHaveTextContent("items were added");
  });
  it("the close button dismisses it (the provider's dismiss is called)", () => { const dismiss = vi.fn(); setCart(cartOf([line()]), { mergeNotice: merge(), dismissMergeNotice: dismiss }); show(<CartPage />); fireEvent.click(screen.getByRole("button", { name: "Dismiss" })); expect(dismiss).toHaveBeenCalledTimes(1); });
  it("no notice when nothing was combined (the usual case), or from an older provider that has none", () => { setCart(cartOf([line()]), { mergeNotice: null, dismissMergeNotice: vi.fn() }); show(<CartPage />); expect(screen.queryByTestId("cart-merge-notice")).not.toBeInTheDocument(); });
  it("in Arabic the notice is Arabic", () => {
    setCart(cartOf([line()]), { mergeNotice: merge(), dismissMergeNotice: vi.fn() }); show(<CartPage />, "ar"); const box = screen.getByTestId("cart-merge-notice"); expect(box).toHaveTextContent("دمجنا سلة هذا الجهاز مع سلة حسابك."); expect(box).toHaveTextContent("تمت إضافة 3 من المنتجات."); expect(box).toHaveTextContent("تم تخفيض كمية «Oil Filter» إلى 2"); expect(box).toHaveTextContent("لم تتم إضافة «Air Filter»"); expect(screen.getByRole("button", { name: "إغلاق" })).toBeInTheDocument();
  });
});
