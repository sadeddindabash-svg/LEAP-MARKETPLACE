"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "@/components/LocLink";
import ProductCard from "@/components/ProductCard";
import type { ProductSummary } from "@/lib/api";
import { gridQuery, type GridSource } from "@/lib/gridSource";
import { clearGrid, justWentBack, loadGrid, saveGrid } from "@/lib/gridMemory";
import { useLang, useT } from "./LangProvider";

/** A message this component wrote for the buyer (anything else that goes wrong is shown as the plain "couldn't load", never as technical text). */
class ShownError extends Error {}

interface Props {
  /** Tells apart two grids on one page (the product page has two). */
  id: string;
  source: GridSource;
  /** The first page, drawn on the server: it is in the page's HTML (search engines read it) and is on screen at once. */
  initial: ProductSummary[];
  /** How many products the whole list has, when the shop says (null when it does not: then a full page means there may be more). */
  total: number | null;
  /** The page `initial` is (a link to ?page=3 starts there). */
  startPage?: number;
  pageSize: number;
  /** One product to leave out of the list (the product page does not list itself). It still counts as received. */
  hiddenId?: string;
  /** Load at most this many pages after the first, then offer `seeAllHref`: for the two small lists at the bottom of a product page, which must not swallow the footer. */
  maxExtraPages?: number;
  seeAllHref?: string;
  gridClassName: string;
}

/**
 * A list of product cards that loads the NEXT page by itself as the buyer scrolls near the bottom: no button. The first page comes from the server; later pages come from the
 * website's own door (app/api/products), one request at a time, 800 px before the buyer would reach the end, so they rarely wait.
 *  - a product already shown is never added twice;
 *  - it knows when the list has ended (the shop's total, or a page that is not full) and stops asking;
 *  - a failure shows a message and "Try again" (nothing is lost, nothing loops);
 *  - when the buyer opens a product and comes BACK, the parts already loaded and the place on the page return (lib/gridMemory.ts);
 *  - a screen reader is told how many parts are shown, and can skip the list to the footer;
 *  - without JavaScript the page still has its first page and, on the search page, ordinary Previous/Next links.
 */
