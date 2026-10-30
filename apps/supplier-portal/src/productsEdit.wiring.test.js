import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Products: the list, the edit window and the bulk edit window. Reads the source text.
describe("Products list and edit windows", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  const auth = readFileSync("src/auth.js", "utf8");
  it("the list shows Product, Category, Classification, Price, Stock, Status and Edit", () => {
    expect(app).toContain('<Th>{t.products.thProduct}</Th><Th>{t.products.thCategory}</Th><Th>{t.products.thClass}</Th><Th align="right">{t.products.thPrice}</Th>');
  });
  it("the edit window changes price, category, classification, stock and threshold", () => {
    expect(app).toContain('<select id="edit-category"');
    expect(app).toContain('<select id="edit-part"');
    expect(app).toContain("...(classificationChanged ? { category, part } : {})");
  });
  it("bulk edit changes the price (percentage or flat), the stock and the threshold", () => {
    expect(auth).toContain('"/supplier/me/products/bulk-update"');
    expect(app).toContain("priceAdjustment: { type: adjustmentType, value: num }");
    expect(app).toContain("stockQuantity: stockNum");
    expect(app).toContain("lowStockThreshold: thresholdNum");
  });
});
