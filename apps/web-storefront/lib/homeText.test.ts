import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HEADLINE_SIZE_CLASS, HOME_FONTS, HOME_SIZES, SUBHEADLINE_SIZE_CLASS, pickHomeText } from "./homeText";

// The home page's editable texts: which wording is used, and that the website and the shop agree on the fonts and sizes that exist.
describe("pickHomeText", () => {
  const pair = { en: "Custom English", ar: "نص عربي" };
  it("uses the admin's text for the language of the page", () => { expect(pickHomeText(pair, "en", "Built-in")).toBe("Custom English"); expect(pickHomeText(pair, "ar", "المدمج")).toBe("نص عربي"); });
  it("uses the website's own wording when there is none, or only spaces, or nothing was loaded", () => {
    expect(pickHomeText({ en: null, ar: "x" }, "en", "Built-in")).toBe("Built-in"); expect(pickHomeText({ en: "   ", ar: "" }, "en", "Built-in")).toBe("Built-in");
    expect(pickHomeText(null, "en", "Built-in")).toBe("Built-in"); expect(pickHomeText(undefined, "ar", "المدمج")).toBe("المدمج");
  });
  it("one language never borrows the other: an Arabic page with only an English text shows the built-in Arabic", () => { expect(pickHomeText({ en: "Only English", ar: null }, "ar", "المدمج")).toBe("المدمج"); });
});
describe("fonts and sizes", () => {
  it("every size has a class for the headline and for the sub-headline", () => { for (const s of HOME_SIZES) { expect(HEADLINE_SIZE_CLASS[s]).toBeTruthy(); expect(SUBHEADLINE_SIZE_CLASS[s]).toBeTruthy(); } });
  it("the defaults are what the website looked like before sizes could be chosen", () => { expect(HEADLINE_SIZE_CLASS.large).toBe("text-[clamp(34px,4.6vw,56px)]"); expect(SUBHEADLINE_SIZE_CLASS.medium).toBe("text-lg"); });
  it("sizes only grow: small < medium < large < xlarge", () => { const px = (c: string) => Number(/clamp\((\d+)px/.exec(c)?.[1]); const list = HOME_SIZES.map((s) => px(HEADLINE_SIZE_CLASS[s])); expect([...list].sort((a, b) => a - b)).toEqual(list); });
  it("CRITICAL: the fonts and sizes the website knows are exactly the ones the shop accepts (it refuses any other)", () => {
    const source = readFileSync(join(__dirname, "../../../services/api/src/modules/platform-settings/homeText.js"), "utf8");
    const list = (name: string) => [...(new RegExp(`const ${name} = \\[([^\\]]*)\\]`).exec(source)?.[1] ?? "").matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(list("FONTS")).toEqual([...HOME_FONTS]); expect(list("SIZES")).toEqual([...HOME_SIZES]);
  });
});
