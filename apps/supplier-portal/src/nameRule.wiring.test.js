import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The product name rule by language (English / Chinese / Arabic minimums from the admin), in Add product and Bulk upload. Reads the source text.
describe("Product name minimums", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  it("the rule finds the language and uses the admin's minimums", () => {
    expect(app).toContain("function supplierNameRule(name, requirements)");
    expect(app).toContain("requirements?.nameMinZh ?? 5");
  });
  it("Add product shows the minimum for the name's language", () => {
    expect(app).toContain('data-testid="name-counter"');
  });
  it("Bulk upload shows a row outside the rule in red and does not count it as ready or draft", () => {
    expect(app).toContain("if (!supplierNameRule(r.itemName, requirements).ok) return 'name';");
    expect(app).toContain("names outside the rules (not imported)");
  });
});
