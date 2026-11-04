import { describe, it, expect, vi, afterEach } from "vitest";
import { FLY_LANDED, FLY_START, arcPoint, easeInOut, flyToCart } from "./flyToCart";

// "Fly to cart": the path of the flying photo, and the two signals the cart listens to.
const events = () => { const seen: string[] = []; for (const e of [FLY_START, FLY_LANDED]) window.addEventListener(e, () => seen.push(e)); return seen; };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.innerHTML = ""; });

describe("the path", () => {
  it("starts on the photo, ends on the cart, and rises above both on the way", () => {
    const from = { x: 100, y: 400 }, to = { x: 800, y: 40 };
    expect(arcPoint(0, from, to)).toEqual(from); expect(arcPoint(1, from, to)).toEqual(to);
    expect(arcPoint(0.7, from, to).y).toBeLessThan(to.y + 40);
    expect(easeInOut(0)).toBe(0); expect(easeInOut(1)).toBe(1); expect(easeInOut(0.5)).toBe(0.5);
  });
});

describe("the signals", () => {
  it("CRITICAL: without the motion (no matchMedia, as here) the cart is told at once that the part started AND landed, so its number never waits", () => {
    const seen = events();
    document.body.innerHTML = '<a data-cart-target></a><div id="p"><img src="/x.jpg"></div>';
    flyToCart(document.getElementById("p"));
    expect(seen.slice(-2)).toEqual([FLY_START, FLY_LANDED]);
    expect(document.querySelector("[data-flyer]")).toBeNull();
  });

  it("CRITICAL: with the motion, a copy of the photo flies, and when it lands it is removed and the cart is told", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q }));
    let finish: (() => void) | null = null;
    const animate = vi.fn(function () { const run = { onfinish: null as null | (() => void), oncancel: null }; queueMicrotask(() => { finish = run.onfinish; }); return run; });
    (Element.prototype as unknown as { animate: unknown }).animate = animate;
    document.body.innerHTML = '<a data-cart-target></a><div id="p"><img src="http://x/photo.jpg"></div>';
    const box = (w: number) => ({ left: 0, top: 0, width: w, height: w, right: w, bottom: w, x: 0, y: 0, toJSON: () => ({}) });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => box(40) as DOMRect);
    const seen = events();
    flyToCart(document.getElementById("p"));
    const flyer = document.querySelector("[data-flyer]") as HTMLElement;
    expect(flyer).not.toBeNull(); expect(flyer.querySelector("img")?.getAttribute("src")).toBe("http://x/photo.jpg");
    expect(seen.at(-1)).toBe(FLY_START);
    return Promise.resolve().then(() => {
      finish!();
      expect(document.querySelector("[data-flyer]")).toBeNull();
      expect(seen.at(-1)).toBe(FLY_LANDED);
      delete (Element.prototype as unknown as { animate?: unknown }).animate;
    });
  });

  it("someone who asked to reduce motion gets no flight", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q }));
    document.body.innerHTML = '<a data-cart-target></a><div id="p"></div>';
    const seen = events();
    flyToCart(document.getElementById("p"));
    expect(document.querySelector("[data-flyer]")).toBeNull(); expect(seen.slice(-2)).toEqual([FLY_START, FLY_LANDED]);
  });
});
