import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SITE_FONTS_HREF, SITE_FONT_VARS } from "./siteFonts";

// The website's own fonts, as links.
describe("the website's fonts", () => {
  it("one Google Fonts address with the three families and the weights the site uses, text visible at once", () => {
    const url = new URL(SITE_FONTS_HREF); expect(url.origin + url.pathname).toBe("https://fonts.googleapis.com/css2"); expect(url.searchParams.getAll("family")).toEqual(["Outfit:wght@400;500;600;700;800", "IBM Plex Sans Arabic:wght@400;500;600;700", "JetBrains Mono:wght@500;600;700"]); expect(url.searchParams.get("display")).toBe("swap");
  });
  it("CRITICAL: every font variable the stylesheet uses (--font-outfit, --font-arabic, --font-jetbrains-mono) is defined, with the right family", () => {
    const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8"); const used = [...new Set([...css.matchAll(/var\((--font-[a-z-]+)\)/g)].map((m) => m[1]))].filter((v) => !["--font-display", "--font-body", "--font-plate"].includes(v)).sort();
    expect(used).toEqual(Object.keys(SITE_FONT_VARS).sort()); expect(SITE_FONT_VARS).toEqual({ "--font-outfit": '"Outfit"', "--font-arabic": '"IBM Plex Sans Arabic"', "--font-jetbrains-mono": '"JetBrains Mono"' });
  });
  it("the home page fonts use the same Arabic family as the site (their fallback names the same variable)", () => { expect(Object.keys(SITE_FONT_VARS)).toContain("--font-arabic"); });
});
