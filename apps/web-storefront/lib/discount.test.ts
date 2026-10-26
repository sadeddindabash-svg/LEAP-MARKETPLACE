import { describe, it, expect } from "vitest";
import { discountPercent, discountTierClasses } from "./discount";

// The discount beside a price: only for a genuinely higher original price; the colour grows with the discount.
describe("the discount percentage", () => {
  it("is the rounded percentage the price is below the original: $10 against $14 is 29%", () => { expect(discountPercent(10, 14)).toBe(29); expect(discountPercent(75, 100)).toBe(25); expect(discountPercent(0.5, 1)).toBe(50); expect(discountPercent(9.5, 10)).toBe(5); });
  it("is nothing without a higher original price: none, equal, lower, not a number", () => { for (const o of [null, undefined, 10, 8, NaN, Infinity]) expect(discountPercent(10, o as never)).toBeNull(); expect(discountPercent(NaN, 12)).toBeNull(); });
  it("a difference that rounds to 0% is not shown as a discount (but 1% is)", () => { expect(discountPercent(100, 100.4)).toBeNull(); expect(discountPercent(99, 100)).toBe(1); });
});
describe("the colour of the tag", () => {
  it("amber below 15%, orange from 15%, red from 30%", () => {
    expect(discountTierClasses(1)).toContain("amber"); expect(discountTierClasses(14)).toContain("amber"); expect(discountTierClasses(15)).toContain("orange"); expect(discountTierClasses(29)).toContain("orange"); expect(discountTierClasses(30)).toContain("red"); expect(discountTierClasses(90)).toContain("red");
  });
});
