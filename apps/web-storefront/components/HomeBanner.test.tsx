import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import HomeBanner from "./HomeBanner";
import { LangProvider } from "./LangProvider";
import { SLIDE_MS } from "@/lib/searchHints";
import type { ViewSlide } from "@/lib/homeBanner";

// The home page banner: what is drawn, how it moves, when it holds still, the links, the swipe. Time is controlled by the test.
const slides = (): ViewSlide[] => [
  { id: "a", src: "https://api.example.com/uploads/a.png", alt: "Brake sale", href: "/products/p1", external: false, seconds: 3 },
  { id: "b", src: "https://api.example.com/uploads/b.png", alt: "", href: "https://example.com/sale", external: true, seconds: 8 },
  { id: "c", src: "https://api.example.com/uploads/c.png", alt: "Free delivery", href: null, external: false, seconds: 5 },
];
let calm = false; let listeners: Array<(e: { matches: boolean }) => void> = [];
const show = (props: { slides?: ViewSlide[]; rtl?: boolean; lang?: "en" | "ar" } = {}) => render(<LangProvider lang={props.lang ?? (props.rtl ? "ar" : "en")}><HomeBanner slides={props.slides ?? slides()} rtl={props.rtl} /></LangProvider>);
const strip = () => screen.getByTestId("home-banner-strip"); const move = () => strip().style.transform; const anim = () => strip().style.transition;
const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const throughAllPhotos = () => { tick(3000); tick(8000); tick(5000); };       // one photo at a time: the next photo's wait only starts after the page has been redrawn
const touch = (type: "pointerdown" | "pointerup", x: number, pointerType = "touch") => { const e = new MouseEvent(type, { clientX: x, bubbles: true }); Object.defineProperty(e, "pointerType", { value: pointerType }); act(() => { screen.getByTestId("home-banner").dispatchEvent(e); }); };
beforeEach(() => {
  vi.useFakeTimers(); calm = false; listeners = []; Object.defineProperty(document, "hidden", { configurable: true, value: false });
  window.matchMedia = ((q: string) => ({ matches: q.includes("reduce") ? calm : false, media: q, addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.push(fn), removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) => { listeners = listeners.filter((l) => l !== fn); } })) as never;
});
afterEach(() => { vi.useRealTimers(); });

