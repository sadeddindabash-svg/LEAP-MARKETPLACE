import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import TileRow from "./TileRow";

// One row of tiles and a "More" tile that opens the rest in place. (jsdom has no layout, so the row holds the default of 6 tiles: 5 shown and the "More" tile.)
const tiles = (n: number) => Array.from({ length: n }, (_, i) => <a key={i} href={`/s/${i}`}>Tile {i + 1}</a>);
const show = (n: number) => render(<TileRow moreLabel="More sections" fewerLabel="Show fewer" gridClassName="grid">{tiles(n)}</TileRow>);
const visible = () => screen.getAllByRole("link").map((a) => a.textContent);

describe("TileRow", () => {
  it("shows one row: the first tiles and a More tile at the end", () => {
    show(20);
    expect(visible()).toEqual(["Tile 1", "Tile 2", "Tile 3", "Tile 4", "Tile 5"]);
    expect(screen.getByRole("button", { name: /More sections/ })).toHaveAttribute("aria-expanded", "false");
  });
  it("the tiles that are not shown are still in the page, hidden (a search engine reads all of them)", () => {
    const { container } = show(20);
    expect(container.querySelectorAll("li")).toHaveLength(21);        // 20 tiles and the More tile
    expect(container.querySelectorAll("li[hidden]")).toHaveLength(15);
  });
  it("More opens the whole list in place, and the same tile then says Show fewer and closes it again", () => {
    show(20);
    fireEvent.click(screen.getByRole("button", { name: /More sections/ }));
    expect(visible()).toHaveLength(20);
    const fewer = screen.getByRole("button", { name: /Show fewer/ }); expect(fewer).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(fewer); expect(visible()).toHaveLength(5);
  });
  it("when everything fits in one row there is no More tile at all", () => {
    show(4);
    expect(visible()).toHaveLength(4); expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
