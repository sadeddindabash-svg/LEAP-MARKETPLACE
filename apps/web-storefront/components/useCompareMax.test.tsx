import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useCompareMax from "./useCompareMax";

// How many parts this screen can compare: 4 on a computer or tablet, 2 on a phone (under 768 px), following the screen when it is turned or resized.
let listeners: Array<() => void> = []; let phone = false; const queries: string[] = [];
function screenIs(isPhone: boolean) { phone = isPhone; window.matchMedia = vi.fn().mockImplementation((q: string) => { queries.push(q); return { get matches() { return phone; }, media: q, addEventListener: (_: string, l: () => void) => { listeners.push(l); }, removeEventListener: (_: string, l: () => void) => { listeners = listeners.filter((x) => x !== l); }, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }; }) as never; }
const turn = (isPhone: boolean) => act(() => { phone = isPhone; listeners.forEach((l) => l()); });
beforeEach(() => { listeners = []; queries.length = 0; screenIs(false); });

describe("the number of parts this screen can compare", () => {
  it("4 on a computer or tablet, 2 on a phone", () => { expect(renderHook(() => useCompareMax()).result.current).toBe(4); screenIs(true); expect(renderHook(() => useCompareMax()).result.current).toBe(2); });
  it("asks about a screen under 768 px wide (767 and below)", () => { renderHook(() => useCompareMax()); expect(queries).toEqual(["(max-width: 767px)"]); });
  it("follows the screen when it is turned or resized, both ways", () => { const { result } = renderHook(() => useCompareMax()); expect(result.current).toBe(4); turn(true); expect(result.current).toBe(2); turn(false); expect(result.current).toBe(4); });
  it("stops listening when the page goes away (no listener is left behind)", () => { const { unmount } = renderHook(() => useCompareMax()); expect(listeners).toHaveLength(1); unmount(); expect(listeners).toHaveLength(0); });
  it("a browser without matchMedia gets the computer limit and no error", () => { (window as unknown as { matchMedia: unknown }).matchMedia = undefined; expect(renderHook(() => useCompareMax()).result.current).toBe(4); });
});
