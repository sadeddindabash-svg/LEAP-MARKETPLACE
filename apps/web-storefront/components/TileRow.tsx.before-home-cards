"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A grid of tiles that shows ONE ROW and ends that row with a "More" tile; pressing it opens the whole list in place (and the same tile then says "Show fewer"). How many tiles make a row
 * depends on the screen, so the grid is measured and follows the screen as it changes. The tiles that are not shown are still in the page (hidden, not removed): a search engine reads
 * every section and brand, and a buyer who opens the list sees them at once.
 */
export default function TileRow({ children, moreLabel, fewerLabel, gridClassName, defaultColumns = 6 }: { children: ReactNode; moreLabel: string; fewerLabel: string; gridClassName: string; defaultColumns?: number }) {
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

  const fits = tiles.length <= columns;           // everything fits in one row: no "More" tile
  const shown = fits || open ? tiles.length : columns - 1;
  return (
    <ul ref={list} className={gridClassName}>
      {tiles.map((tile, i) => <li key={i} hidden={i >= shown}>{tile}</li>)}
      {!fits && (
        <li>
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex h-full min-h-[8.5rem] w-full flex-col items-center justify-center gap-2.5 rounded-[14px] border border-dashed border-[#8696a2] bg-white p-5 text-center text-base font-bold text-navy hover:border-signal">
            <span aria-hidden="true" className="grid size-16 place-items-center rounded-xl bg-[#e6edf2] text-2xl leading-none">{open ? "−" : "···"}</span>
            {open ? fewerLabel : moreLabel}
          </button>
        </li>
      )}
    </ul>
  );
}
