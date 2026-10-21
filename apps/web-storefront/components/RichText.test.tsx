import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import RichText from "./RichText";
import { LangProvider } from "./LangProvider";

const show = (source: string) => render(<LangProvider lang="en"><RichText source={source} /></LangProvider>).container;
describe("RichText", () => {
  it("draws headings, paragraphs with line breaks, lists, bold and links", () => {
    const c = show("## Who we are\nWe sell **real** parts.\nLine two\n\n- one\n- two\n\n1. first\n2. second\n\n### Contact\n[Write to us](mailto:info@leap.dev)");
    expect(c.querySelector("h2")!.textContent).toBe("Who we are"); expect(c.querySelector("h3")!.textContent).toBe("Contact"); expect(c.querySelector("strong")!.textContent).toBe("real"); expect(c.querySelectorAll("p br")).toHaveLength(1);
    expect(c.querySelectorAll("ul > li")).toHaveLength(2); expect(c.querySelectorAll("ol > li")).toHaveLength(2); expect(c.querySelector("a")!.getAttribute("href")).toBe("mailto:info@leap.dev");
  });
  it("a link to another website opens in a new tab without giving it access to this one; a mail link does not", () => {
    const c = show("[Site](https://example.com) and [mail](mailto:a@b.com)"); const [web, mail] = [...c.querySelectorAll("a")];
    expect(web.getAttribute("target")).toBe("_blank"); expect(web.getAttribute("rel")).toBe("noopener noreferrer"); expect(mail.getAttribute("target")).toBeNull();
  });
  it("a link to a page of this website stays in the tab", () => { const a = show("[Refund](/refund-policy)").querySelector("a")!; expect(a.getAttribute("href")).toBe("/refund-policy"); expect(a.getAttribute("target")).toBeNull(); });
  it("SAFETY: script, HTML and javascript: links never become elements: they are shown as letters", () => {
    const c = show("<script>alert(1)</script>\n\n[click](javascript:alert(1))\n\n<img src=x onerror=alert(1)>");
    expect(c.querySelector("script, img")).toBeNull(); expect(c.querySelector("a")).toBeNull(); expect(c.textContent).toContain("<script>alert(1)</script>"); expect(c.textContent).toContain("click"); expect(c.innerHTML).not.toContain("javascript:");
  });
  it("nothing in, nothing out", () => { expect(show("").textContent).toBe(""); });
});
