import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Products: everything is a tab under the header, in this order: All (n), Low stock (n), Add product, Bulk upload, My Drafts, Export, Bulk edit. Reads the source text.
describe("Products tabs", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  const tabs = app.slice(app.indexOf("const productTabs = ["), app.indexOf("];", app.indexOf("const productTabs = [")));
  it("the tabs are in this order, left to right", () => {
    const at = (s) => tabs.indexOf(s);
    const order = ["`${t.products.filterAll} (${products.length})`", "t.products.filterLowStock(lowStockProducts.length)", "t.products.addProduct", "t.products.bulkUpload", '"My Drafts (Not published)"', "t.products.export", "t.products.bulkPriceUpdate"].map(at);
    order.forEach((i) => expect(i).toBeGreaterThan(-1));
    expect(order.every((v, i) => i === 0 || order[i - 1] < v)).toBe(true);
  });
  it("Bulk edit waits for ticked products", () => {
    const bulk = app.slice(app.indexOf('data-testid="products-bulk-edit"'));
    expect(bulk).toContain("disabled={selectedIds.size === 0}");
  });
});
