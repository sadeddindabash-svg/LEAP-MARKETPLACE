import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Attributes are removed: neither the moderation review nor the All Products edit form has an Attributes editor. Reads the source text.
describe("No attributes in the admin dashboard", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  it("no Attributes editor anywhere", () => {
    expect(app).not.toContain("+ Add attribute");
    expect(app).not.toContain("attributes: reviewAttributes");
    expect(app).not.toContain("attributes: selectedAttributes");
    expect(app).not.toContain("fetchAttributeDefinitions");
  });
});
