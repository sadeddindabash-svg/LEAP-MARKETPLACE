import { describe, it, expect } from "vitest";
import { COMPARE_MAX, COMPARE_MIN, compareHref, parseIds } from "./compare";

describe("compare ids", () => {
  it("CRITICAL: the ids in the address are trimmed, without blanks or duplicates, and at most four (the app compares 2 to 4)", () => {
    expect(COMPARE_MIN).toBe(2);
    expect(COMPARE_MAX).toBe(4);
    expect(parseIds("a,b,c")).toEqual(["a", "b", "c"]);
    expect(parseIds(" a , b ,, c ")).toEqual(["a", "b", "c"]);
    expect(parseIds("a,a,b")).toEqual(["a", "b"]);
    expect(parseIds("a,b,c,d,e,f")).toEqual(["a", "b", "c", "d"]);
    expect(parseIds("")).toEqual([]);
    expect(parseIds(undefined)).toEqual([]);
  });
  it("the comparison address names the parts, in order, at most four", () => {
    expect(compareHref(["p1", "p2"])).toBe("/compare?ids=p1,p2");
    expect(compareHref(["a b", "c&d"])).toBe("/compare?ids=a%20b,c%26d");
    expect(compareHref(["1", "2", "3", "4", "5"])).toBe("/compare?ids=1,2,3,4");
  });
});
