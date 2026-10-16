// Remembers how far a buyer had scrolled down a lazily loaded list (the parts already loaded and the place on the page) for as long as the browser tab lives, so that
// pressing Back from a product returns to THE SAME PLACE instead of the top of a list that has forgotten everything below its first page.
import type { ProductSummary } from "./api";

const TTL_MS = 10 * 60 * 1000;            // prices and stock change: a list remembered longer than this is not trusted
const MAX_ITEMS = 600;                    // what fits comfortably in the tab's storage
const PREFIX = "leap-grid:";

export interface GridSnapshot { items: ProductSummary[]; received: number; nextPage: number; lastPageSize: number; scrollY: number; savedAt: number }

export function saveGrid(key: string, snapshot: Omit<GridSnapshot, "savedAt">, now: number = Date.now()): void {
  try {
    if (snapshot.items.length > MAX_ITEMS) return;
    sessionStorage.setItem(PREFIX + key, JSON.stringify({ ...snapshot, savedAt: now }));
  } catch { /* storage full or switched off: the list simply starts from the top */ }
}

export function loadGrid(key: string, now: number = Date.now()): GridSnapshot | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const s = JSON.parse(raw) as GridSnapshot;
    const valid = Array.isArray(s.items) && [s.received, s.nextPage, s.lastPageSize, s.scrollY, s.savedAt].every((n) => typeof n === "number" && Number.isFinite(n));
    if (!valid || now - s.savedAt > TTL_MS) { sessionStorage.removeItem(PREFIX + key); return null; }
    return s;
  } catch { return null; }
}

export function clearGrid(key: string): void {
  try { sessionStorage.removeItem(PREFIX + key); } catch { /* nothing to clear */ }
}

// A snapshot is used ONLY when the buyer just came BACK (or forward) to the page: someone who opens the same address afresh (a menu link, a new tab) starts at the top.
let lastPopState = 0;
if (typeof window !== "undefined") window.addEventListener("popstate", () => { lastPopState = Date.now(); });

export function justWentBack(now: number = Date.now()): boolean {
  if (now - lastPopState < 3000) return true;                                   // the router's own Back/Forward
  try {                                                                          // the browser reloaded the page on Back
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return nav?.type === "back_forward" && performance.now() < 5000;
  } catch { return false; }
}