describe("what is drawn", () => {
  it("a labelled carousel with every photo, then the first one again (so the last slides on to the first), the repeat hidden from screen readers", () => {
    show(); const region = screen.getByRole("region", { name: "Advertisements" }); expect(region).toHaveAttribute("aria-roledescription", "carousel");
    const groups = [...strip().children] as HTMLElement[]; expect(groups).toHaveLength(4); expect(groups.map((g) => g.getAttribute("aria-label"))).toEqual(["1 / 3", "2 / 3", "3 / 3", "1 / 3"]); expect(groups.map((g) => g.getAttribute("aria-hidden"))).toEqual(["false", "true", "true", "true"]); expect(move()).toBe("translateX(0%)");
  });
  it("dots (one per photo, the first current) and arrows, all labelled", () => {
    show(); const dots = screen.getAllByRole("button", { name: /Go to photo/ }); expect(dots).toHaveLength(3); expect(dots[0]).toHaveAttribute("aria-current", "true"); expect(dots[1]).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "Previous photo" })).toBeInTheDocument(); expect(screen.getByRole("button", { name: "Next photo" })).toBeInTheDocument();
  });
  it("the descriptions are the photos' alt text; a photo without a description is decoration (empty alt)", () => { show(); const imgs = [...strip().querySelectorAll("img")]; expect(imgs[0].getAttribute("alt")).toBe("Brake sale"); expect(imgs[1].getAttribute("alt")).toBe(""); expect(imgs[2].getAttribute("alt")).toBe("Free delivery"); });
  it("nothing for no photos; one photo: no repeat, no dots, no arrows, nothing running", () => {
    const { container, unmount } = show({ slides: [] }); expect(container.querySelector("[data-testid=home-banner]")).toBeNull(); unmount();
    show({ slides: [slides()[0]] }); expect(strip().children).toHaveLength(1); expect(screen.queryAllByRole("button")).toHaveLength(0); tick(60000); expect(move()).toBe("translateX(0%)"); expect(vi.getTimerCount()).toBe(0);
  });
  it("the frame is the box's shape on a phone and fills the height of the finder box beside it on a computer", () => { show(); const c = screen.getByTestId("home-banner").className; expect(c).toContain("aspect-[5/2]"); expect(c).toContain("lg:h-full"); expect(c).toContain("lg:min-h-[241px]"); expect(c).toContain("overflow-hidden"); });
});
describe("how it moves: each photo stays for ITS OWN seconds", () => {
  it("photo 1 stays 3 s, photo 2 stays 8 s, photo 3 stays 5 s, each time sliding one photo to the left (half a second)", () => {
    show(); tick(2999); expect(move()).toBe("translateX(0%)"); tick(1); expect(move()).toBe("translateX(-100%)"); expect(anim()).toContain(`transform ${SLIDE_MS}ms`);
    tick(7999); expect(move()).toBe("translateX(-100%)"); tick(1); expect(move()).toBe("translateX(-200%)"); tick(4999); expect(move()).toBe("translateX(-200%)"); tick(1); expect(move()).toBe("translateX(-300%)");
  });
  it("after the last photo it slides on to the repeated first one, then jumps back to the real first WITHOUT moving, and goes on with photo 1's seconds", () => {
    show(); throughAllPhotos(); expect(move()).toBe("translateX(-300%)"); expect(anim()).toContain("transform"); tick(SLIDE_MS + 100); expect(move()).toBe("translateX(0%)"); expect(anim()).toBe("none");
    tick(3000 - SLIDE_MS - 100 - 1); expect(move()).toBe("translateX(0%)"); tick(1); expect(move()).toBe("translateX(-100%)"); expect(anim()).toContain("transform");
  });
  it("CRITICAL: the first photo stays EXACTLY its own seconds every round, counted from when it comes on screen (the quiet jump back must not start the wait again: it used to add half a second each round)", () => {
    show(); throughAllPhotos(); tick(3000 - 1); expect(move()).not.toBe("translateX(-100%)"); tick(1); expect(move()).toBe("translateX(-100%)");        // round 1: arrived on the repeat, 3 s later it moves on
    tick(8000); tick(5000); tick(3000 - 1); expect(move()).not.toBe("translateX(-100%)"); tick(1); expect(move()).toBe("translateX(-100%)");           // round 2: the same
  });
  it("in Arabic it slides the other way (to the right)", () => { show({ rtl: true }); tick(3000); expect(move()).toBe("translateX(100%)"); });
});
describe("when it holds still", () => {
  it("while the mouse is over it; when the mouse leaves the wait starts again in full", () => {
    show(); const box = screen.getByTestId("home-banner"); fireEvent.mouseEnter(box); tick(60000); expect(move()).toBe("translateX(0%)"); fireEvent.mouseLeave(box); tick(2999); expect(move()).toBe("translateX(0%)"); tick(1); expect(move()).toBe("translateX(-100%)");
  });
  it("while something inside it has the keyboard focus (and not when the focus only moves between its own buttons)", () => {
    show(); const dots = screen.getAllByRole("button", { name: /Go to photo/ }); act(() => dots[2].focus()); tick(30000); expect(move()).toBe("translateX(0%)");
    fireEvent.blur(dots[2], { relatedTarget: dots[1] }); tick(30000); expect(move()).toBe("translateX(0%)"); fireEvent.blur(dots[1], { relatedTarget: document.body }); tick(3000); expect(move()).toBe("translateX(-100%)");
  });
  it("while a finger is on it", () => { show(); touch("pointerdown", 100); tick(60000); expect(move()).toBe("translateX(0%)"); touch("pointerup", 100); tick(3000); expect(move()).toBe("translateX(-100%)"); });
  it("while the browser tab is in the background; it carries on when the tab is back", () => {
    show(); Object.defineProperty(document, "hidden", { configurable: true, value: true }); act(() => { document.dispatchEvent(new Event("visibilitychange")); }); tick(60000); expect(move()).toBe("translateX(0%)");
    Object.defineProperty(document, "hidden", { configurable: true, value: false }); act(() => { document.dispatchEvent(new Event("visibilitychange")); }); tick(3000); expect(move()).toBe("translateX(-100%)");
  });
  it("for someone who asked for less movement it never slides by itself and never animates, but the dots and arrows still work; and it follows the setting live", () => {
    calm = true; show(); tick(120000); expect(move()).toBe("translateX(0%)"); expect(vi.getTimerCount()).toBe(0); fireEvent.click(screen.getByRole("button", { name: "Go to photo 3" })); expect(move()).toBe("translateX(-200%)"); expect(anim()).toBe("none");
    act(() => listeners.forEach((l) => l({ matches: false }))); tick(5000); expect(move()).toBe("translateX(-300%)");
  });
  it("a browser that cannot tell (no matchMedia) still works, with the movement", () => { (window as { matchMedia?: unknown }).matchMedia = undefined; show(); tick(3000); expect(move()).toBe("translateX(-100%)"); });
  it("leaves nothing running when it is removed", () => { const { unmount } = show(); expect(vi.getTimerCount()).toBeGreaterThan(0); unmount(); expect(vi.getTimerCount()).toBe(0); expect(listeners.length).toBe(0); });
});
describe("dots, arrows and swipes", () => {
  it("a dot goes to its photo, which then stays for ITS seconds", () => { show(); fireEvent.click(screen.getByRole("button", { name: "Go to photo 2" })); expect(move()).toBe("translateX(-100%)"); expect(screen.getByRole("button", { name: "Go to photo 2" })).toHaveAttribute("aria-current", "true"); tick(7999); expect(move()).toBe("translateX(-100%)"); tick(1); expect(move()).toBe("translateX(-200%)"); });
  it("Next and Previous, round the ends: Previous from the first goes to the last; Next from the last slides on to the first", () => {
    show(); fireEvent.click(screen.getByRole("button", { name: "Previous photo" })); expect(move()).toBe("translateX(-200%)"); fireEvent.click(screen.getByRole("button", { name: "Next photo" })); expect(move()).toBe("translateX(-300%)"); tick(SLIDE_MS + 100); expect(move()).toBe("translateX(0%)");
    fireEvent.click(screen.getByRole("button", { name: "Next photo" })); expect(move()).toBe("translateX(-100%)");
  });
  it("Next pressed on the repeated first photo (a moment before it jumps back) carries on from the real first one", () => { show(); throughAllPhotos(); expect(move()).toBe("translateX(-300%)"); fireEvent.click(screen.getByRole("button", { name: "Next photo" })); expect(move()).toBe("translateX(-100%)"); expect(anim()).toBe("none"); });
  it("a swipe left goes to the next photo, a swipe right to the one before; a short drag or a mouse does nothing", () => {
    show(); touch("pointerdown", 300); touch("pointerup", 240); expect(move()).toBe("translateX(-100%)"); touch("pointerdown", 100); touch("pointerup", 160); expect(move()).toBe("translateX(0%)");
    touch("pointerdown", 100); touch("pointerup", 130); expect(move()).toBe("translateX(0%)"); touch("pointerdown", 300, "mouse"); touch("pointerup", 100, "mouse"); expect(move()).toBe("translateX(0%)");
  });
  it("in Arabic a swipe to the right goes to the next photo", () => { show({ rtl: true }); touch("pointerdown", 100); touch("pointerup", 160); expect(move()).toBe("translateX(100%)"); });
});
describe("links", () => {
  it("a part or category link stays on the site (with /ar in Arabic); a web page opens in a new tab safely; a photo with no link is not a link", () => {
    show(); const links = [...strip().querySelectorAll("a")] as HTMLAnchorElement[]; expect(links.map((a) => a.getAttribute("href"))).toEqual(["/products/p1", "https://example.com/sale", "/products/p1"]);
    expect(links[1].target).toBe("_blank"); expect(links[1].rel).toBe("noopener noreferrer"); expect(links[0].target).toBe(""); expect((strip().children[2] as HTMLElement).querySelector("a")).toBeNull();
  });
  it("Arabic: the part link has the /ar prefix", () => { show({ rtl: true }); expect(strip().querySelector("a")!.getAttribute("href")).toBe("/ar/products/p1"); });
  it("only the photo that is showing can be reached with the Tab key", () => { show(); const links = [...strip().querySelectorAll("a")] as HTMLAnchorElement[]; expect(links.map((a) => a.tabIndex)).toEqual([0, -1, -1]); tick(3000); expect([...strip().querySelectorAll("a")].map((a) => (a as HTMLAnchorElement).tabIndex)).toEqual([-1, 0, -1]); });
});
