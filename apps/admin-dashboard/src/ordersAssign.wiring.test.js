import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Admin Orders: Need assign (after All, counted), and the list columns. Reads the source text.
describe("Orders: Need assign and the new columns", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  it("Need assign comes right after All", () => {
    expect(app).toContain('[["all", "All"], ["assign", "Need assign"], ["to_ship", "To ship"]');
    expect(app).toContain('if (f === "assign") return needsAssign(o);');
  });
  it("the columns", () => {
    expect(app).toContain("<Th>Delivery status</Th><Th>Assign status</Th><Th>Hub status</Th>");
    expect(app).toContain("o.buyerName ||");
    expect(app).toContain("delivery-bar-");
  });
});
