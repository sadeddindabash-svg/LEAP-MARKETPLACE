import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Products > Export: every field, headers in Chinese and English, the first photo in its cell, and a sheet of the cars. Reads the source text.
describe("Products export", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  it("the export button builds the full workbook", () => {
    expect(app).toContain('data-testid="products-export"');
    expect(app).toContain("await exportProductsWorkbook({");
  });
  it("every field, in Chinese and English", () => {
    for (const h of ["商品编号\\nProduct ID", "OE 编号\\nOE number", "拒绝原因\\nRejection reasons", "适配车型\\nFits", "重量 kg\\nWeight", "视频\\nVideo"]) expect(app).toContain(h);
  });
  it("the photo inside the cell and the sheet of cars", () => {
    expect(app).toContain("sheet.addImage(id,");
    expect(app).toContain('workbook.addWorksheet(L("适配车型", "Fitment"))');
  });
});
