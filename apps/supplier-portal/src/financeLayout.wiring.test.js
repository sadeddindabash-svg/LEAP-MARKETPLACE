import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Finance: Payout history and Payout account in the same row. Reads the source text.
describe("Finance layout", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  it("the two cards share one row", () => {
    const row = app.indexOf('data-testid="finance-payouts-row"');
    expect(row).toBeGreaterThan(-1);
    expect(app.indexOf("<Card title={fi.recordsTitle}>", row)).toBeGreaterThan(row);
    expect(app.indexOf("<Card title={fi.bankTitle}>", row)).toBeGreaterThan(app.indexOf("<Card title={fi.recordsTitle}>", row));
  });
});
