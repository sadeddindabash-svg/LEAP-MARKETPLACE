import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Bulk upload, the approved design. Reads the source text.
describe("Bulk upload: 3-column template, vehicle with versions, category from the name, photos and video per row", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  const auth = readFileSync("src/auth.js", "utf8");
  it("the template has exactly three columns", () => {
    expect(app).toContain("const BULK_TEMPLATE_HEADERS = ['OE Number / OE编号', 'Item Name / 商品名称', 'Price (RMB) / 价格（人民币）'];");
  });
  it("the vehicle is chosen like a single product, with its versions, and the versions are sent", () => {
    expect(app).toContain('<VehiclePicker cascade={cascade} idPrefix="bulk">');
    expect(app).toContain("versionIds: versionChoice.ids");
  });
  it("the category and part class come from the item name, and every row can change them", () => {
    expect(auth).toContain("/supplier/me/products/bulk-import/match");
    expect(app).toContain("matchBulkItemNames(getStoredToken(), items.map((it) => it.itemName), items.map((it) => it.oemNumber), batchCar)");
    expect(app).toContain("onChange={(e) => updateRow(i, { category: e.target.value, part: '', match: 'chosen' })}");
  });
  it("each row takes the photos and video Settings ask for, also many files at once by OE number", () => {
    expect(app).toContain("Array.from({ length: requirements.minPhotos }");
    expect(app).toContain("videoUrl: r.video ? r.video.url : null");
    expect(app).toContain("function bulkMediaFileInfo(fileName)");
  });
});
