import { describe, it, expect } from "vitest";
import { homeFontHref, GOOGLE_FONT } from "./homeFontLinks";
import { homeFontStyle } from "./homeFonts";
import { HOME_FONTS } from "./homeText";

// The home page fonts: which address a page links to, and the style it gives the text.
describe("the link to Google Fonts", () => {
  it("is nothing for the website's own font, for no font, and for an unknown one", () => {
    expect(homeFontHref([])).toBeNull(); expect(homeFontHref([undefined, undefined])).toBeNull(); expect(homeFontHref(["default", "default"])).toBeNull(); expect(homeFontHref(["comic-sans" as never])).toBeNull();
  });
  it("is one address with the font that is used (weights 500 and 700, text visible at once)", () => { expect(homeFontHref(["poppins", "default"])).toBe("https://fonts.googleapis.com/css2?family=Poppins:wght@500;700&display=swap"); });
  it("lists two different fonts once each, and one font used twice only once", () => {
    expect(homeFontHref(["poppins", "cairo"])).toBe("https://fonts.googleapis.com/css2?family=Poppins:wght@500;700&family=Cairo:wght@500;700&display=swap"); expect(homeFontHref(["inter", "inter"])).toBe("https://fonts.googleapis.com/css2?family=Inter:wght@500;700&display=swap");
  });
  it("every font an admin can choose has an address and a style (so none can be chosen and then do nothing)", () => {
    for (const f of HOME_FONTS.filter((x) => x !== "default")) { expect(homeFontHref([f]), f).toContain(`family=${GOOGLE_FONT[f as keyof typeof GOOGLE_FONT].family}:`); expect(homeFontStyle(f)?.fontFamily, f).toContain(`"${GOOGLE_FONT[f as keyof typeof GOOGLE_FONT].family}"`); }
    expect(Object.keys(GOOGLE_FONT).sort()).toEqual(HOME_FONTS.filter((x) => x !== "default").sort());
  });
});
describe("the style of the text", () => {
  it("nothing for the website's own font; otherwise the font, then the website's Arabic font, then any sans-serif", () => {
    expect(homeFontStyle(undefined)).toBeUndefined(); expect(homeFontStyle("default")).toBeUndefined(); expect(homeFontStyle("tajawal" as never)).toEqual({ fontFamily: '"Tajawal", var(--font-arabic), sans-serif' }); expect(homeFontStyle("nonsense" as never)).toBeUndefined();
  });
});
