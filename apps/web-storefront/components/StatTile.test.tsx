import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// One of the four totals at the top of the home page: a gold tile filled edge to edge.
vi.mock("@/lib/api", () => ({ resolveImageUrl: (u: string) => `https://api.example.com${u}` }));
import StatTile from "./StatTile";

const PATHS = ["M21 8 12 3 3 8v8l9 5 9-5V8Z", "m3 8 9 5 9-5M12 13v8"];
const show = (picture?: string | null) => render(<ul><StatTile n="1,284" label="Parts" paths={PATHS} picture={picture} /></ul>);
describe("the gold total tile", () => {
  it("is 92 px high, filled with gold from edge to edge (no white), with the big navy number and the label", () => {
    show(); const tile = screen.getByTestId("stat-tile"); for (const c of ["h-[92px]", "bg-gradient-to-br", "from-[#ffc83d]", "to-[#f4a400]", "overflow-hidden", "rounded-[14px]"]) expect(tile.className.split(" "), c).toContain(c); expect(tile.className).not.toContain("bg-white");
    expect(screen.getByText("1,284").className).toContain("text-navy"); expect(screen.getByText("1,284").tagName).toBe("B"); expect(screen.getByText("Parts")).toBeInTheDocument();
  });
  it("without a picture: a huge faint icon is part of the tile (decoration, at the end side, so it mirrors in Arabic), drawn from the given shapes", () => {
    show(); const icon = screen.getByTestId("stat-tile-icon"); expect(icon.getAttribute("aria-hidden")).toBe("true"); expect(icon.querySelectorAll("path")).toHaveLength(2); for (const c of ["absolute", "-end-2", "opacity-[0.17]", "text-navy"]) expect(icon.getAttribute("class")!.split(" "), c).toContain(c); expect(screen.queryByRole("img", { hidden: true })).toBeNull();
  });
  it("with a picture the picture fills the tile under a gold wash (and the icon is not drawn)", () => {
    const { container } = show("/uploads/p.jpg"); const img = container.querySelector("img")!; expect(img.getAttribute("src")).toBe("https://api.example.com/uploads/p.jpg"); expect(img.getAttribute("alt")).toBe(""); expect(img.className).toContain("object-cover"); expect(img.className).toContain("inset-0");
    expect(screen.queryByTestId("stat-tile-icon")).not.toBeInTheDocument(); const wash = container.querySelector("span.bg-gradient-to-r")!; expect(wash.className).toContain("rtl:bg-gradient-to-l"); expect(wash.className).toContain("from-[#fab219]/95");
  });
  it("the text sits above the picture and the wash", () => { show("/uploads/p.jpg"); expect(screen.getByText("1,284").closest("span.relative")).not.toBeNull(); });
});
