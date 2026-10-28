import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The stylesheet and the fonts: the chips and the Shopping for box use the page font (the description's font, English and Arabic); every h1/h2 at the big size is 20 px. These read the source text, so no browser is needed
// (the real sizes and fonts are checked in a browser: see docs/UI-ROUND3.md).
const root = join(__dirname, "..");
const css = readFileSync(join(root, "app/globals.css"), "utf8");
const block = (selector: string) => { const i = css.indexOf(selector + " {"); expect(i, selector).toBeGreaterThan(-1); return css.slice(i, css.indexOf("}", i)); };

describe("the part-class and fitment chips", () => {
  it("use the page font (--font-body: Outfit and IBM Plex Sans Arabic), not the typewriter font that has no Arabic", () => { const b = block(".plate-chip"); expect(b).toContain("font-family: var(--font-body)"); expect(b).not.toContain("--font-plate"); expect(b).not.toContain("monospace"); });
  it("are 13 px semi-bold with no letter spacing (letter spacing breaks Arabic letters apart)", () => { const b = block(".plate-chip"); expect(b).toMatch(/font-size:\s*13px/); expect(b).toMatch(/font-weight:\s*600/); expect(b).toMatch(/letter-spacing:\s*0;/); });
  it("keep their frame (border, radius, padding) and stay on one line", () => { const b = block(".plate-chip"); expect(b).toContain("border: 1.5px solid"); expect(b).toContain("border-radius: 6px"); expect(b).toContain("white-space: nowrap"); });
});
describe("the Shopping for box", () => {
  it("the vehicle name uses the page font (no font-plate) in both languages, 13 px semi-bold", () => { const s = readFileSync(join(root, "components/VehicleBar.tsx"), "utf8"); const line = s.split("\n").find((l) => l.includes("bg-navy px-2 py-0.5"))!; expect(line).toBeTruthy(); expect(line).not.toContain("font-plate"); expect(line).toContain("text-[13px] font-semibold"); });
});
describe("titles", () => {
  it("every h1/h2 set at the big size (text-3xl) is 1.25rem / 1.75rem, with no negative letter spacing: the size of \"Find parts for your car\"", () => { const b = block(":is(h1, h2).text-3xl"); expect(b).toMatch(/font-size:\s*1\.25rem/); expect(b).toMatch(/line-height:\s*1\.75rem/); expect(b).toMatch(/letter-spacing:\s*normal/); });
  it("only headings are touched (a referral code or an order number set at the big size is not)", () => { expect(css).toContain(":is(h1, h2).text-3xl"); expect(css).not.toMatch(/(^|\n)\.text-3xl\s*\{/); });
  it("\"Find parts for your car\" is text-xl: the size the others become", () => { const s = readFileSync(join(root, "components/HeroPicker.tsx"), "utf8"); expect(s).toContain('<h2 className="mb-4 text-xl font-bold">{t("picker_title")}</h2>'); });
  it("the product name (text-4xl) and the smaller titles are not in the rule", () => { expect(block(":is(h1, h2).text-3xl")).not.toContain("text-4xl"); });
});
