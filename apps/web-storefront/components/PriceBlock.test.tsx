import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import PriceBlock from "./PriceBlock";
import { cardDiscountTagClasses } from "@/lib/cardDiscount";

// The price, and when there is a discount: the old price struck through and a "-N% off" tag.
const show = (price: number, original: number | null | undefined, lang: "en" | "ar" = "en") => { const { container } = render(<PriceBlock price={price} originalPrice={original} lang={lang} />); return { container, del: container.querySelector("del"), tag: container.querySelector("span.rounded-md") }; };
describe("price block", () => {
  it("a discount: the price, the old price struck through (a real <del>), and the tag with the percentage", () => {
    const r = show(10, 14); expect(r.container.textContent).toContain("$10"); expect(r.del!.textContent).toContain("$14"); expect(r.tag!.textContent).toBe("-29% off"); expect(r.del!.className).toContain("text-muted");
  });
  it("the tag is the colour of its tier, the SAME as on the cards: gold under 15%, orange from 15%, red from 30%, solid and not italic", () => {
    expect(show(95, 100).tag!.className).toContain("bg-[#fab219]"); expect(show(80, 100).tag!.className).toContain("bg-[#f26b21]"); expect(show(50, 100).tag!.className).toContain("bg-[#d92d20]");
    for (const [p, o, pct] of [[95, 100, 5], [86, 100, 14], [85, 100, 15], [71, 100, 29], [70, 100, 30], [50, 100, 50]] as const) { const c = show(p, o).tag!.className; expect(c, `${pct}%`).toContain(cardDiscountTagClasses(pct)); expect(c).not.toContain("italic"); expect(c).toContain("font-bold"); }
  });
  it("no discount: only the price (nothing struck through, no tag) when there is no original price, or it is not higher", () => { for (const o of [null, undefined, 10, 7]) { const r = show(10, o); expect(r.del).toBeNull(); expect(r.tag).toBeNull(); expect(r.container.textContent).toContain("$10"); } });
  it("the price is the big one and comes first", () => { const r = show(10, 14); const first = r.container.firstElementChild!.firstElementChild as HTMLElement; expect(first.className).toContain("text-4xl"); expect(first.textContent).toContain("$10"); });
  it("in Arabic the tag reads خصم 29%", () => { expect(show(10, 14, "ar").tag!.textContent).toBe("خصم 29%"); });
});
