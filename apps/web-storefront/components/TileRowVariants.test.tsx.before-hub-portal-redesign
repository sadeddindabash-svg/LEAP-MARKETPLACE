import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TileRow from "./TileRow";

// The More tile goes with the tiles: a wide dashed tile (sections), a dashed circle with the words under it (brands), or the old dashed card. With no real grid to measure (a test) the row falls back to its default number of columns.
const tiles = (n: number) => Array.from({ length: n }, (_, i) => <a key={i} href={`/t${i}`}>Tile {i}</a>);
const row = (variant: "classic" | "wide" | "round" | undefined, n = 8, defaultColumns = 4) => render(<TileRow variant={variant} defaultColumns={defaultColumns} gridClassName="grid" moreLabel="More things" fewerLabel="Show fewer">{tiles(n)}</TileRow>);
const more = () => screen.getByRole("button", { name: /More things|Show fewer/ });
describe("the More tile", () => {
  it("wide: a dashed wide tile with the words only (no icon box), as tall as a section tile", () => {
    row("wide"); expect(more().getAttribute("data-variant")).toBe("wide"); expect(more().textContent).toBe("More things"); for (const c of ["border-dashed", "h-20", "sm:h-[104px]", "rounded-[14px]"]) expect(more().className.split(" "), c).toContain(c); expect(more().querySelector("span")).toBeNull();
  });
  it("round: a dashed circle with ··· in it and the words under it", () => { row("round"); expect(more().getAttribute("data-variant")).toBe("round"); const circle = more().querySelector("span")!; expect(circle.textContent).toBe("···"); for (const c of ["rounded-full", "border-dashed", "size-[76px]", "sm:size-24"]) expect(circle.className.split(" "), c).toContain(c); expect(more().textContent).toBe("···More things"); });
  it("classic (the default): the dashed card with the icon box, as before", () => { row(undefined); expect(more().getAttribute("data-variant")).toBeNull(); expect(more().className).toContain("min-h-[8.5rem]"); expect(more().querySelector("span")!.className).toContain("size-16"); });
  it("shows one row less one (the More tile takes the last place), and the rest are in the page but hidden", () => {
    const { container } = row("wide", 8, 4); const items = [...container.querySelectorAll("ul > li")]; expect(items).toHaveLength(9); expect(items.slice(0, 3).every((li) => !li.hasAttribute("hidden"))).toBe(true); expect(items.slice(3, 8).every((li) => li.hasAttribute("hidden"))).toBe(true);
  });
  it("opens everything in place and then says Show fewer; in all three looks", () => {
    for (const v of ["wide", "round", "classic"] as const) { const view = row(v); fireEvent.click(more()); expect(more().textContent).toContain("Show fewer"); expect(more().getAttribute("aria-expanded")).toBe("true"); expect(view.container.querySelectorAll("ul > li[hidden]")).toHaveLength(0); fireEvent.click(more()); expect(more().textContent).toContain("More things"); view.unmount(); }
  });
  it("round shows a minus in its circle when open", () => { row("round"); fireEvent.click(more()); expect(more().querySelector("span")!.textContent).toBe("−"); });
  it("no More tile when everything fits in one row", () => { row("wide", 4, 4); expect(screen.queryByRole("button")).not.toBeInTheDocument(); });
});
