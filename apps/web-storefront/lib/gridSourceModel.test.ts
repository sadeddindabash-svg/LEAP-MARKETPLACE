import { describe, it, expect } from "vitest";
import { gridQuery, parseGridQuery } from "./gridSource";

// The 'same model' list as a source of the scrolling grid: asked for and read back the same way as the others.
describe("the sameModel source", () => {
  it("is asked for by kind and product, with the page, the batch size and the language", () => {
    const q = new URLSearchParams(gridQuery({ kind: "sameModel", productId: "p_17" }, 3, 8, "ar"));
    expect(Object.fromEntries(q)).toEqual({ kind: "sameModel", productId: "p_17", page: "3", limit: "8", lang: "ar" });
  });
  it("is read back exactly as it was asked for", () => {
    const parsed = parseGridQuery(new URLSearchParams(gridQuery({ kind: "sameModel", productId: "p_17" }, 2, 8, "en")));
    expect(parsed).toEqual({ source: { kind: "sameModel", productId: "p_17" }, page: 2, limit: 8, lang: "en" });
  });
  it("is refused without a valid product id", () => {
    for (const q of ["kind=sameModel", "kind=sameModel&productId=", "kind=sameModel&productId=a%20b", "kind=sameModel&productId=../x"]) expect("error" in parseGridQuery(new URLSearchParams(q)), q).toBe(true);
  });
  it("the other kinds are unchanged (same brand still reads its product, newest needs none)", () => {
    expect(parseGridQuery(new URLSearchParams("kind=sameBrand&productId=p_1"))).toMatchObject({ source: { kind: "sameBrand", productId: "p_1" } });
    expect(parseGridQuery(new URLSearchParams("kind=newest"))).toMatchObject({ source: { kind: "newest" } });
  });
});
