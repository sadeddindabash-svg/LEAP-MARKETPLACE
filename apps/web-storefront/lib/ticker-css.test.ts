import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The DIRECTION of the home page's moving line is the one thing that was specified exactly: English moves from right to left, Arabic from left to right. A browser is needed to
// see it move, so these read the stylesheet and fail if the rules that decide the direction are changed.
const css = readFileSync(join(__dirname, "../app/globals.css"), "utf-8");
const block = (selector: string) => {
  const start = css.indexOf(selector);
  if (start < 0) return "";
  return css.slice(start, css.indexOf("}", start) + 1);
};

describe("the announcement line's direction (stylesheet)", () => {
  it("CRITICAL: by default (English) the line moves RIGHT TO LEFT: from 0 to -50% of its two copies", () => {
    expect(block(".leap-ticker-track {")).toContain("animation: leap-ticker-rtl");
    expect(css).toMatch(/@keyframes leap-ticker-rtl \{ from \{ transform: translateX\(0\); \} to \{ transform: translateX\(-50%\); \} \}/);
  });
  it("CRITICAL: on the Arabic site the line moves LEFT TO RIGHT: from 0 to +50% (in a right-to-left row the second copy sits on the left)", () => {
    expect(block('.leap-ticker[data-lang="ar"] .leap-ticker-track')).toContain("animation-name: leap-ticker-ltr");
    expect(css).toMatch(/@keyframes leap-ticker-ltr \{ from \{ transform: translateX\(0\); \} to \{ transform: translateX\(50%\); \} \}/);
  });
  it("the loop is seamless by design: every copy is at least a screen wide, and the track moves by exactly half (one copy of two)", () => {
    expect(block(".leap-ticker-copy {")).toContain("min-width: 100vw");
    expect(block(".leap-ticker-track {")).toContain("width: max-content");
    expect(block(".leap-ticker-track {")).toContain("linear infinite");
  });
  it("it pauses under the pointer, and a visitor who asks for less motion gets a still list instead of the moving track", () => {
    expect(block(".leap-ticker:hover .leap-ticker-track")).toContain("animation-play-state: paused");
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)", css.indexOf(".leap-ticker-static")));
    expect(reduced).toMatch(/\.leap-ticker-track \{ display: none; \}/);
    expect(reduced).toMatch(/\.leap-ticker-static \{ display: flex;/);
    expect(block(".leap-ticker-static {")).toContain("display: none");               // hidden unless less motion is asked for
  });
});
