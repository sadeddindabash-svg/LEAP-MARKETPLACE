import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Overview: "Units sold by category" shows the real categories' names, the top 6 and "Other". Reads the source text.
describe("Units sold by category", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  it("names from the real categories", () => {
    expect(app).toContain("name: categoryNames[c.category] || CATEGORY_LABELS[c.category] || c.category");
  });
  it("the top 6, then Other", () => {
    expect(app).toContain("byUnits.slice(0, 6)");
    expect(app).toContain("name: `Other (${byUnits.length - 6})`");
  });
});
