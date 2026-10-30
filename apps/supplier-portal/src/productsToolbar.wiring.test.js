import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Products: the buttons in one row (Add product, Bulk upload, My Drafts, Export, Bulk edit), the filters with their numbers. Reads the source text.
describe("Products toolbar", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  const bar = app.slice(app.indexOf('data-testid="products-toolbar"'));
  it("the buttons are in this order, left to right", () => {
    const at = (s) => bar.indexOf(s);
    const order = ["t.products.addProduct", "t.products.bulkUpload", '"My Drafts (Not published)"', "t.products.export", "t.products.bulkPriceUpdate"].map(at);
    order.forEach((i) => expect(i).toBeGreaterThan(-1));
    expect(order.every((v, i) => i === 0 || order[i - 1] < v)).toBe(true);
  });
  it("Bulk edit is always there and waits for ticked products", () => {
    expect(bar).toContain("disabled={selectedIds.size === 0}");
  });
  it("both filters show their number", () => {
    expect(bar).toContain("`${t.products.filterAll} (${products.length})`");
    expect(bar).toContain("t.products.filterLowStock(lowStockProducts.length)");
  });
});
