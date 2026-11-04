import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// "Fly to cart" from a product card: the add-to-cart icon sends THIS card's photo to the cart.
const m = vi.hoisted(() => ({ fly: vi.fn(), add: vi.fn(async () => {}) }));
vi.mock("@/lib/flyToCart", () => ({ flyToCart: (el: Element | null) => m.fly(el) }));
vi.mock("@/components/CartProvider", () => ({ useOptionalCart: () => ({ addItem: m.add }) }));
import CardAddToCart from "./CardAddToCart";
import { LangProvider } from "./LangProvider";

describe("adding from a product card", () => {
  it("CRITICAL: flies the card's own photo, and adds one", () => {
    render(<LangProvider lang="en"><ul><li><div data-fly-photo="" data-testid="photo-a" /><CardAddToCart productId="a" name="Pads" inStock /></li><li><div data-fly-photo="" data-testid="photo-b" /></li></ul></LangProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Add to cart: Pads" }));
    expect(m.fly).toHaveBeenCalledWith(screen.getByTestId("photo-a"));
    expect(m.add).toHaveBeenCalledWith("a", 1);
  });
});
