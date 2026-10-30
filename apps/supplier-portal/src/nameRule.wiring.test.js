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
  it("Bulk upload imports a row whose three cells are filled even outside the name rule, and shows the rule as a warning", () => {
    expect(app).not.toContain("return 'name';");
    expect(app).toContain("names outside the length rule (still imported)");
    expect(app).toContain("data-testid={`bulk-name-warning-${i}`}");
  });
  it("the results show Row, OE Number, Name, Price and Status", () => {
    expect(app).toContain("<Th>{L('名称', 'Name')}</Th><Th align=\"right\">{L('价格 (¥)', 'Price (¥)')}</Th>");
  });
});
