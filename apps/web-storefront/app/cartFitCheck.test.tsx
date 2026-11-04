import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Cart, CartItem } from "@/lib/api";
import { totals } from "@/lib/cart";

// The real cart page with the "does this part fit YOUR car?" ribbon on each photo and the line under each item: the cart, the sign-in state, the garage and the product fetch are replaced by fixed values.
const m = vi.hoisted(() => ({
  cart: { current: null as unknown },
  car: { current: null as unknown },
  fetchProduct: vi.fn(),
}));
vi.mock("@/components/CartProvider", () => ({ useCart: () => m.cart.current }));
vi.mock("@/components/GarageProvider", () => ({ useGarage: () => ({ defaultVehicle: m.car.current }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/cart" }));
vi.mock("@/lib/api", () => ({ fetchProductById: (...a: unknown[]) => m.fetchProduct(...a), resolveImageUrl: (u: string) => u }));

import CartPage from "./cart/page";
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
const car = { generationId: "g18", year: 2018, brand: "Toyota", brandAr: null, model: "Corolla", modelAr: null, version: null };
beforeEach(() => { m.car.current = car; m.fetchProduct.mockReset(); });
const show = () => render(<LangProvider lang="en"><CartPage /></LangProvider>);
const rowOf = (name: string) => screen.getByText(name).closest("li") as HTMLElement;

describe("the cart: does each part fit the buyer's car?", () => {
  it("CRITICAL: a part that does not fit: a red NOT FIT ribbon, what it is for and the buyer's car, and a search for it for the buyer's car; a part that fits: a green FIT ribbon and line; a part that fits any car: nothing", async () => {
    m.fetchProduct.mockImplementation(async (id: string) => ({
      cart1: { fitCars: [{ generationId: "g22", year: 2022, brand: "BAIC", brandAr: null, model: "BJ60", modelAr: null }], fitCarCount: 1, fitKeys: ["g22|2022"], fitsVehicleIds: [] },
      cart2: { fitCars: [{ generationId: "g18", year: 2018, brand: "Toyota", brandAr: null, model: "Corolla", modelAr: null }], fitCarCount: 1, fitKeys: ["g18|2018"], fitsVehicleIds: [] },
      cart3: { fitCars: [], fitCarCount: 0, fitKeys: [], fitsVehicleIds: [] },
    } as Record<string, unknown>)[id]);
    setCart(cartOf([line({ productId: "cart1", name: "Brake Pad Set" }), line({ productId: "cart2", name: "Oil Filter" }), line({ productId: "cart3", name: "Wiper Blade Set" })]));
    show();
    const first = within(rowOf("Brake Pad Set"));
    expect(await first.findByText("For BAIC BJ60 · 2022 — your car is Toyota Corolla · 2018")).toBeInTheDocument();
    expect(first.getByTestId("fit-ribbon")).toHaveAttribute("data-fit", "not_fit"); expect(first.getByTestId("fit-ribbon")).toHaveTextContent("✕ Not fit");
    expect(first.getByRole("link", { name: "Find it for my car" }).getAttribute("href")).toContain("generationId=g18");
    const second = within(rowOf("Oil Filter"));
    expect(await second.findByText("✓ Compatible with your Toyota Corolla · 2018")).toBeInTheDocument();
    expect(second.getByTestId("fit-ribbon")).toHaveAttribute("data-fit", "fit"); expect(second.getByTestId("fit-ribbon")).toHaveTextContent("✓ Fit");
    expect(within(rowOf("Wiper Blade Set")).queryByRole("status")).not.toBeInTheDocument(); expect(within(rowOf("Wiper Blade Set")).queryByTestId("fit-ribbon")).not.toBeInTheDocument();
  });

  it("in Arabic the ribbons and the line are Arabic", async () => {
    m.fetchProduct.mockImplementation(async (id: string) => (id === "a1" ? { fitCars: [{ generationId: "g22", year: 2022, brand: "BAIC", brandAr: null, model: "BJ60", modelAr: null }], fitCarCount: 1, fitKeys: ["g22|2022"], fitsVehicleIds: [] } : { fitCars: [{ generationId: "g18", year: 2018, brand: "Toyota", brandAr: null, model: "Corolla", modelAr: null }], fitCarCount: 1, fitKeys: ["g18|2018"], fitsVehicleIds: [] }));
    setCart(cartOf([line({ productId: "a1", name: "Brake Pad Set" }), line({ productId: "a2", name: "Oil Filter" })]));
    render(<LangProvider lang="ar"><CartPage /></LangProvider>);
    expect(await within(rowOf("Brake Pad Set")).findByText("✕ غير متوافقة")).toBeInTheDocument();
    expect(await within(rowOf("Oil Filter")).findByText("✓ متوافقة")).toBeInTheDocument();
    expect(within(rowOf("Brake Pad Set")).getByRole("link", { name: "ابحث عنها لسيارتي" })).toBeInTheDocument();
  });

  it("a buyer with no car in My Garage sees no fit messages and nothing is read", () => {
    m.car.current = null;
    setCart(cartOf([line({ productId: "cart4", name: "Brake Pad Set" })]));
    show();
    expect(screen.queryByText("This part fits:")).not.toBeInTheDocument(); expect(m.fetchProduct).not.toHaveBeenCalled();
  });
});
