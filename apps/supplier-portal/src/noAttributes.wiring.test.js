import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Attributes are removed: Add product has no Attributes box and sends none. Reads the source text.
describe("No attributes in the supplier portal", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  it("Add product has no Attributes box", () => {
    expect(app).not.toContain('cascadeLabel("属性", "Attributes")');
    expect(app).not.toContain("attributes: selectedAttributes");
    expect(app).not.toContain("fetchAttributeDefinitions");
  });
});
