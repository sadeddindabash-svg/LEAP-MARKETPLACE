import { describe, it, expect } from "vitest";
import { COMPARE_MAX, COMPARE_MAX_PHONE, COMPARE_MIN, PHONE_MAX_WIDTH, compareHref, parseIds } from "./compare";

// Compare: 4 parts on a tablet or a computer, 2 on a phone (a screen under 768 px wide).
describe("the limits", () => {
  it("4 on a computer or tablet, 2 on a phone, never below 2 to compare; a phone is a screen under 768 px (Tailwind's md)", () => { expect(COMPARE_MAX).toBe(4); expect(COMPARE_MAX_PHONE).toBe(2); expect(COMPARE_MIN).toBe(2); expect(PHONE_MAX_WIDTH).toBe(767); expect(COMPARE_MAX_PHONE).toBeGreaterThanOrEqual(COMPARE_MIN); expect(COMPARE_MAX_PHONE).toBeLessThan(COMPARE_MAX); });
});
describe("the address of a comparison", () => {
  it("a comparison started on a phone has 2 parts; a longer list is cut to the limit given, and by default to 4", () => {
    expect(compareHref(["1", "2", "3", "4"], COMPARE_MAX_PHONE)).toBe("/compare?ids=1,2"); expect(compareHref(["1", "2", "3", "4", "5"])).toBe("/compare?ids=1,2,3,4"); expect(compareHref(["1", "2", "3"], 4)).toBe("/compare?ids=1,2,3"); expect(compareHref(["1"], 2)).toBe("/compare?ids=1");
  });
  it("the page still reads up to 4 parts from an address (a shared link): the phone only HIDES the others", () => { expect(parseIds("a,b,c,d,e")).toEqual(["a", "b", "c", "d"]); });
});
