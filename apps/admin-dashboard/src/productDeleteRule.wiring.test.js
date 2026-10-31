import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Admin > Products > Delete: the window says which products go completely and which keep their history (marked deleted). Reads the source text.
describe("Delete products window", () => {
  const src = readFileSync("src/ProductDeleteDialog.jsx", "utf8");
  it("shows, per product, whether it is removed completely or keeps its history", () => {
    expect(src).toContain('data-testid="delete-will-go"');
    expect(src).toContain("p.keepsHistory");
    expect(src).toContain("never ordered: removed completely");
  });
});
