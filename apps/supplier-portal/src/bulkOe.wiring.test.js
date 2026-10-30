import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Bulk upload and OE numbers: one the supplier already has updates that product's price; the same one twice in a file counts once.
describe("Bulk upload: repeated and existing OE numbers", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  const auth = readFileSync("src/auth.js", "utf8");
  it("the portal asks which OE numbers the supplier already has", () => {
    expect(auth).toContain("body: JSON.stringify({ names, oemNumbers, fitment }),");
    expect(app).toContain("items.map((it) => it.itemName), items.map((it) => it.oemNumber)");
  });
  it("a row with an existing OE number updates the price; a repeated one is skipped", () => {
    expect(app).toContain("if (r.exists) return 'update';");
    expect(app).toContain("return 'repeated';");
    expect(app).toContain("Already yours for this car: price will be updated");
    expect(app).toContain("Repeated in this file: skipped");
  });
});
