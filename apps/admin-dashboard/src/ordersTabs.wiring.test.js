import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Admin Orders: All / To ship / Shipped / Delivered / Disputes / Refused, each with its number; Refused has Needs attention / Handled
// (each counted); the export holds every field of each order and a sheet of its items. Reads the source text.
describe("Admin Orders tabs and export", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  it("six tabs, each counted", () => {
    expect(app).toContain('["dispute", "Disputes"], ["refused", "Refused"]]');
    expect(app).toContain("{countOf(id)}</span></button>");
  });
  it("the refused list sits in its own tab, with its two counts", () => {
    expect(app).toContain('{filter === "refused" && <RefusedOrdersSection');
    expect(app).toContain("counts={{ open: refused.open.length, handled: refused.handled.length }}");
    expect(app).not.toContain("        <RefusedOrdersSection onSessionExpired={onSessionExpired} />");
  });
  it("the export has every field and the items", () => {
    expect(app).toContain("await exportOrdersWorkbook({ orders: filtered, tabName: filter");
    expect(app).toContain('addSheet("Items", itemRows');
    expect(app).toContain("fetchOrderById(getStoredToken(), o.id)");
  });
});
