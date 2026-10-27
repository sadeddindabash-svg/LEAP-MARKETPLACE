import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// The add-to-cart icon on a product card: one press = ONE in the cart, a check mark afterwards, no double press, greyed out with no stock, and harmless with no cart. The cart is replaced by a spy.
const m = vi.hoisted(() => ({ add: vi.fn(), cart: { current: null as unknown } }));
vi.mock("@/components/CartProvider", () => ({ useOptionalCart: () => m.cart.current }));
import CardAddToCart from "./CardAddToCart";
import { LangProvider } from "./LangProvider";

const show = (props: Partial<React.ComponentProps<typeof CardAddToCart>> = {}, lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}><CardAddToCart productId="p1" name="Brake disc" inStock {...props} /></LangProvider>);
const btn = () => screen.getByRole("button");
beforeEach(() => { vi.useFakeTimers(); m.add.mockReset(); m.add.mockResolvedValue(undefined); m.cart.current = { addItem: m.add }; });
afterEach(() => { vi.useRealTimers(); });

describe("pressing it", () => {
  it("is named by what it does and the part (so a screen reader hears which part): \"Add to cart: Brake disc\"", () => { show(); expect(screen.getByRole("button", { name: "Add to cart: Brake disc" })).toBeInTheDocument(); expect(btn().getAttribute("type")).toBe("button"); });
  it("puts ONE of this part in the cart, and another press puts one more", async () => {
    show(); await act(async () => { fireEvent.click(btn()); }); expect(m.add).toHaveBeenCalledTimes(1); expect(m.add).toHaveBeenLastCalledWith("p1", 1);
    act(() => { vi.advanceTimersByTime(2000); }); await act(async () => { fireEvent.click(btn()); }); expect(m.add).toHaveBeenCalledTimes(2); expect(m.add).toHaveBeenLastCalledWith("p1", 1);
  });
  it("shows a check mark for a moment, says \"Added\" to screen readers, and then goes back", async () => {
    show(); await act(async () => { fireEvent.click(btn()); }); expect(btn().getAttribute("data-status")).toBe("added"); expect(screen.getByRole("status")).toHaveTextContent("Added"); act(() => { vi.advanceTimersByTime(1599); }); expect(btn().getAttribute("data-status")).toBe("added"); act(() => { vi.advanceTimersByTime(1); }); expect(btn().getAttribute("data-status")).toBe("idle"); expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
  it("cannot be pressed twice while it is adding", async () => {
    let finish: () => void = () => {}; m.add.mockReturnValueOnce(new Promise<void>((r) => { finish = r; })); show(); fireEvent.click(btn()); expect(btn()).toBeDisabled(); fireEvent.click(btn()); expect(m.add).toHaveBeenCalledTimes(1); await act(async () => { finish(); });
  });
  it("a failure shows it (an alert mark and the words) and it can be pressed again", async () => {
    m.add.mockRejectedValueOnce(new Error("no")); show(); await act(async () => { fireEvent.click(btn()); }); expect(btn().getAttribute("data-status")).toBe("error"); expect(btn().getAttribute("title")).toBe("Couldn't add, please try again"); expect(screen.getByRole("status")).toHaveTextContent("Couldn't add, please try again"); expect(btn()).not.toBeDisabled();
  });
  it("in Arabic the name of the button is Arabic", () => { show({}, "ar"); expect(btn().getAttribute("aria-label")).toMatch(/^أضف إلى السلة: Brake disc$/); });
});
describe("when it cannot add", () => {
  it("with no stock it is greyed out, says so, and adds nothing", () => { show({ inStock: false }); expect(btn()).toBeDisabled(); expect(btn().getAttribute("aria-label")).toBe("Out of stock: Brake disc"); expect(btn().className).toContain("bg-[#e6edf2]"); fireEvent.click(btn()); expect(m.add).not.toHaveBeenCalled(); });
  it("with no cart at all (no provider) it is disabled and the page does not crash", () => { m.cart.current = null; show(); expect(btn()).toBeDisabled(); fireEvent.click(btn()); expect(m.add).not.toHaveBeenCalled(); });
});
describe("looks", () => {
  it("is the gold button, 44 px, with the cart icon (decoration)", () => { show(); expect(btn().className).toContain("bg-signal"); expect(btn().className).toContain("size-11"); expect(btn().querySelector("svg")!.getAttribute("aria-hidden")).toBe("true"); });
  it("leaves no timer behind when it is removed", async () => { const v = show(); await act(async () => { fireEvent.click(btn()); }); v.unmount(); expect(vi.getTimerCount()).toBe(0); });
});
