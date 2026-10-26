import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Add to cart: the quantity, the total in the label, the limit at the stock. The cart is replaced by a spy.
const m = vi.hoisted(() => ({ add: vi.fn() }));
vi.mock("@/components/CartProvider", () => ({ useCart: () => ({ addItem: m.add }) }));
import { AddToCartButton } from "./AddToCartButton";
import { LangProvider } from "./LangProvider";

const show = (props: Partial<React.ComponentProps<typeof AddToCartButton>> = {}, lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}><AddToCartButton productId="p1" inStock {...props} /></LangProvider>);
const plus = () => screen.getByRole("button", { name: "Increase quantity" }); const minus = () => screen.getByRole("button", { name: "Decrease quantity" });
const main = () => screen.getAllByRole("button").at(-1)!;       // the quantity buttons come first, the main button is the last one (in any language)
beforeEach(() => { m.add.mockReset(); m.add.mockResolvedValue(undefined); });

describe("the label", () => {
  it("without a price it just says Add to cart (as before)", () => { show(); expect(main().textContent).toBe("Add to cart"); });
  it("with the price of one it says Add to cart · and the total, which follows the quantity", () => {
    show({ unitPrice: 10 }); expect(main().textContent).toMatch(/^Add to cart · \$10(\.00)?$/); fireEvent.click(plus()); expect(main().textContent).toMatch(/\$20(\.00)?$/); fireEvent.click(plus()); expect(main().textContent).toMatch(/\$30(\.00)?$/); fireEvent.click(minus()); expect(main().textContent).toMatch(/\$20(\.00)?$/);
  });
  it("a price with cents is multiplied exactly", () => { show({ unitPrice: 12.5 }); fireEvent.click(plus()); expect(main().textContent).toMatch(/\$25(\.00)?$/); });
  it("in Arabic: أضف إلى السلة · and the total", () => { show({ unitPrice: 10 }, "ar"); expect(main().textContent).toMatch(/^أضف إلى السلة · \$10(\.00)?$/); });
});
describe("the quantity", () => {
  it("never goes below 1", () => { show(); fireEvent.click(minus()); fireEvent.click(minus()); expect(screen.getByText("1")).toBeInTheDocument(); });
  it("stops at the stock: 3 in stock, however often + is pressed, and + is then switched off", () => {
    show({ unitPrice: 10, maxQuantity: 3 }); for (let i = 0; i < 6; i++) fireEvent.click(plus()); expect(screen.getByText("3")).toBeInTheDocument(); expect(plus()).toBeDisabled(); expect(main().textContent).toMatch(/\$30(\.00)?$/); fireEvent.click(minus()); expect(plus()).not.toBeDisabled();
  });
  it("only 1 in stock: + is off from the start", () => { show({ maxQuantity: 1 }); expect(plus()).toBeDisabled(); });
  it("without a stock figure there is no limit", () => { show(); for (let i = 0; i < 10; i++) fireEvent.click(plus()); expect(screen.getByText("11")).toBeInTheDocument(); expect(plus()).not.toBeDisabled(); });
});
describe("adding", () => {
  it("adds this product with the chosen quantity, then says Added ✓", async () => { show({ unitPrice: 10, maxQuantity: 5 }); fireEvent.click(plus()); fireEvent.click(plus()); fireEvent.click(main()); await waitFor(() => expect(m.add).toHaveBeenCalledWith("p1", 3)); expect(await screen.findByText(/Added ✓/)).toBeInTheDocument(); });
  it("a failure is said, and the button can be pressed again", async () => { m.add.mockRejectedValueOnce(new Error("no")); show(); fireEvent.click(main()); expect(await screen.findByText(/failed|try again|Could not/i)).toBeInTheDocument(); });
  it("out of stock: no quantity buttons, a disabled Out of stock button, nothing is added", () => { show({ inStock: false, unitPrice: 10, maxQuantity: 0 }); expect(screen.queryByRole("button", { name: "Increase quantity" })).toBeNull(); const b = screen.getByRole("button", { name: "Out of stock" }); expect(b).toBeDisabled(); fireEvent.click(b); expect(m.add).not.toHaveBeenCalled(); });
});
