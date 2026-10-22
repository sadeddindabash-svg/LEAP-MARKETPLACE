import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import RotatingPlaceholder from "./RotatingPlaceholder";
import { ROTATE_MS, SLIDE_MS } from "@/lib/searchHints";

// The sliding suggestions: what shows, how it moves, when it stops. Time is controlled by the test.
const S = ["one", "two", "three"];
const strip = () => screen.getByTestId("rotating-placeholder").querySelector("[style]") as HTMLElement;
const shows = () => strip().style.transform; const anim = () => strip().style.transition;
const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
beforeEach(() => { vi.useFakeTimers(); Object.defineProperty(document, "hidden", { configurable: true, value: false }); });
afterEach(() => { vi.useRealTimers(); });

describe("what is drawn", () => {
  it("one line per suggestion plus the first one again at the end, at the first one, hidden from screen readers and from the mouse", () => {
    render(<RotatingPlaceholder suggestions={S} />); const box = screen.getByTestId("rotating-placeholder"); expect(box).toHaveAttribute("aria-hidden", "true"); expect(box.className).toContain("pointer-events-none");
    expect([...strip().children].map((c) => c.textContent)).toEqual(["one", "two", "three", "one"]); expect(shows()).toBe("translateY(0rem)");
  });
  it("draws nothing for no suggestions, and does not move for one", () => {
    const { container, unmount } = render(<RotatingPlaceholder suggestions={[]} />); expect(container).toBeEmptyDOMElement(); unmount(); render(<RotatingPlaceholder suggestions={["only"]} />); tick(ROTATE_MS * 3); expect(shows()).toBe("translateY(0rem)"); expect(vi.getTimerCount()).toBe(0);
  });
});
describe("how it moves", () => {
  it("stays for 3 seconds, then slides UP one line (negative direction) with a half second animation, and so on", () => {
    render(<RotatingPlaceholder suggestions={S} />); tick(ROTATE_MS - 1); expect(shows()).toBe("translateY(0rem)"); tick(1); expect(shows()).toBe("translateY(-1.5rem)"); expect(anim()).toContain(`transform ${SLIDE_MS}ms`); tick(ROTATE_MS); expect(shows()).toBe("translateY(-3rem)");
  });
  it("after the last one it slides on to the repeated first one, then jumps back to the real first one WITHOUT moving, and carries on with the animation", () => {
    render(<RotatingPlaceholder suggestions={S} />); tick(ROTATE_MS * 3); expect(shows()).toBe("translateY(-4.5rem)"); expect(anim()).toContain("transform"); tick(SLIDE_MS + 60); expect(shows()).toBe("translateY(0rem)"); expect(anim()).toBe("none");
    tick(ROTATE_MS - SLIDE_MS - 60); expect(shows()).toBe("translateY(-1.5rem)"); expect(anim()).toContain(`transform ${SLIDE_MS}ms`);
  });
  it("goes round again and again, showing every suggestion in order", () => {
    render(<RotatingPlaceholder suggestions={S} />); const seen: string[] = []; for (let i = 0; i < 9; i++) { const rows = Math.round(-parseFloat(shows().replace(/[^\d.-]/g, "")) / 1.5); seen.push([...strip().children][rows].textContent || ""); tick(ROTATE_MS); }
    expect(seen).toEqual(["one", "two", "three", "one", "two", "three", "one", "two", "three"]);
  });
  it("does not move while the browser tab is in the background, and carries on when it comes back", () => {
    render(<RotatingPlaceholder suggestions={S} />); Object.defineProperty(document, "hidden", { configurable: true, value: true }); tick(ROTATE_MS * 4); expect(shows()).toBe("translateY(0rem)"); Object.defineProperty(document, "hidden", { configurable: true, value: false }); tick(ROTATE_MS); expect(shows()).toBe("translateY(-1.5rem)");
  });
  it("leaves nothing running when it is removed (no timers left)", () => { const { unmount } = render(<RotatingPlaceholder suggestions={S} />); expect(vi.getTimerCount()).toBeGreaterThan(0); unmount(); expect(vi.getTimerCount()).toBe(0); });
  it("a long suggestion is cut with … instead of widening the box", () => { render(<RotatingPlaceholder suggestions={["a very long suggestion ".repeat(10), "b"]} />); expect(strip().children[0].className).toContain("truncate"); });
});
