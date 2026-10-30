import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Weight and size are set by Leap (the admin): the supplier is never asked for them. My Drafts lists what is missing in the portal's language. Reads the source text.
describe("No weight and size from the supplier", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  it("Add product has no weight or size inputs and requires none", () => {
    expect(app).not.toContain("setWeightKg(e.target.value)");
    expect(app).not.toContain('missing.push(lang === "zh" ? "重量" : "weight")');
    expect(app).toContain('data-testid="weight-size-by-leap"');
  });
  it("Bulk upload never holds a row back for weight and size", () => {
    expect(app).not.toContain("return 'dimensions';");
  });
  it("My Drafts: what is missing, translated, without weight and size", () => {
    expect(app).toContain("map(draftMissingText)");
    expect(app).not.toContain("{d.missing.join(', ')}");
  });
});
