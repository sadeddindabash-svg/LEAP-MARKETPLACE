"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A grid of tiles that shows ONE ROW and ends that row with a "More" tile; pressing it opens the whole list in place (and the same tile then says "Show fewer"). How many tiles make a row
 * depends on the screen, so the grid is measured and follows the screen as it changes. The tiles that are not shown are still in the page (hidden, not removed): a search engine reads
 * every section and brand, and a buyer who opens the list sees them at once.
 * On a phone (under 768 px) the sections are square tiles, 4 per line, and the 4th is the More tile; `phoneCollapsed` shows that many tiles on a phone (7 brands: 4 per line, 2 lines, the 8th is More).
 * `variant` is the look of the "More" tile, to go with the tiles: "classic" (a dashed card with an icon), "wide" (a dashed wide tile, the words only: with the section tiles), "round" (a dashed circle with the words under it: with the round brand photos).
 */
export default function TileRow({ children, moreLabel, fewerLabel, gridClassName, defaultColumns = 6, variant = "classic", maxCollapsed, phoneCollapsed }: { children: ReactNode; moreLabel: string; fewerLabel: string; gridClassName: string; defaultColumns?: number; maxCollapsed?: number; phoneCollapsed?: number; variant?: "classic" | "wide" | "round" }) {
  const tiles = Children.toArray(children);
  const list = useRef<HTMLUListElement>(null);
  const [columns, setColumns] = useState(defaultColumns);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(false);      // under 768 px: phoneCollapsed applies

  useEffect(() => {
    if (phoneCollapsed === undefined || typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, [phoneCollapsed]);

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
  const limit = phone && phoneCollapsed !== undefined ? phoneCollapsed : maxCollapsed;
  const pillMode = maxCollapsed !== undefined && phoneCollapsed === undefined;      // the older phone look: a wide pill under 3 brands
  const fits = limit !== undefined ? tiles.length <= limit : tiles.length <= columns;           // everything fits: no "More" tile
  const shown = fits || open ? tiles.length : limit ?? columns - 1;
  const label = open ? fewerLabel : moreLabel;
  return (
    <ul ref={list} className={gridClassName}>
      {tiles.map((tile, i) => <li key={i} hidden={i >= shown}>{tile}</li>)}
      {!fits && (
        <li className={pillMode ? "col-span-3 sm:col-span-1" : undefined}>
          {variant === "wide" ? (
            // a phone: a dashed square with ··· and the words under it, the 4th tile of the line; from 768 px: the wide dashed tile with the words
            <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} data-variant="wide" className="flex w-full flex-col items-center gap-1.5 text-center text-[11.5px] font-bold leading-tight text-navy md:h-[104px] md:flex-row md:justify-center md:rounded-[14px] md:border md:border-dashed md:border-[#8696a2] md:px-3 md:text-[17px] md:hover:border-signal"><span aria-hidden="true" className="grid aspect-square w-full place-items-center rounded-[14px] border-[1.5px] border-dashed border-[#8696a2] bg-white text-xl leading-none md:hidden">{open ? "−" : "···"}</span>{label}</button>
          ) : variant === "round" ? (
            <>
            {pillMode && <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} data-variant="pill" className="flex h-12 w-full items-center justify-center gap-2.5 rounded-full border-[1.5px] border-dashed border-[#8696a2] text-[15px] font-bold text-navy hover:border-signal sm:hidden">{label}<span aria-hidden="true" className="text-xl leading-none">{open ? "−" : "···"}</span></button>}
            <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} data-variant="round" className={`group flex w-full flex-col items-center gap-2 p-1 text-center md:gap-3 md:p-1.5 ${pillMode ? "max-sm:hidden" : ""}`}>
              <span aria-hidden="true" className="grid size-[60px] place-items-center rounded-full border-[1.5px] border-dashed border-[#8696a2] text-[22px] font-bold leading-none text-navy group-hover:border-signal min-[400px]:size-[68px] md:size-24 md:text-[26px]">{open ? "−" : "···"}</span>
              <span className="w-full min-w-0 text-[12px] font-bold leading-tight text-navy md:text-base">{label}</span>
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
