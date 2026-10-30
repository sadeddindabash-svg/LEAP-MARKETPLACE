import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The Vehicle Data page has a "Download Excel" tab: one brand or all brands. Reads the source text.
describe("Vehicle data: Download Excel", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  const auth = readFileSync("src/auth.js", "utf8");
  const panel = readFileSync("src/VehicleExportPanel.jsx", "utf8");
  it("the page has the tab and shows the panel", () => {
    expect(app).toContain('["export", "Download Excel"]');
    expect(app).toContain('<VehicleExportPanel onSessionExpired={onSessionExpired} />');
  });
  it("the panel offers all brands or one brand", () => {
    expect(panel).toContain('<option value="">All brands</option>');
    expect(panel).toContain("downloadVehicleExport(getStoredToken(), brandId || null)");
  });
  it("it asks the server's export, with the brand when one is chosen", () => {
    expect(auth).toContain("/fitment/export${query}");
    expect(auth).toContain("?brandId=${encodeURIComponent(brandId)}");
  });
});
