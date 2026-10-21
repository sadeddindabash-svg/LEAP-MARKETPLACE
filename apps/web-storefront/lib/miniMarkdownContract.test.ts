import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseInline, parseMarkdown, safeHref } from "./miniMarkdown";

// The admin portal shows a PREVIEW of a page using its own copy of the text formatter; the website draws the real page with this one. If the two ever read a text differently, the preview would lie, so both read every one
// of these texts and must agree exactly (including the attack texts).
const CORPUS = [
  "", "   \n\n  ", "Plain text", "## Heading\nSome text\n\n### Smaller\n#### Even smaller", "# One hash", "#nospace", "- a\n- b\n* c\n\n1. x\n2) y\n3. z", "- a\n1. b\n- c", "Text\n## Head\n- item\n## Next",
  "Line one\nLine two\n\nSecond", "Read **this** and [our terms](https://x.com/t) now", "**unclosed and [broken](", "a ** b", "[x](https://a.com onerror=1)", "[a](/privacy-policy) [b](mailto:a@b.com) [c](tel:+966500000000) [d](http://e.com)",
  "[click](javascript:alert(1))", "[click](JaVaScRiPt:alert(1))", "[click](data:text/html,<script>1</script>)", "[click](//evil.com)", "[click](ftp://a.com)", "[click](vbscript:x)", "[click](evil.com)",
  "<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>", "A\r\n\r\nB\r- c", "**bold** **bold2** [l](https://a.com)**after**", `[${"x".repeat(300)}](https://a.com)`, `[${"x".repeat(301)}](https://a.com)`, `**${"y".repeat(500)}**`, `**${"y".repeat(501)}**`, "- **bold item**\n- [link item](https://a.com)", "    ## indented heading", "عنوان\n## القواعد\n- بند ١\n**مهم**",
];
describe("the admin's preview reads texts exactly as the website does", () => {
  it("every text in the list, including the attack texts, gives the same blocks", () => {
    // The admin's file is read as text and run as it is (the test runner of this website does not import files of another project).
    const source = readFileSync(join(__dirname, "../../admin-dashboard/src/miniMarkdown.js"), "utf8").replace(/^export /gm, "");
    const admin = new Function(`${source}\nreturn { safeHref, parseInline, parseMarkdown };`)() as { safeHref: typeof safeHref; parseInline: typeof parseInline; parseMarkdown: typeof parseMarkdown };
    for (const text of CORPUS) { expect(admin.parseMarkdown(text), JSON.stringify(text)).toEqual(parseMarkdown(text)); expect(admin.parseInline(text), JSON.stringify(text)).toEqual(parseInline(text)); }
    for (const href of ["https://a.com", "javascript:x", "/ok", "//no", "mailto:a@b.c", " tel:1 ", "data:x"]) expect(admin.safeHref(href), href).toEqual(safeHref(href));
  });
});
