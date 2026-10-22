import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { renderToString } from "react-dom/server";

// The search box in the header: rotating suggestions while it is empty, the plain sentence for anyone who asked for less movement, typing, searching.
const m = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("@/components/useLocRouter", () => ({ useLocRouter: () => ({ push: m.push }) }));
import HeaderSearch from "./HeaderSearch";
import { LangProvider } from "./LangProvider";

const SENTENCE = "Search by part name, part number or VIN";
const mount = (lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}><HeaderSearch /></LangProvider>);
const box = () => screen.getByRole("searchbox") as HTMLInputElement;
const overlay = () => screen.queryByTestId("rotating-placeholder");
let reduce: boolean; let listeners: Array<(e: { matches: boolean }) => void>;
beforeEach(() => {
  vi.useFakeTimers(); m.push.mockClear(); reduce = false; listeners = [];
  window.matchMedia = ((q: string) => ({ matches: q.includes("reduce") ? reduce : false, media: q, addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.push(fn), removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) => { listeners = listeners.filter((l) => l !== fn); } })) as never;
});
afterEach(() => { vi.useRealTimers(); });

describe("rotating suggestions", () => {
  it("the page as the server sends it (before anything runs) is exactly the old box: the plain sentence as a normal placeholder, no moving words", () => {
    const html = renderToString(<LangProvider lang="en"><HeaderSearch /></LangProvider>); expect(html).toContain(`placeholder="${SENTENCE}"`); expect(html).not.toContain("rotating-placeholder");
  });
  it("once ready, the words are drawn over the box (starting with the same sentence), and the real placeholder is emptied so the two never overlap", () => {
    mount(); expect(box().placeholder).toBe(""); expect(overlay()).not.toBeNull(); expect(overlay()!.textContent!.startsWith(SENTENCE)).toBe(true);
  });
  it("screen readers still get the box's label and the plain sentence (as its description), not the moving words", () => {
    mount(); expect(screen.getByLabelText("Search parts")).toBe(box()); const hint = document.getElementById(box().getAttribute("aria-describedby")!)!; expect(hint.textContent).toBe(SENTENCE); expect(hint.className).toContain("sr-only"); expect(overlay()).toHaveAttribute("aria-hidden", "true");
  });
  it("slides on to the next suggestion every 3 seconds", () => { mount(); const strip = overlay()!.querySelector("[style]") as HTMLElement; act(() => { vi.advanceTimersByTime(3000); }); expect(strip.style.transform).toBe("translateY(-1.5rem)"); });
  it("typing hides the suggestions; emptying the box brings them back", () => {
    mount(); fireEvent.change(box(), { target: { value: "bra" } }); expect(overlay()).toBeNull(); expect(box().value).toBe("bra"); fireEvent.change(box(), { target: { value: "" } }); expect(overlay()).not.toBeNull();
  });
  it("in Arabic the suggestions are Arabic", () => { mount("ar"); expect(overlay()!.textContent).toMatch(/ابحث عن «تيل فرامل»/); expect(overlay()!.textContent).toMatch(/OEM/); });
});
describe("for someone who asked for less movement", () => {
  it("nothing moves: the plain sentence is the normal placeholder and there are no drawn words", () => { reduce = true; mount(); expect(box().placeholder).toBe(SENTENCE); expect(overlay()).toBeNull(); });
  it("it follows the setting live (turning it on or off while the page is open)", () => {
    mount(); expect(overlay()).not.toBeNull(); act(() => listeners.forEach((l) => l({ matches: true }))); expect(overlay()).toBeNull(); expect(box().placeholder).toBe(SENTENCE); act(() => listeners.forEach((l) => l({ matches: false }))); expect(overlay()).not.toBeNull(); expect(box().placeholder).toBe("");
  });
  it("a browser that cannot tell (no matchMedia) still works, with the movement", () => { (window as { matchMedia?: unknown }).matchMedia = undefined; mount(); expect(overlay()).not.toBeNull(); });
  it("stops listening when the box is removed", () => { const { unmount } = mount(); expect(listeners.length).toBe(1); unmount(); expect(listeners.length).toBe(0); });
});
describe("searching still works exactly as before", () => {
  it("opens the search page with what was typed (trimmed and encoded), or the empty search page", () => {
    mount(); fireEvent.change(box(), { target: { value: "  brake pads & discs " } }); fireEvent.submit(box().closest("form")!); expect(m.push).toHaveBeenLastCalledWith("/search?q=brake%20pads%20%26%20discs"); fireEvent.change(box(), { target: { value: "   " } }); fireEvent.submit(box().closest("form")!); expect(m.push).toHaveBeenLastCalledWith("/search");
  });
});