export default function InfiniteProductGrid({ id, source, initial, total, startPage = 1, pageSize, hiddenId, maxExtraPages, seeAllHref, gridClassName }: Props) {
  const lang = useLang();
  const t = useT();
  const [items, setItems] = useState(() => initial.filter((p) => p.id !== hiddenId));
  const [received, setReceived] = useState((startPage - 1) * pageSize + initial.length);      // products the shop has SENT (before any is hidden)
  const [nextPage, setNextPage] = useState(startPage + 1);
  const [lastPageSize, setLastPageSize] = useState(initial.length);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [problem, setProblem] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const done = total !== null ? received >= total : lastPageSize < pageSize;
  const extraLoaded = nextPage - startPage - 1;
  const capped = maxExtraPages !== undefined && extraLoaded >= maxExtraPages;

  const sentinel = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const scrollY = useRef(0);
  const frozen = useRef(false);                  // the place is fixed from the moment a product is clicked: the page scrolls to the top while it navigates, and that must not become 'where the buyer was'
  const persist = useRef<() => void>(() => {});
  const latest = useRef({ items, received, nextPage, lastPageSize, canLoad: false });
  const loader = useRef<() => void>(() => {});
  useEffect(() => { latest.current = { items, received, nextPage, lastPageSize, canLoad: !done && !capped && status === "idle" }; });

  const loadNext = useCallback(async () => {
    if (inFlight.current) return;                                                  // one request at a time, however often the browser says "visible"
    inFlight.current = true;
    setStatus("loading"); setProblem("");
    const controller = new AbortController();
    abort.current = controller;
    const page = latest.current.nextPage;
    try {
      const res = await fetch(`/api/products?${gridQuery(source, page, pageSize, lang)}`, { signal: controller.signal });
      if (res.status === 429) throw new ShownError(t("grid_slow_down"));
      if (!res.ok) throw new ShownError(t("grid_error"));
      const body = (await res.json()) as { items: ProductSummary[] };
      setItems((cur) => [...cur, ...body.items.filter((p) => p.id !== hiddenId && !cur.some((c) => c.id === p.id))]);
      setReceived((r) => r + body.items.length);
      setLastPageSize(body.items.length);
      setNextPage(page + 1);
      setStatus("idle");
    } catch (e) {
      if (controller.signal.aborted) return;                                       // the buyer left: nothing to show
      setProblem(e instanceof ShownError ? e.message : t("grid_error"));
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }, [source, pageSize, lang, hiddenId, t]);

  useEffect(() => { loader.current = loadNext; });

  // Load the next page when the end of the list comes within 800 px of the screen. The browser reports "visible" once as soon as it is watching, so when a page was short
  // and the end is STILL in view, the next page is asked for straight away (that is how a tall screen fills itself).
  useEffect(() => {
    const node = sentinel.current;
    if (!node || done || capped || status !== "idle" || typeof IntersectionObserver === "undefined") return;
    const watcher = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) loadNext(); }, { rootMargin: "800px 0px" });
    watcher.observe(node);
    return () => watcher.disconnect();
  }, [done, capped, status, items.length, loadNext]);

  // Tell a screen reader what happened (the new cards appear far from where its cursor is).
  useEffect(() => {
    if (items.length <= initial.length) return;
    const shown = items.length;
    const text = total !== null ? t("grid_progress", { shown, total }) : t("grid_shown", { shown });
    const timer = window.setTimeout(() => setAnnouncement(text), 0);
    return () => window.clearTimeout(timer);
  }, [items.length, initial.length, total, t]);

  // Remember the scroll place while the buyer scrolls, and keep what is loaded when they leave (to open a product, or to leave the page for good).
  useEffect(() => {
    const key = `${id}:${window.location.pathname}${window.location.search}`;
    // Also: whenever the buyer scrolls to the end of the list OR PAST IT. The watcher above only reports a CHANGE of "in view", so a buyer who jumps straight past the end
    // (End key, dragging the scrollbar, "skip to the footer", a long column beside the list making the page taller than the list) would never trigger it.
    let frame = 0;
    const onScroll = () => {
      if (!frozen.current) scrollY.current = window.scrollY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const node = sentinel.current;
        if (node && latest.current.canLoad && node.getBoundingClientRect().top < window.innerHeight + 800) loader.current();
      });
    };
    const save = () => {
      const s = latest.current;
      if (s.items.length <= initial.length) return;                                // only the first page: the browser's own scroll memory is enough, and nothing is lost
      saveGrid(key, { items: s.items, received: s.received, nextPage: s.nextPage, lastPageSize: s.lastPageSize, scrollY: scrollY.current });
    };
    persist.current = save;
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("pagehide", save); cancelAnimationFrame(frame); save(); abort.current?.abort(); };
  }, [id, initial.length]);

  // Coming BACK to a list: put back what was loaded and the place on the page. Only after a genuine Back: opening the same address afresh starts at the top.
  useLayoutEffect(() => {
    const key = `${id}:${window.location.pathname}${window.location.search}`;
    if (!justWentBack()) { clearGrid(key); return; }
    const snap = loadGrid(key);
    if (!snap || snap.items.length <= initial.length) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setItems(snap.items); setReceived(snap.received); setNextPage(snap.nextPage); setLastPageSize(snap.lastPageSize);
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, snap.scrollY)));
    });
    return () => { cancelled = true; };
  }, [id, initial.length]);

  // A click on a product (or anything in the list): remember the place NOW, and keep it fixed while the page navigates. Held for 4 seconds, so a click that does not
  // navigate (a new tab) does not stop the place from being followed afterwards.
  const onClickCapture = () => {
    scrollY.current = window.scrollY;
    frozen.current = true;
    persist.current();
    window.setTimeout(() => { frozen.current = false; }, 4000);
  };

  const manyPages = (total ?? items.length) > pageSize;
  return (
    <div onClickCapture={onClickCapture}>
      {manyPages && <a href="#site-footer" className="sr-only focus:not-sr-only focus:mb-3 focus:inline-block focus:rounded-lg focus:bg-navy focus:px-4 focus:py-2 focus:text-white">{t("grid_skip")}</a>}
      <ul className={gridClassName}>
        {items.map((p) => <ProductCard key={p.id} product={p} lang={lang} />)}
      </ul>
      <div ref={sentinel} aria-hidden="true" className="h-px" />
      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
      {status === "loading" && <p aria-busy="true" className="py-8 text-center font-semibold text-muted">{t("grid_loading")}</p>}
      {status === "error" && (
        <div role="alert" className="py-8 text-center">
          <p className="mb-3 font-semibold text-[#a12a21]">{problem}</p>
          <button type="button" onClick={loadNext} className="inline-flex min-h-11 items-center rounded-[10px] border-[1.5px] border-navy px-5 text-sm font-bold text-navy hover:bg-chalk">{t("try_again")}</button>
        </div>
      )}
      {capped && !done && seeAllHref && <p className="py-8 text-center"><Link href={seeAllHref} className="font-bold text-navy underline underline-offset-4">{t("grid_see_all")}</Link></p>}
      {done && items.length > pageSize && <p className="py-8 text-center text-muted">{t("grid_end", { n: total ?? received })}</p>}
    </div>
  );
}
