import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PAGE_KEYS, PAGE_SLUGS, formatCopyright, pageText } from "./footerContent";

describe("the copyright line", () => {
  it("fills in the year, every time it appears", () => { expect(formatCopyright({ en: "© Leap {year} - all rights {year}", ar: null }, "en", 2027, "x")).toBe("© Leap 2027 - all rights 2027"); });
  it("is the website's own line when none is set (or only spaces, or only the other language)", () => {
    expect(formatCopyright(null, "en", 2026, "Own 2026")).toBe("Own 2026"); expect(formatCopyright({ en: "  ", ar: "x" }, "en", 2026, "Own")).toBe("Own"); expect(formatCopyright({ en: "English", ar: null }, "ar", 2026, "الخاص")).toBe("الخاص");
  });
});
describe("a page's text", () => {
  it("is in the visitor's language, or in the other one when there is none (never empty when the other language has text)", () => {
    expect(pageText({ en: "English", ar: "عربي" }, "ar")).toBe("عربي"); expect(pageText({ en: "English", ar: null }, "ar")).toBe("English"); expect(pageText({ en: "", ar: "عربي" }, "en")).toBe("عربي"); expect(pageText(null, "en")).toBe("");
  });
});
describe("the six pages", () => {
  it("CRITICAL: the keys and addresses are exactly the ones the shop uses", () => {
    const source = readFileSync(join(__dirname, "../../../services/api/src/modules/platform-settings/footer.js"), "utf8");
    const body = /const PAGES = \{([^}]*)\}/.exec(source)![1]; const pairs = [...body.matchAll(/(\w+): '([^']+)'/g)].map((m) => [m[1], m[2]]);
    expect(Object.fromEntries(pairs)).toEqual(PAGE_SLUGS); expect(pairs.map((p) => p[0])).toEqual([...PAGE_KEYS]);
  });
  it("each address has its own page folder in the storefront (and the old misspelled privacy address redirects)", () => {
    const folders = readdirSync(join(__dirname, "../app"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    for (const slug of Object.values(PAGE_SLUGS)) expect(folders, slug).toContain(slug); expect(folders).toContain("privecy-policy");
  });
});
