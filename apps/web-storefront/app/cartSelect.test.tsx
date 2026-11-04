import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Cart, CartItem } from "@/lib/api";
import { totals } from "@/lib/cart";
import { selectedCart, selectedSummary } from "@/lib/cartSelection";

// The basket's tick boxes: Select all, one box per line, the summary and Checkout follow the ticked lines, and with nothing ticked Checkout is off.
const m = vi.hoisted(() => ({ cart: { current: null as unknown } }));
vi.mock("@/components/CartProvider", () => ({ useCart: () => m.cart.current }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: null, isLoading: false }), getAuthToken: () => null }));
vi.mock("@/components/FitCheck", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/cart" }));
import CartPage from "./cart/page";
import { LangProvider } from "@/components/LangProvider";

const line = (productId: string, name: string, price: number): CartItem => ({ productId, quantity: 1, name, price, currencyCode: "USD", supplierName: "S", stockQuantity: 10, imageUrl: null });
const base: Cart = { cartId: "c", items: [line("a", "Brake Pads", 40), line("b", "Oil Filter", 30)], appliedDiscountUsd: 0, appliedDiscountSource: "none", loyaltyDiscountPercentage: 0 };
const toggle = vi.fn(), setAll = vi.fn();
function setUnselected(ids: string[]) {
  const un = new Set(ids);
  m.cart.current = {
    cart: base, isLoading: false, error: null, itemCount: 2, total: 70, summary: totals(base),
    updateQuantity: vi.fn(), removeItem: vi.fn(async () => {}), addItem: vi.fn(),
    unselected: un, toggleSelected: toggle, setAllSelected: setAll, selected: selectedCart(base, un), selectedSummary: selectedSummary(base, un),
  };
}
const show = () => render(<LangProvider lang="en"><CartPage /></LangProvider>);
beforeEach(() => { vi.clearAllMocks(); });

describe("choosing what to order", () => {
  it("CRITICAL: all ticked to start with: Select all is ticked, Checkout as before", () => {
    setUnselected([]); show();
    expect(screen.getByRole("checkbox", { name: "Select all (2)" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox", { name: "Order this part: Brake Pads" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("link", { name: "Checkout" })).toHaveAttribute("href", "/checkout");
  });
  it("CRITICAL: one unticked: Select all shows mixed, the summary and Checkout count only the ticked one, and the note says the rest stays", () => {
    setUnselected(["b"]); show();
    expect(screen.getByRole("checkbox", { name: "Select all (2)" })).toHaveAttribute("aria-checked", "mixed");
    const summary = screen.getByRole("complementary");
    expect(within(summary).getByTestId("cart-selected-count")).toHaveTextContent("Items (1 of 2)");
    expect(within(summary).getByText("Total").parentElement).toHaveTextContent("$40");
    expect(within(summary).getByRole("link", { name: /Checkout · 1 of 2/ })).toBeInTheDocument();
    expect(within(summary).getByText("Items you don't select stay in your cart.")).toBeInTheDocument();
  });
  it("ticking a line and Select all call the provider", () => {
    setUnselected(["b"]); show();
    fireEvent.click(screen.getByRole("checkbox", { name: "Order this part: Oil Filter" })); expect(toggle).toHaveBeenCalledWith("b");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all (2)" })); expect(setAll).toHaveBeenCalledWith(true);
  });
  it("nothing ticked: Checkout is off and says why", () => {
    setUnselected(["a", "b"]); show();
    expect(screen.queryByRole("link", { name: /Checkout/ })).not.toBeInTheDocument();
    expect(screen.getByText("Tick at least one part in your basket to order it.")).toBeInTheDocument();
  });
});
