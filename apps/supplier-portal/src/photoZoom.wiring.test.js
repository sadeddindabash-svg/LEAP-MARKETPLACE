import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Orders: the mouse over a part or car photo shows it large (order details 360 x 360, orders list 220 x 220). Reads the source text.
describe("Photo zoom on orders", () => {
  const src = readFileSync("src/OrderVehicle.jsx", "utf8");
  it("every part and car photo zooms on mouse over", () => {
    expect(src).toContain("zoom = width >= 90 ? 360 : 220");
    expect(src).toContain("onMouseEnter={open}");
    expect(src).toContain("onMouseLeave={() => setAt(null)}");
  });
  it("the whole photo, beside it, above everything", () => {
    expect(src).toContain('objectFit: "contain"');
    expect(src).toContain('position: "fixed"');
  });
});
