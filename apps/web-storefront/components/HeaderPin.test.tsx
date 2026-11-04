import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import HeaderPin from "./HeaderPin";

// The header stays on top while scrolling (computer screens): HeaderPin measures it for the things that stay under it, and marks it once the page is scrolled.
afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

describe("the header that stays on top", () => {
  it("CRITICAL: is marked scrolled past 120 px, and unmarked only back under 40 px (so it cannot flicker at one spot)", () => {
    document.body.innerHTML = '<header data-pin=""><div data-topbar=""></div></header>';
    render(<HeaderPin />);
    const header = document.querySelector("header")!;
    const scrollTo = (y: number) => { Object.defineProperty(window, "scrollY", { value: y, configurable: true }); window.dispatchEvent(new Event("scroll")); };
    scrollTo(100); expect(header.dataset.scrolled).toBeUndefined();
    scrollTo(130); expect(header.dataset.scrolled).toBe("true");
    scrollTo(60); expect(header.dataset.scrolled).toBe("true");
    scrollTo(30); expect(header.dataset.scrolled).toBe("false");
  });
  it("tells the page how tall the part that stays is (0 when the header does not stay, as on a phone)", () => {
    document.body.innerHTML = '<header data-pin=""><div data-topbar=""></div></header>';
    render(<HeaderPin />);
    expect(document.documentElement.style.getPropertyValue("--header-h")).toBe("0px");
    expect(document.documentElement.style.getPropertyValue("--topbar-h")).toBe("0px");
  });
});
