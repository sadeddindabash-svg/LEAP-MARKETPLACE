import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import CountryFlag from "./CountryFlag";
import type { FlagCode } from "@/lib/countryFlags";

// Each flag is a small picture of its own (no emoji), 21 x 14, hidden from screen readers (the country's name is written beside it).
const ALL: FlagCode[] = ["CN", "JP", "DE", "FR", "IT", "AE", "TR", "VN", "TH", "IN", "US", "GB"];
const fills = (code: FlagCode) => [...render(<CountryFlag code={code} />).container.querySelectorAll("[fill]")].map((e) => (e.getAttribute("fill") ?? "").toLowerCase());
describe("the flags", () => {
  it("every flag draws a picture of the right size, as decoration, with its code", () => { for (const code of ALL) { const { container } = render(<CountryFlag code={code} />); const svg = container.querySelector("svg")!; expect(svg.getAttribute("aria-hidden"), code).toBe("true"); expect(svg.getAttribute("data-flag")).toBe(code); expect(svg.getAttribute("width")).toBe("21"); expect(svg.getAttribute("height")).toBe("14"); expect(svg.getAttribute("viewBox")).toBe("0 0 30 20"); expect(svg.querySelectorAll("rect, circle, path").length, code).toBeGreaterThan(1); } });
  it("China is red with five yellow stars", () => { const { container } = render(<CountryFlag code="CN" />); expect(fills("CN")).toContain("#de2910"); expect(fills("CN")).toContain("#ffde00"); expect(container.querySelectorAll('g[fill="#ffde00"] path')).toHaveLength(5); });
  it("the colours of the others are the national ones", () => {
    expect(fills("JP")).toEqual(expect.arrayContaining(["#fff", "#bc002d"])); expect(fills("DE")).toEqual(expect.arrayContaining(["#000", "#dd0000", "#ffce00"])); expect(fills("FR")).toEqual(expect.arrayContaining(["#0055a4", "#ef4135"])); expect(fills("IT")).toEqual(expect.arrayContaining(["#009246", "#ce2b37"]));
    expect(fills("AE")).toEqual(expect.arrayContaining(["#00732f", "#f00"])); expect(fills("TR")).toEqual(expect.arrayContaining(["#e30a17", "#fff"])); expect(fills("VN")).toEqual(expect.arrayContaining(["#da251d", "#ff0"])); expect(fills("IN")).toEqual(expect.arrayContaining(["#f93", "#138808"])); expect(fills("US")).toEqual(expect.arrayContaining(["#b22234", "#3c3b6e"])); expect(fills("GB")).toContain("#012169");
  });
  it("the United States has 7 red stripes of its 13 and 20 stars; each flag is clipped to its own box", () => { const { container } = render(<CountryFlag code="US" />); expect(container.querySelectorAll('rect[fill="#b22234"]')).toHaveLength(7); expect(container.querySelectorAll('circle[fill="#fff"]')).toHaveLength(20); expect(container.querySelector("svg")!.getAttribute("overflow")).toBe("hidden"); });
});
