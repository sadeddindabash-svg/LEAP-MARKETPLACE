import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import HomeFontLink from "./HomeFontLink";

describe("HomeFontLink", () => {
  it("links to Google Fonts for the chosen fonts: one stylesheet, once", () => {
    const { container } = render(<HomeFontLink fonts={["poppins", "cairo", "poppins"]} />); const links = container.querySelectorAll('link[rel="stylesheet"]'); expect(links).toHaveLength(1); expect(links[0].getAttribute("href")).toBe("https://fonts.googleapis.com/css2?family=Poppins:wght@500;700&family=Cairo:wght@500;700&display=swap");
  });
  it("loads nothing when the page uses the website's own font", () => { for (const fonts of [[], [undefined], ["default", "default"]] as never[][]) { const { container, unmount } = render(<HomeFontLink fonts={fonts} />); expect(container.querySelector("link")).toBeNull(); unmount(); } });
});
