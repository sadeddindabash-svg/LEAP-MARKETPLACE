import { describe, it, expect } from "vitest";
import { cardDiscount, cardDiscountTagClasses } from "./cardDiscount";

// The discount on a product card: the same rule as the product page, and a solid tag colour that grows with the discount.
describe("the discount on a card", () => {
  it("is the rounded percentage below the old price, and nothing when there is no genuine discount", () => {
    expect(cardDiscount(10, 14)).toBe(29); expect(cardDiscount(75, 100)).toBe(25);
    for (const o of [null, undefined, 10, 8, NaN]) expect(cardDiscount(10, o as never)).toBeNull(); expect(cardDiscount(100, 100.4)).toBeNull();
  });
  it("the tag is solid gold under 15%, orange from 15%, red from 30% (the edges belong to the stronger colour)", () => {
    expect(cardDiscountTagClasses(1)).toContain("#fab219"); expect(cardDiscountTagClasses(14)).toContain("#fab219"); expect(cardDiscountTagClasses(15)).toContain("#f26b21"); expect(cardDiscountTagClasses(29)).toContain("#f26b21"); expect(cardDiscountTagClasses(30)).toContain("#d92d20"); expect(cardDiscountTagClasses(80)).toContain("#d92d20");
  });
  it("gold carries dark text (it is light), orange and red carry white text", () => { expect(cardDiscountTagClasses(10)).toContain("text-navy"); expect(cardDiscountTagClasses(20)).toContain("text-white"); expect(cardDiscountTagClasses(40)).toContain("text-white"); });
});
