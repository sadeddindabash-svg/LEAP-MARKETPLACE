import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import CardPhotos, { HOVER_DELAY_MS, HOVER_STEP_MS } from "./CardPhotos";

// The photo of a product card: with a mouse, while the pointer is on the card the other photos show in turn (0.4 s, then every 0.9 s, round to the first), with dots; nothing moves on touch screens or with reduced motion.
const IMGS = ["/a.png", "/b.png", "/c.png"];
function media(opts: { hover?: boolean; reduced?: boolean } = {}) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({ matches: q.includes("hover: hover") ? opts.hover !== false : q.includes("reduced-motion") ? !!opts.reduced : false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as never;
}
function setup(images = IMGS, opts: { hover?: boolean; reduced?: boolean } = {}) {
  media(opts);
  const view = render(<ul><li data-testid="card"><CardPhotos images={images} alt="Pads" /></li></ul>);
  const card = screen.getByTestId("card");
  return { ...view, card, src: () => new URL(card.querySelector("img.opacity-100")!.getAttribute("src")!, "http://x").pathname, imgs: () => card.querySelectorAll("img").length, enter: () => act(() => { card.dispatchEvent(new MouseEvent("mouseenter")); }), leave: () => act(() => { card.dispatchEvent(new MouseEvent("mouseleave")); }), wait: (ms: number) => act(() => { vi.advanceTimersByTime(ms); }) };
}
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("with a mouse", () => {
  it("at rest: the first photo and no dots", () => { const v = setup(); expect(v.src()).toBe("/a.png"); expect(screen.queryByTestId("photo-dots")).not.toBeInTheDocument(); expect(HOVER_DELAY_MS).toBe(400); expect(HOVER_STEP_MS).toBe(900); });
  it("the pointer enters: the dots show at once, the NEXT photo after 0.4 s, then one every 0.9 s, round to the first again", () => {
    const v = setup(); v.enter(); expect(screen.getByTestId("photo-dots")).toBeInTheDocument(); expect(v.src()).toBe("/a.png");
    v.wait(HOVER_DELAY_MS - 1); expect(v.src()).toBe("/a.png"); v.wait(1); expect(v.src()).toBe("/b.png");
    v.wait(HOVER_STEP_MS - 1); expect(v.src()).toBe("/b.png"); v.wait(1); expect(v.src()).toBe("/c.png"); v.wait(HOVER_STEP_MS); expect(v.src()).toBe("/a.png"); v.wait(HOVER_STEP_MS); expect(v.src()).toBe("/b.png");
  });
  it("the dots: one per photo, the active one follows the photo", () => {
    const v = setup(); v.enter(); const dots = () => [...screen.getByTestId("photo-dots").children].map((d) => d.getAttribute("data-active")); expect(dots()).toEqual(["true", "false", "false"]); v.wait(HOVER_DELAY_MS); expect(dots()).toEqual(["false", "true", "false"]); v.wait(HOVER_STEP_MS); expect(dots()).toEqual(["false", "false", "true"]);
    expect(screen.getByTestId("photo-dots").getAttribute("aria-hidden")).toBe("true");
  });
  it("the pointer leaves: back to the first photo, no dots, and nothing keeps running", () => { const v = setup(); v.enter(); v.wait(HOVER_DELAY_MS + HOVER_STEP_MS); expect(v.src()).toBe("/c.png"); v.leave(); expect(v.src()).toBe("/a.png"); expect(screen.queryByTestId("photo-dots")).not.toBeInTheDocument(); v.wait(10000); expect(v.src()).toBe("/a.png"); expect(vi.getTimerCount()).toBe(0); });
  it("leaving before the first change cancels it", () => { const v = setup(); v.enter(); v.wait(200); v.leave(); v.wait(5000); expect(v.src()).toBe("/a.png"); });
  it("coming back starts again from the first photo with the same delay", () => { const v = setup(); v.enter(); v.wait(HOVER_DELAY_MS + HOVER_STEP_MS); v.leave(); v.enter(); expect(v.src()).toBe("/a.png"); v.wait(HOVER_DELAY_MS); expect(v.src()).toBe("/b.png"); });
  it("the whole card counts, not only the photo: it is the card (the li) that is listened to", () => { const v = setup(); const photo = v.card.querySelector("img")!; act(() => { photo.dispatchEvent(new MouseEvent("mouseenter")); }); v.wait(5000); expect(v.src()).toBe("/a.png"); v.enter(); v.wait(HOVER_DELAY_MS); expect(v.src()).toBe("/b.png"); });
  it("only the FIRST photo is on the page until the pointer first enters (a page of cards does not download the others); then all are in place", () => {
    const v = setup(); expect(v.imgs()).toBe(1); v.enter(); expect(v.imgs()).toBe(3); v.leave(); expect(v.imgs()).toBe(3); v.enter(); expect(v.imgs()).toBe(3);
  });
  it("no photo is ever REPLACED: the same elements stay in place and only the shown one changes (a replaced photo under the pointer makes the browser announce \"entered\" again)", () => {
    const v = setup(); v.enter(); const before = [...v.card.querySelectorAll("img")]; v.wait(HOVER_DELAY_MS + HOVER_STEP_MS * 3); const after = [...v.card.querySelectorAll("img")]; expect(after).toHaveLength(3); after.forEach((el, i) => expect(el).toBe(before[i]));
    expect(before.map((el) => el.className.includes("opacity-100")).filter(Boolean)).toHaveLength(1);
  });
  it("a repeated \"pointer entered\" while the pointer is already on the card does NOT restart the timing (the browser sends it again whenever something under the pointer changes)", () => {
    const v = setup(); v.enter(); v.wait(300); v.enter(); v.enter(); v.wait(HOVER_DELAY_MS - 300); expect(v.src()).toBe("/b.png"); v.wait(HOVER_STEP_MS - 1); expect(v.src()).toBe("/b.png"); v.enter(); v.wait(1); expect(v.src()).toBe("/c.png");
  });
  it("the faded-out photos have no description (only the shown one is described), so a screen reader reads the part once", () => { const v = setup(); v.enter(); const imgs = [...v.card.querySelectorAll("img")]; expect(imgs.filter((i) => i.getAttribute("alt") === "Pads")).toHaveLength(1); expect(imgs.filter((i) => i.getAttribute("alt") === "")).toHaveLength(2); });

  it("leaving the page clears the timers", () => { const v = setup(); v.enter(); v.wait(HOVER_DELAY_MS); v.unmount(); expect(vi.getTimerCount()).toBe(0); });
  it("two photos go back and forth; the alt text is the part's name", () => { const v = setup(["/a.png", "/b.png"]); v.enter(); v.wait(HOVER_DELAY_MS); expect(v.src()).toBe("/b.png"); v.wait(HOVER_STEP_MS); expect(v.src()).toBe("/a.png"); expect(v.card.querySelector("img")!.getAttribute("alt")).toBe("Pads"); });
});

describe("where nothing moves", () => {
  it("a screen that cannot hover (phone, tablet): the first photo stays and there are no dots", () => { const v = setup(IMGS, { hover: false }); v.enter(); v.wait(10000); expect(v.src()).toBe("/a.png"); expect(screen.queryByTestId("photo-dots")).not.toBeInTheDocument(); });
  it("a person who asked for reduced motion: the first photo stays", () => { const v = setup(IMGS, { reduced: true }); v.enter(); v.wait(10000); expect(v.src()).toBe("/a.png"); expect(screen.queryByTestId("photo-dots")).not.toBeInTheDocument(); });
  it("a part with one photo: just that photo, no dots, nothing to do", () => { const v = setup(["/a.png"]); v.enter(); v.wait(10000); expect(v.src()).toBe("/a.png"); expect(screen.queryByTestId("photo-dots")).not.toBeInTheDocument(); expect(vi.getTimerCount()).toBe(0); });
  it("a browser without matchMedia does not break the card", () => { (window as unknown as { matchMedia: unknown }).matchMedia = undefined; const v = render(<ul><li><CardPhotos images={IMGS} alt="x" /></li></ul>); expect(new URL(v.container.querySelector("img")!.getAttribute("src")!, "http://x").pathname).toBe("/a.png"); });
});
