import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The supplier Overview's containers in the approved order (rows of three). Reads the source text.
describe("Supplier Overview layout", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  const page = app.slice(app.indexOf("function OverviewPage("));
  const at = (s) => { const i = page.indexOf(s); expect(i, s).toBeGreaterThan(-1); return i; };
  const inOrder = (...xs) => xs.every((x, i) => i === 0 || xs[i - 1] < x);
  it("row 1: Payout summary | Order status breakdown | Orders", () => {
    expect(inOrder(at('data-testid="overview-row-1"'), at('part="payout"'), at('part="status"'), at("<OrderOutcomesCard"), at('data-testid="overview-row-2"'))).toBe(true);
  });
  it("row 2: Orders per day | Recent orders | Low-stock products", () => {
    expect(inOrder(at('data-testid="overview-row-2"'), at("<Card title={l.trendTitle}"), at("<Card title={l.recentOrdersTitle}"), at('part="lowStock"'), at("<KpiCard"))).toBe(true);
  });
  it("below: the number tiles, the revenue trend, then Top-selling products beside Top products", () => {
    expect(inOrder(at("<KpiCard"), at('part="rest"'), at('data-testid="overview-row-bottom"'), at('part="topSelling"'), at("<Card title={l.topProductsTitle}"))).toBe(true);
  });
  it("nothing is shown twice: the section's own pairs are only for part \"all\"", () => {
    expect(app).toContain('{part === "all" && analytics.lowStockProducts.length > 0 && (');
    expect(app).toContain('{part === "lowStock" && (');
    expect(app).toContain('{part === "status" && (');
    expect(app).toContain('{part === "topSelling" && (');
  });
});
