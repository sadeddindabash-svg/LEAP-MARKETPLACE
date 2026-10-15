import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Cart, CartItem, PaymentMethod, SavedAddress } from "@/lib/api";
import { totals } from "@/lib/cart";

// The cart page and the checkout page, with the cart, the sign-in state, the server and the location lookup replaced by fixed values.
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
    summary: totals({ items, appliedDiscountUsd: cart?.appliedDiscountUsd, appliedDiscountSource: cart?.appliedDiscountSource, loyaltyDiscountPercentage: cart?.loyaltyDiscountPercentage, appliedPromoCode: cart?.appliedPromoCode }),
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

describe("cart page", () => {
  it("CRITICAL: shows each part with its supplier, its LINE total and its stock hint, and the summary with the checkout link", () => {
    setCart(cartOf([line({ quantity: 8, stockQuantity: 10 }), line({ productId: "p2", name: "Oil Filter", quantity: 1, price: 12.5, supplierName: "Supplier LEAP-SLR-ZZ99" })]));
    show(<CartPage />);
    const first = screen.getByRole("link", { name: "Front Brake Disc" }).closest("li") as HTMLElement;
    expect(within(first).getByText("Supplier LEAP-SLR-AB12")).toBeInTheDocument();
    expect(within(first).getByText("$320")).toBeInTheDocument();                                      // 8 x 40
    expect(within(first).getByText("Only 2 left in stock")).toBeInTheDocument();
    const second = screen.getByRole("link", { name: "Oil Filter" }).closest("li") as HTMLElement;
    expect(within(second).queryByText(/left in stock|available stock/)).not.toBeInTheDocument();       // plenty in stock: no hint
    expect(screen.getByRole("link", { name: "Checkout" }).getAttribute("href")).toBe("/checkout");
    expect(screen.getByText("(9 item(s))")).toBeInTheDocument();
  });

  it("CRITICAL: the quantity buttons follow the stock: at the limit '+' is off and the limit is said; at one, '−' is off; otherwise they change the quantity", async () => {
    setCart(cartOf([line({ quantity: 10, stockQuantity: 10 }), line({ productId: "p2", name: "One", quantity: 1, stockQuantity: 50 })]));
    show(<CartPage />);
    const [limit, one] = screen.getAllByRole("listitem").filter((li) => li.querySelector("[aria-label='Increase quantity']"));
    expect(within(limit).getByText("You've reached the available stock")).toBeInTheDocument();
    expect(within(limit).getByLabelText("Increase quantity")).toBeDisabled();
    expect(within(one).getByLabelText("Decrease quantity")).toBeDisabled();
    fireEvent.click(within(one).getByLabelText("Increase quantity"));
    expect(ctx().updateQuantity).toHaveBeenCalledWith("p2", 2);
    await waitFor(() => expect(within(limit).getByLabelText("Decrease quantity")).toBeEnabled());      // the buttons are off for a moment while a change is applied
    fireEvent.click(within(limit).getByLabelText("Decrease quantity"));
    expect(ctx().updateQuantity).toHaveBeenCalledWith("p1", 9);
  });

  it("the sale price is struck through, and 'price updated' is said when the price moved", () => {
    setCart(cartOf([line({ price: 40, originalPrice: 50, quantity: 1, priceChanged: true })]));
    show(<CartPage />);
    expect(screen.getByText("$50").closest("p")).toHaveClass("line-through");
    expect(screen.getByText("Price updated since you added this.")).toBeInTheDocument();
  });

  it("CRITICAL: removing a part says so and Undo puts the same quantity back", async () => {
    show(<CartPage />);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(ctx().removeItem).toHaveBeenCalledWith("p1"));
    expect(await screen.findByText(/Front Brake Disc removed from cart/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(ctx().addItem).toHaveBeenCalledWith("p1", 2));
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("CRITICAL: the summary shows the ONE discount the server applied (loyalty with its percentage), what was saved, the weight when known, and the total", () => {
    setCart(cartOf([line({ weightKg: 2.5 })], { appliedDiscountUsd: 12, appliedDiscountSource: "loyalty", loyaltyDiscountPercentage: 15, appliedPromoCode: "SAVE5" }));
    show(<CartPage />);
    const summary = screen.getByRole("complementary");
    expect(within(summary).getByText("Loyalty discount (15% off)")).toBeInTheDocument();
    expect(within(summary).getByText("$68")).toBeInTheDocument();                                    // 80 - 12 (the total)
    expect(within(summary).getByText(/You saved/)).toBeInTheDocument();
    expect(within(summary).getByText("5.0 kg")).toBeInTheDocument();                                  // 2.5 x 2
    expect(within(summary).getByText(/already beats this code/)).toBeInTheDocument();
  });

  it("a promo discount names its code; with no discount there is no discount line", () => {
    setCart(cartOf([line()], { appliedDiscountUsd: 10, appliedDiscountSource: "promo", appliedPromoCode: "SAVE10" }));
    const { unmount } = show(<CartPage />);
    expect(screen.getByText("Discount (SAVE10)")).toBeInTheDocument();
    unmount();
    setCart(cartOf([line()]));
    show(<CartPage />);
    expect(screen.queryByText(/Discount|Loyalty/)).not.toBeInTheDocument();
  });

  it("an empty cart, a cart that could not be loaded, and a cart still loading each say so", () => {
    setCart(cartOf([]));
    const first = show(<CartPage />);
    expect(screen.getByText("Your cart is empty.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse products" }).getAttribute("href")).toBe("/search");
    first.unmount();
    setCart(null, { error: "down" });
    const second = show(<CartPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load your cart.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    second.unmount();
    setCart(null, { isLoading: true });
    show(<CartPage />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("CRITICAL: in Arabic it is all Arabic (the supplier word too), the checkout link keeps /ar", () => {
    show(<CartPage />, "ar");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("السلة");
    expect(screen.getByText("المورد LEAP-SLR-AB12")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "إتمام الشراء" }).getAttribute("href")).toBe("/ar/checkout");
    expect(screen.getByText("ملخص الطلب")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------------------------------------------- checkout
const methods = (): PaymentMethod[] => [{ id: "pm1", nameEn: "Credit card", nameAr: "بطاقة ائتمان", photoUrl: null }, { id: "pm2", nameEn: "Bank transfer", nameAr: "تحويل بنكي", photoUrl: null }];
const saved = (over: Partial<SavedAddress> = {}): SavedAddress => ({ id: "a1", label: "Home", recipientName: "Sam", phone: "+968 1", country: "Oman", city: "Muscat", streetAddress: "1 Main St", postalCode: null, isDefault: false, createdAt: "x", ...over });
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
function fillAddress(over: { country?: string; recipient?: string } = {}) {
  type("Recipient name", over.recipient ?? "Sam Buyer"); type("Phone", "+968 9000 0000"); type("Country", over.country ?? "Oman"); type("City", "Muscat"); type("Street address", "12 Al Noor St");
}
const placeButton = () => screen.getByRole("button", { name: /Place order|Placing your order/ });
const lastOrderArgs = () => m.placeOrder.mock.lastCall as [unknown, unknown, unknown, unknown, { waitForAllShipments?: boolean; idempotencyKey?: string; lang?: string }];

describe("checkout: opening it", () => {
  it("CRITICAL: the prices are locked the moment it opens (once), and a guest is asked for an email and an address with the app's note", () => {
    show(<CheckoutPage />);
    expect(ctx().lockPrices).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Checking out as a guest/)).toBeInTheDocument();
    expect(screen.getByLabelText("Email for order confirmation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Have an account? Log in instead" }).getAttribute("href")).toBe("/login");
    expect(screen.getByLabelText("Country")).toBeInTheDocument();
  });

  it("an empty cart sends the buyer to browse instead", () => {
    setCart(cartOf([]));
    show(<CheckoutPage />);
    expect(screen.getByText("Your cart is empty.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Place order/ })).not.toBeInTheDocument();
  });

  it("the summary lists the parts and shows the server's discount and the total; a held price is noted", () => {
    setCart(cartOf([line()], { appliedDiscountUsd: 12, appliedDiscountSource: "loyalty", loyaltyDiscountPercentage: 15, lockActive: true }));
    show(<CheckoutPage />);
    const summary = screen.getByRole("complementary");
    expect(within(summary).getByText("Front Brake Disc × 2")).toBeInTheDocument();
    expect(within(summary).getByText("Loyalty discount (15% off)")).toBeInTheDocument();
    expect(within(summary).getByText("$68")).toBeInTheDocument();
    expect(within(summary).getByText("Prices are held for you while you check out.")).toBeInTheDocument();
  });
});

describe("checkout: a guest placing an order", () => {
  it("CRITICAL: an email is required and must look like one, before anything else is sent", async () => {
    show(<CheckoutPage />);
    fireEvent.click(placeButton());
    expect(await screen.findByText("Please enter an email for your order confirmation.")).toBeInTheDocument();
    type("Email for order confirmation", "not-an-email");
    fireEvent.click(placeButton());
    expect(await screen.findByText("That doesn't look like a valid email address.")).toBeInTheDocument();
    expect(m.placeOrder).not.toHaveBeenCalled();
  });

  it("CRITICAL: the address must be complete, a country we serve, and for Saudi Arabia carry its address code", async () => {
    show(<CheckoutPage />);
    type("Email for order confirmation", "sam@example.com");
    fireEvent.click(placeButton());
    expect(await screen.findByText("Please fill in every field.")).toBeInTheDocument();
    fillAddress({ country: "Saudi Arabia" });
    fireEvent.click(placeButton());
    expect(await screen.findByText(/Must be 4 letters followed by 4 numbers/)).toBeInTheDocument();
    expect(m.placeOrder).not.toHaveBeenCalled();
    type("Address Code", "rrrd2929");
    fireEvent.click(placeButton());
    await waitFor(() => expect(m.placeOrder).toHaveBeenCalledTimes(1));
  });

  it("CRITICAL: the order goes with the items, the guest's email, the address (the English country name), the cart's promo code, the wait choice, a duplicate-protection key and the language; nothing about payment", async () => {
    setCart(cartOf([line(), line({ productId: "p2", quantity: 1 })], { appliedPromoCode: "SAVE10", appliedDiscountUsd: 10, appliedDiscountSource: "promo" }));
    show(<CheckoutPage />);
    type("Email for order confirmation", " sam@example.com ");
    fillAddress();
    fireEvent.click(placeButton());
    await waitFor(() => expect(m.placeOrder).toHaveBeenCalledTimes(1));
    const [items, who, where, promo, options] = lastOrderArgs();
    expect(items).toEqual([{ productId: "p1", quantity: 2 }, { productId: "p2", quantity: 1 }]);
    expect(who).toEqual({ guestEmail: "sam@example.com" });
    expect(where).toEqual({ address: { recipientName: "Sam Buyer", phone: "+968 9000 0000", country: "Oman", city: "Muscat", streetAddress: "12 Al Noor St" } });
    expect(promo).toBe("SAVE10");
    expect(options).toEqual({ waitForAllShipments: false, idempotencyKey: expect.stringMatching(/\S{8,}/), lang: "en" });
    expect(JSON.stringify(lastOrderArgs())).not.toMatch(/payment/i);
  });

  it("CRITICAL: after the order the cart is emptied at once and the guest lands on the confirmation with their email (for the account step)", async () => {
    show(<CheckoutPage />);
    type("Email for order confirmation", "sam@example.com");
    fillAddress();
    fireEvent.click(placeButton());
    await waitFor(() => expect(ctx().clearAfterOrder).toHaveBeenCalledTimes(1));
    expect(m.push.mock.lastCall?.[0]).toBe("/checkout/confirmation?orderId=ord_1&guestEmail=sam%40example.com");
    expect(m.createAddress).not.toHaveBeenCalled();                                                // a guest has no address book
  });
});

describe("checkout: a signed-in buyer", () => {
  beforeEach(() => {
    m.user.current = { id: "u1", email: "buyer@leap.dev" };
    m.fetchMyAddresses.mockResolvedValue([saved({ id: "a1", label: "Home" }), saved({ id: "a2", label: "Work", country: "United Arab Emirates", city: "Dubai", isDefault: true })]);
  });

  it("CRITICAL: orders as themselves, with their DEFAULT saved address picked, and the order goes with that address id (no email, no address typed)", async () => {
    show(<CheckoutPage />);
    expect(screen.getByText("buyer@leap.dev")).toBeInTheDocument();
    expect(screen.queryByLabelText("Email for order confirmation")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("radio", { name: /Work/ })).toBeChecked());
    fireEvent.click(placeButton());
    await waitFor(() => expect(m.placeOrder).toHaveBeenCalledTimes(1));
    const [, who, where] = lastOrderArgs();
    expect(who).toEqual({ userId: "u1" });
    expect(where).toEqual({ addressId: "a2" });
    expect(m.createAddress).not.toHaveBeenCalled();
    expect(m.push.mock.lastCall?.[0]).toBe("/checkout/confirmation?orderId=ord_1");                // no guest email for a signed-in buyer
  });

  it("choosing another saved address changes where it goes and which payment methods are shown", async () => {
    show(<CheckoutPage />);
    await waitFor(() => expect(m.methods).toHaveBeenCalledWith("United Arab Emirates"));
    fireEvent.click(await screen.findByRole("radio", { name: /Home/ }));
    await waitFor(() => expect(m.methods).toHaveBeenCalledWith("Oman"));
    fireEvent.click(placeButton());
    await waitFor(() => expect(m.placeOrder).toHaveBeenCalled());
    expect(lastOrderArgs()[2]).toEqual({ addressId: "a1" });
  });

  it("CRITICAL: a NEW address typed at checkout is used for the order and, when asked, saved for next time (with the label 'Address')", async () => {
    show(<CheckoutPage />);
    fireEvent.click(await screen.findByRole("radio", { name: "Use a new address" }));
    fillAddress();
    expect(screen.getByRole("checkbox", { name: "Save this address for next time" })).toBeChecked();
    fireEvent.click(placeButton());
    await waitFor(() => expect(m.createAddress).toHaveBeenCalledTimes(1));
    expect(m.createAddress.mock.lastCall?.[0]).toBe("tok");
    expect(m.createAddress.mock.lastCall?.[1]).toMatchObject({ label: "Address", recipientName: "Sam Buyer", country: "Oman", state: null, postalCode: null });
    expect(lastOrderArgs()[2]).toEqual({ address: expect.objectContaining({ country: "Oman", streetAddress: "12 Al Noor St" }) });
  });

  it("with no saved address the form is shown straight away, and 'save for next time' off means it is not saved", async () => {
    m.fetchMyAddresses.mockResolvedValue([]);
    show(<CheckoutPage />);
    expect(await screen.findByText("No saved addresses yet.")).toBeInTheDocument();
    fillAddress();
    fireEvent.click(screen.getByRole("checkbox", { name: "Save this address for next time" }));
    fireEvent.click(placeButton());
    await waitFor(() => expect(m.placeOrder).toHaveBeenCalled());
    expect(m.createAddress).not.toHaveBeenCalled();
  });
});

describe("checkout: payment methods, waiting, stock, promo", () => {
  it("CRITICAL: the payment methods for the chosen country are listed (in the page's language) with the first one picked, as a CHOICE only: the order carries no payment", async () => {
    m.methods.mockResolvedValue(methods());
    show(<CheckoutPage />);
    expect(screen.queryByRole("radio", { name: "Credit card" })).not.toBeInTheDocument();           // no country yet: nothing to show
    type("Country", "Oman");
    expect(await screen.findByRole("radio", { name: "Credit card" })).toBeChecked();
    expect(m.methods).toHaveBeenCalledWith("Oman");
    fireEvent.click(screen.getByRole("radio", { name: "Bank transfer" }));
    expect(screen.getByRole("radio", { name: "Bank transfer" })).toBeChecked();
  });

  it("a country with no payment methods says so", async () => {
    show(<CheckoutPage />);
    type("Country", "Oman");
    expect(await screen.findByText("No payment methods are available for this address yet.")).toBeInTheDocument();
  });

  it("CRITICAL: 'wait and ship together' is offered only when the parts come from more than one supplier, and its choice is sent", async () => {
    const { unmount } = show(<CheckoutPage />);
    expect(screen.queryByText("Wait and ship together")).not.toBeInTheDocument();                   // one supplier: nothing to wait for
    type("Email for order confirmation", "sam@example.com"); fillAddress();
    fireEvent.click(placeButton());
    await waitFor(() => expect(m.placeOrder).toHaveBeenCalledTimes(1));
    expect(lastOrderArgs()[4].waitForAllShipments).toBe(false);
    unmount();
    m.placeOrder.mockClear();
    setCart(cartOf([line(), line({ productId: "p2", supplierName: "Supplier LEAP-SLR-ZZ99" })]));
    show(<CheckoutPage />);
    expect(screen.getByText("Get all items in one delivery instead of as each supplier ships.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch"));
    type("Email for order confirmation", "sam@example.com"); fillAddress();
    fireEvent.click(placeButton());
    await waitFor(() => expect(m.placeOrder).toHaveBeenCalledTimes(1));
    expect(lastOrderArgs()[4].waitForAllShipments).toBe(true);
  });

  it("CRITICAL: a part with less stock now than in the cart is named, and the order cannot be placed until it is fixed", async () => {
    setCart(cartOf([line({ name: "Front Brake Disc", quantity: 5, stockQuantity: 2 })]));
    show(<CheckoutPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("Front Brake Disc has less stock available now than in your cart.");
    expect(placeButton()).toBeDisabled();
    type("Email for order confirmation", "sam@example.com"); fillAddress();
    fireEvent.submit(placeButton().closest("form") as HTMLFormElement);
    expect(m.placeOrder).not.toHaveBeenCalled();
  });

  it("CRITICAL: a promo code is put on the CART (the server checks it): an invalid one shows the server's reason, a valid one can be removed", async () => {
    show(<CheckoutPage />);
    ctx().applyPromo.mockRejectedValueOnce(new Error("This code has expired"));
    type("Promo code", "OLD10");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText("This code has expired")).toBeInTheDocument();
    expect(ctx().applyPromo).toHaveBeenLastCalledWith("OLD10");
    type("Promo code", "SAVE10");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(ctx().applyPromo).toHaveBeenLastCalledWith("SAVE10"));
  });

  it("an applied code is shown with 'Applied!' and can be removed; the loyalty-beats-promo message is shown when it applies", async () => {
    setCart(cartOf([line()], { appliedPromoCode: "SAVE5", appliedDiscountUsd: 12, appliedDiscountSource: "loyalty", loyaltyDiscountPercentage: 15 }));
    show(<CheckoutPage />);
    expect(screen.getByText("SAVE5 · Applied!")).toBeInTheDocument();
    expect(screen.getByText(/already beats this code/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(ctx().applyPromo).toHaveBeenCalledWith(null);
  });
});

describe("checkout: never the same order twice", () => {
  const fillGuest = () => { type("Email for order confirmation", "sam@example.com"); fillAddress(); };

  it("CRITICAL: while the order is being placed the button is off, so a double click places ONE order", async () => {
    let finish: (v: unknown) => void = () => {};
    m.placeOrder.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    show(<CheckoutPage />);
    fillGuest();
    fireEvent.click(placeButton());
    await waitFor(() => expect(screen.getByRole("button", { name: "Placing your order…" })).toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Placing your order…" }));
    expect(m.placeOrder).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ id: "ord_9", total: 1, currencyCode: "USD" }); });
  });

  it("CRITICAL: when there was NO answer at all (the network dropped) the retry keeps its key, so a first order that did go through is not placed again", async () => {
    m.placeOrder.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    show(<CheckoutPage />);
    fillGuest();
    fireEvent.click(placeButton());
    await screen.findByRole("alert");
    const first = lastOrderArgs()[4].idempotencyKey;
    fireEvent.click(placeButton());
    await waitFor(() => expect(m.placeOrder).toHaveBeenCalledTimes(2));
    expect(lastOrderArgs()[4].idempotencyKey).toBe(first);
  });

  it("CRITICAL: when the server REFUSED the order (stock, a rule) a new attempt is a new order with a new key, and the server's reason is shown", async () => {
    m.placeOrder.mockRejectedValueOnce(new Error("Not enough stock for Front Brake Disc"));
    show(<CheckoutPage />);
    fillGuest();
    fireEvent.click(placeButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("Not enough stock for Front Brake Disc");
    const first = lastOrderArgs()[4].idempotencyKey;
    fireEvent.click(placeButton());
    await waitFor(() => expect(m.placeOrder).toHaveBeenCalledTimes(2));
    expect(lastOrderArgs()[4].idempotencyKey).not.toBe(first);
  });
});

describe("checkout: 'Use my location' and Arabic", () => {
  it("CRITICAL: the location fills the street, city and country (only a country we serve), says so, and the buyer can still change everything", async () => {
    m.position.mockResolvedValue({ latitude: 1, longitude: 2 });
    m.reverse.mockResolvedValue({ streetAddress: "12 Al Noor St", city: "Muscat", country: "Oman" });
    show(<CheckoutPage />);
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await screen.findByText(/We found this from your location/)).toBeInTheDocument();
    expect(screen.getByLabelText("Street address")).toHaveValue("12 Al Noor St");
    expect(screen.getByLabelText("City")).toHaveValue("Muscat");
    expect(screen.getByLabelText("Country")).toHaveValue("Oman");
  });

  it("a country we do not serve is not accepted from the location (it says so), and a lookup that fails gives the app's hint", async () => {
    m.position.mockResolvedValue({ latitude: 1, longitude: 2 });
    m.reverse.mockResolvedValue({ streetAddress: "S", city: "C", country: "Atlantis" });
    const { unmount } = show(<CheckoutPage />);
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await screen.findByText("We do not deliver to that country yet.")).toBeInTheDocument();
    expect(screen.getByLabelText("Country")).toHaveValue("");
    unmount();
    m.position.mockResolvedValue(null);
    show(<CheckoutPage />);
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await screen.findByText(/We couldn't detect your location/)).toBeInTheDocument();
  });

  it("CRITICAL: in Arabic everything is Arabic, countries are listed in Arabic but sent in English, and the order is placed in Arabic and goes to the Arabic confirmation", async () => {
    m.methods.mockResolvedValue(methods());
    show(<CheckoutPage />, "ar");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("إتمام الشراء");
    expect(screen.getByRole("button", { name: "إتمام الطلب" })).toBeInTheDocument();
    const select = screen.getByLabelText("الدولة") as HTMLSelectElement;
    const oman = [...select.options].find((o) => o.value === "Oman");
    expect(oman?.textContent).toMatch(/[\u0600-\u06FF]/);                                         // shown in Arabic, the value stays English
    type("البريد الإلكتروني لتأكيد الطلب", "sam@example.com");
    type("اسم المستلم", "سام"); type("الهاتف", "+968 9000 0000"); type("الدولة", "Oman"); type("المدينة", "مسقط"); type("عنوان الشارع", "شارع النور");
    expect(await screen.findByRole("radio", { name: "بطاقة ائتمان" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "إتمام الطلب" }));
    await waitFor(() => expect(m.placeOrder).toHaveBeenCalledTimes(1));
    expect(lastOrderArgs()[2]).toEqual({ address: expect.objectContaining({ country: "Oman", recipientName: "سام" }) });
    expect(lastOrderArgs()[4].lang).toBe("ar");
    expect(m.push.mock.lastCall?.[0]).toBe("/ar/checkout/confirmation?orderId=ord_1&guestEmail=sam%40example.com");
  });
});
