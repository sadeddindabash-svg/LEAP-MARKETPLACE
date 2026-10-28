"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A grid of tiles that shows ONE ROW and ends that row with a "More" tile; pressing it opens the whole list in place (and the same tile then says "Show fewer"). How many tiles make a row
 * depends on the screen, so the grid is measured and follows the screen as it changes. The tiles that are not shown are still in the page (hidden, not removed): a search engine reads
 * every section and brand, and a buyer who opens the list sees them at once.
 * `variant` is the look of the "More" tile, to go with the tiles: "classic" (a dashed card with an icon), "wide" (a dashed wide tile, the words only: with the section tiles), "round" (a dashed circle with the words under it: with the round brand photos).
 */
export default function TileRow({ children, moreLabel, fewerLabel, gridClassName, defaultColumns = 6, variant = "classic", maxCollapsed }: { children: ReactNode; moreLabel: string; fewerLabel: string; gridClassName: string; defaultColumns?: number; maxCollapsed?: number; variant?: "classic" | "wide" | "round" }) {
  const tiles = Children.toArray(children);
  const list = useRef<HTMLUListElement>(null);
  const [columns, setColumns] = useState(defaultColumns);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const measure = () => {
      const style = getComputedStyle(el);
      if (style.display !== "grid" || style.gridTemplateColumns === "none") return;        // no real grid to measure (or no layout at all, as in a test): keep the default
      const n = style.gridTemplateColumns.split(" ").filter(Boolean).length;
      if (n > 0) setColumns(n);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const watcher = new ResizeObserver(measure);
    watcher.observe(el);
    return () => watcher.disconnect();
  }, []);

  // maxCollapsed: show exactly that many tiles (e.g. 9 brands) whatever the width of the screen; without it the row shows one row of tiles, the last place being the More tile.
  const fits = maxCollapsed !== undefined ? tiles.length <= maxCollapsed : tiles.length <= columns;           // everything fits: no "More" tile
  const shown = fits || open ? tiles.length : maxCollapsed ?? columns - 1;
  const label = open ? fewerLabel : moreLabel;
  return (
    <ul ref={list} className={gridClassName}>
      {tiles.map((tile, i) => <li key={i} hidden={i >= shown}>{tile}</li>)}
      {!fits && (
        <li className={maxCollapsed !== undefined ? "col-span-3 sm:col-span-1" : undefined}>
          {variant === "wide" ? (
            <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} data-variant="wide" className="flex h-20 w-full items-center justify-center rounded-[14px] border border-dashed border-[#8696a2] px-3 text-center text-[14.5px] font-bold text-navy hover:border-signal sm:h-[104px] sm:text-[17px]">{label}</button>
          ) : variant === "round" ? (
            <>
            {maxCollapsed !== undefined && <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} data-variant="pill" className="flex h-12 w-full items-center justify-center gap-2.5 rounded-full border-[1.5px] border-dashed border-[#8696a2] text-[15px] font-bold text-navy hover:border-signal sm:hidden">{label}<span aria-hidden="true" className="text-xl leading-none">{open ? "−" : "···"}</span></button>}
            <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} data-variant="round" className={`group flex w-full flex-col items-center gap-3 p-1.5 text-center ${maxCollapsed !== undefined ? "max-sm:hidden" : ""}`}>
              <span aria-hidden="true" className="grid size-[76px] place-items-center rounded-full border-[1.5px] border-dashed border-[#8696a2] text-[26px] font-bold leading-none text-navy group-hover:border-signal sm:size-24">{open ? "−" : "···"}</span>
              <span className="w-full min-w-0 text-[15px] font-bold leading-tight text-navy sm:text-base">{label}</span>
            </button>
            </>
          ) : (
            <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex h-full min-h-[8.5rem] w-full flex-col items-center justify-center gap-2.5 rounded-[14px] border border-dashed border-[#8696a2] bg-white p-5 text-center text-base font-bold text-navy hover:border-signal">
              <span aria-hidden="true" className="grid size-16 place-items-center rounded-xl bg-[#e6edf2] text-2xl leading-none">{open ? "−" : "···"}</span>
              {label}
            </button>
          )}
        </li>
      )}
    </ul>
  );
}
