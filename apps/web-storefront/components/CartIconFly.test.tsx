import { describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { FLY_LANDED, FLY_START } from "@/lib/flyToCart";

// The cart in the header is where an added part lands: while a part is in the air its number waits, and goes up when the part lands.
const m = vi.hoisted(() => ({ count: { current: 2 } }));
vi.mock("./CartProvider", () => ({ useCart: () => ({ itemCount: m.count.current }) }));
import CartIcon from "./CartIcon";

describe("the cart when a part flies to it", () => {
  it("CRITICAL: is the landing place, holds its number while the part flies, and shows the new number when it lands", () => {
    const { rerender, container } = render(<CartIcon />);
    expect(container.querySelector("[data-cart-target]")).not.toBeNull();
    act(() => { window.dispatchEvent(new Event(FLY_START)); });
    m.count.current = 3; rerender(<CartIcon />);
    expect(screen.getByText("2")).toBeInTheDocument();                 // the part is still in the air
    act(() => { window.dispatchEvent(new Event(FLY_LANDED)); });
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
