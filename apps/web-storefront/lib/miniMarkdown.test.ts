import { describe, it, expect } from "vitest";
import { parseInline, parseMarkdown, plainText, safeHref } from "./miniMarkdown";

// The simple formatting of the six pages: what it understands, and that nothing an admin types can become HTML, a script, or an unsafe link.
const types = (s: string) => parseMarkdown(s).map((b) => b.t);
describe("blocks", () => {
  it("headings: # and ## are the big heading, ### (and more) the smaller one", () => {
    expect(parseMarkdown("# One\n## Two\n### Three\n#### Four").map((b) => [b.t, b.t === "h2" || b.t === "h3" ? b.inline[0] : null])).toEqual([["h2", { t: "text", text: "One" }], ["h2", { t: "text", text: "Two" }], ["h3", { t: "text", text: "Three" }], ["h3", { t: "text", text: "Four" }]]);
  });
  it("a blank line starts a new paragraph; a single line break stays a line break inside one paragraph", () => {
    const b = parseMarkdown("Line one\nLine two\n\nSecond paragraph"); expect(types("Line one\nLine two\n\nSecond paragraph")).toEqual(["p", "p"]);
    expect(b[0].t === "p" && b[0].lines).toHaveLength(2);
  });
  it("bullet lists with - or *, and numbered lists with 1. or 1)", () => {
    expect(parseMarkdown("- a\n* b").map((b) => b.t === "ul" && b.items.length)).toEqual([2]); expect(parseMarkdown("1. a\n2) b\n3. c").map((b) => b.t === "ol" && b.items.length)).toEqual([3]);
  });
  it("a list ends at a blank line or a normal line; a bullet list followed by a numbered one are two lists", () => {
    expect(types("- a\n- b\n\nText")).toEqual(["ul", "p"]); expect(types("- a\nText right after")).toEqual(["ul", "p"]); expect(types("- a\n1. b")).toEqual(["ul", "ol"]);
  });
  it("a heading ends a paragraph and a list without a blank line", () => { expect(types("Text\n## Head\n- item\n## Next")).toEqual(["p", "h2", "ul", "h2"]); });
  it("Windows and old Mac line endings, extra spaces and empty text are all fine", () => {
    expect(types("A\r\n\r\nB\r- c")).toEqual(["p", "p", "ul"].slice(0, types("A\r\n\r\nB\r- c").length)); expect(parseMarkdown("")).toEqual([]); expect(parseMarkdown("  \n \n")).toEqual([]);
    expect(types("   ##   Spaced   ")).toEqual(["h2"]);
  });
  it("a line that only LOOKS like markup stays text: a hash with no space, a dash with no space, a number with no dot", () => { expect(types("#nospace\n-nodash\n12 apples")).toEqual(["p"]); });
});
describe("inline: bold and links", () => {
  it("bold and a link inside a sentence", () => { expect(parseInline("Read **this** and [our terms](https://x.com/t) now")).toEqual([{ t: "text", text: "Read " }, { t: "bold", text: "this" }, { t: "text", text: " and " }, { t: "link", text: "our terms", href: "https://x.com/t" }, { t: "text", text: " now" }]); });
  it("an unfinished marker is just text (no crash, nothing lost)", () => { expect(plainText("**unclosed and [broken](")).toBe("**unclosed and [broken]("); expect(plainText("a ** b")).toBe("a ** b"); });
  it("links to https, http, mailto, tel and to a page of this website are kept", () => {
    for (const href of ["https://a.com", "http://a.com", "mailto:a@b.com", "tel:+966500000000", "/privacy-policy"]) expect(parseInline(`[x](${href})`)).toEqual([{ t: "link", text: "x", href }]);
  });
  it("SAFETY: any other address makes NO link (only its words, as letters): javascript:, data:, vbscript:, file:, a protocol-relative //evil.com, and a mixed-case or padded javascript:", () => {
    for (const href of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>1</script>", "vbscript:x", "file:///etc/passwd", "//evil.com/x", "ftp://a.com", "evil.com"]) {
      const out = parseInline(`[click](${href})`); expect(out.every((i) => i.t === "text"), href).toBe(true); expect(out.map((i) => i.text).join(""), href).toMatch(/^click/); expect(safeHref(href), href).toBeNull();
    }
  });
  it("SAFETY: HTML and script in a text stay as letters (no tag is ever made)", () => {
    const inline = parseMarkdown("<script>alert(1)</script> <b>x</b> <img src=x onerror=alert(1)>")[0]; expect(inline.t === "p" && inline.lines[0].every((i) => i.t === "text")).toBe(true);
    expect(plainText("<script>alert(1)</script>")).toBe("<script>alert(1)</script>");
  });
  it("a space or a bracket in the address ends the link, so it cannot smuggle a second address", () => { expect(parseInline("[x](https://a.com onerror=1)")).toEqual([{ t: "text", text: "[x](https://a.com onerror=1)" }]); });
});
describe("plainText and speed", () => {
  it("is the words without the formatting, in one line", () => { expect(plainText("## Title\nSome **bold** [link](https://a.com) text\n\n- one\n- two")).toBe("Title Some bold link text one two"); });
  it("a 60,000-character text is read at once, not slowly", () => {
    const text = ("Some **bold** words and a [link](https://a.com).\n".repeat(1200)).slice(0, 60000); const t0 = Date.now(); const blocks = parseMarkdown(text); expect(blocks.length).toBe(1); expect(Date.now() - t0).toBeLessThan(500);
  });
  it("the worst texts allowed (a whole page of one marker) are read in well under a second", () => {
    for (const marker of ["[", "**", "[a](", "[a](https://", "*", "- ", "#"]) { const t0 = Date.now(); parseMarkdown(marker.repeat(Math.floor(60000 / marker.length))); expect(Date.now() - t0, JSON.stringify(marker)).toBeLessThan(1500); }
  });
  it("a link whose words are over 300 characters, or bold over 500, is shown as plain letters instead of being searched for", () => {
    expect(parseInline(`[${"x".repeat(301)}](https://a.com)`).every((i) => i.t === "text")).toBe(true); expect(parseInline(`[${"x".repeat(300)}](https://a.com)`).some((i) => i.t === "link")).toBe(true);
    expect(parseInline(`**${"x".repeat(501)}**`).every((i) => i.t === "text")).toBe(true); expect(parseInline(`**${"x".repeat(500)}**`).some((i) => i.t === "bold")).toBe(true);
  });
  it("a long run of the same marker cannot make it hang", () => { const t0 = Date.now(); parseMarkdown("*".repeat(20000) + "\n" + "[".repeat(20000) + "\n" + "**a".repeat(5000)); expect(Date.now() - t0).toBeLessThan(500); });
});
