import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TileRow from "./TileRow";

// The tile row with maxCollapsed (the home "Shop by brand": 9 brands and More whatever the screen) and without it (the section tiles: one row, the last place being More, as before).
const tiles = (n: number) => Array.from({ length: n }, (_, i) => <a key={i} data-testid="t" href={`/${i}`}>T{i}</a>);
const row = (n: number, max?: number) => render(<TileRow variant="round" defaultColumns={6} maxCollapsed={max} gridClassName="grid" moreLabel="More brands" fewerLabel="Fewer brands">{tiles(n)}</TileRow>);
const visible = () => screen.getAllByTestId("t").filter((a) => !a.closest("li")!.hasAttribute("hidden")).length;

describe("with maxCollapsed", () => {
  it("shows exactly that many tiles and the More tile, whatever the measured number of columns", () => { const v = row(12, 9); expect(visible()).toBe(9); expect(v.container.querySelector('button[data-variant="round"]')).not.toBeNull(); });
  it("that many or fewer tiles: everything shown and no More tile; one more: the More tile", () => { for (const n of [3, 9]) { const v = row(n, 9); expect(visible()).toBe(n); expect(v.container.querySelector("button")).toBeNull(); v.unmount(); } row(10, 9); expect(visible()).toBe(9); expect(document.querySelector("button")).not.toBeNull(); });
  it("More opens every tile, the words become the Fewer ones, and it closes again", () => {
    const v = row(12, 9); const round = v.container.querySelector('button[data-variant="round"]')!; expect(round.getAttribute("aria-expanded")).toBe("false"); expect(round.textContent).toContain("More brands");
    fireEvent.click(round); expect(visible()).toBe(12); expect(round.getAttribute("aria-expanded")).toBe("true"); expect(round.textContent).toContain("Fewer brands"); fireEvent.click(round); expect(visible()).toBe(9);
  });
  it("on a phone the More tile is a wide button across the 3 columns (the round tile is hidden there, the wide one on bigger screens), and either opens the row", () => {
    const v = row(12, 9); const li = v.container.querySelector('button[data-variant="pill"]')!.closest("li")!; expect(li.className).toContain("col-span-3"); expect(li.className).toContain("sm:col-span-1");
    const pill = v.container.querySelector('button[data-variant="pill"]')!; const round = v.container.querySelector('button[data-variant="round"]')!; expect(pill.className).toContain("sm:hidden"); expect(round.className).toContain("max-sm:hidden"); expect(pill.textContent).toContain("More brands");
    fireEvent.click(pill); expect(visible()).toBe(12); expect(pill.textContent).toContain("Fewer brands"); expect(round.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("without maxCollapsed (the section tiles, and anything else): exactly as before", () => {
  it("one row of tiles, the last place being the More tile", () => { const v = row(12); expect(visible()).toBe(5); expect(v.container.querySelector('button[data-variant="pill"]')).toBeNull(); expect(v.container.querySelector("li:last-child")!.className).toBe(""); });
  it("everything fits in one row: no More tile", () => { row(6); expect(visible()).toBe(6); expect(document.querySelector("button")).toBeNull(); });
});
