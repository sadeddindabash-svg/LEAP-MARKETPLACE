import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Catalog moderation and the All Products edit form follow the name minimums set in All Products > Product requirements. Reads the source text.
describe("Admin name minimums follow the settings", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  it("no fixed minimum of 25 for the names", () => {
    expect(app).not.toContain("/100 (min 25)");
    expect(app).toContain("(min {nameMins.en})");
    expect(app).toContain("(min {nameMins.ar})");
  });
});
