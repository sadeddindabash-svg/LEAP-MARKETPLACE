import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

// The back-to-top arrow: hidden at the top, shown after scrolling about one screen, takes the buyer to the top (smoothly, or at once when the device asks for less motion).
const m = vi.hoisted(() => ({ lang: { current: "en" as "en" | "ar" } }));
vi.mock("./LangProvider", () => ({ useLang: () => m.lang.current }));
import BackToTop from "./BackToTop";

const scrollTo = vi.fn();
const setScroll = (y: number) => act(() => { Object.defineProperty(window, "scrollY", { value: y, configurable: true }); window.dispatchEvent(new Event("scroll")); });
const reduceMotion = (on: boolean) => vi.stubGlobal("matchMedia", (q: string) => ({ matches: on && q.includes("reduce"), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
beforeEach(() => { m.lang.current = "en"; scrollTo.mockClear(); window.scrollTo = scrollTo as unknown as typeof window.scrollTo; Object.defineProperty(window, "scrollY", { value: 0, configurable: true }); reduceMotion(false); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("BackToTop", () => {
  it("is not there at the top of the page", () => {
    const { container } = render(<BackToTop />);
    expect(container).toBeEmptyDOMElement();
  });
  it("appears after scrolling about one screen, and goes away again at the top", () => {
    render(<BackToTop />);
    setScroll(200); expect(screen.queryByRole("button")).not.toBeInTheDocument();
    setScroll(900); expect(screen.getByRole("button", { name: "Back to top" })).toBeInTheDocument();
    setScroll(0); expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("is already there when the page opens part-way down (a reload, or a link to the middle)", () => {
    Object.defineProperty(window, "scrollY", { value: 1500, configurable: true });
    render(<BackToTop />); expect(screen.getByRole("button", { name: "Back to top" })).toBeInTheDocument();
  });
  it("takes the buyer to the top, smoothly", () => {
    render(<BackToTop />); setScroll(900);
    fireEvent.click(screen.getByRole("button", { name: "Back to top" }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
  it("jumps at once when the device asks for less motion", () => {
    reduceMotion(true); render(<BackToTop />); setScroll(900);
    fireEvent.click(screen.getByRole("button", { name: "Back to top" }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });
  it("is labelled in Arabic on the Arabic site, and sits at the END side (right in English, left in Arabic)", () => {
    m.lang.current = "ar"; render(<BackToTop />); setScroll(900);
    const button = screen.getByRole("button", { name: "العودة للأعلى" });
    expect(button.className).toContain("end-6"); expect(button.className).toContain("fixed"); expect(button.className).not.toMatch(/\b(right|left)-/);
  });
  it("stops listening when the page is left", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<BackToTop />); unmount();
    expect(remove.mock.calls.some(([type]) => type === "scroll")).toBe(true);
  });
});
