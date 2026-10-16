import { describe, it, expect, beforeEach } from "vitest";
import type { ProductSummary } from "./api";
import { clearGrid, justWentBack, loadGrid, saveGrid } from "./gridMemory";

const items = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}` }) as ProductSummary);
const snap = (n = 48) => ({ items: items(n), received: n, nextPage: 3, lastPageSize: 24, scrollY: 1800 });
beforeEach(() => sessionStorage.clear());

describe("the list's memory of where the buyer was", () => {
  it("what is saved reads back exactly", () => {
    saveGrid("k", snap(), 1000);
    expect(loadGrid("k", 2000)).toEqual({ ...snap(), savedAt: 1000 });
  });
  it("CRITICAL: a list remembered for more than 10 minutes is not trusted (prices and stock move) and is thrown away", () => {
    saveGrid("k", snap(), 0);
    expect(loadGrid("k", 9 * 60 * 1000)).not.toBeNull();
    expect(loadGrid("k", 10 * 60 * 1000 + 1)).toBeNull();
    expect(sessionStorage.getItem("leap-grid:k")).toBeNull();
  });
  it("damaged or foreign data is ignored, never an error", () => {
    sessionStorage.setItem("leap-grid:k", "not json");
    expect(loadGrid("k")).toBeNull();
    sessionStorage.setItem("leap-grid:k", JSON.stringify({ items: "x", received: 1 }));
    expect(loadGrid("k")).toBeNull();
  });
  it("a list too big for the tab's storage is not kept (it simply starts from the top)", () => {
    saveGrid("big", snap(601));
    expect(loadGrid("big")).toBeNull();
  });
  it("clearing forgets it; each list has its own memory", () => {
    saveGrid("a", snap(), 1); saveGrid("b", snap(30), 1);
    clearGrid("a");
    expect(loadGrid("a", 2)).toBeNull();
    expect(loadGrid("b", 2)?.items).toHaveLength(30);
  });
  it("CRITICAL: it counts as 'just went back' only for 3 seconds after the router's Back/Forward, and never otherwise", () => {
    const before = Date.now();
    expect(justWentBack(before + 10_000_000)).toBe(false);                      // far from any Back
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(justWentBack(Date.now() + 1000)).toBe(true);
    expect(justWentBack(Date.now() + 3500)).toBe(false);
  });
});
