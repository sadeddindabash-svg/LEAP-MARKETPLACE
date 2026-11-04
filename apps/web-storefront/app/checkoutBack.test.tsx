import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The checkout has a way back to the basket: a link above the title and a button under "Place order", both to /cart (the language prefix is added by Link).
const page = readFileSync(join(__dirname, "checkout", "page.tsx"), "utf8");
describe("back to the basket from the checkout", () => {
  it("CRITICAL: a link above the title and a button under Place order, both to the basket", () => {
    expect(page.split('href="/cart"').length - 1).toBeGreaterThanOrEqual(2);
    expect(page.indexOf('data-testid="back-to-cart-top"')).toBeLessThan(page.indexOf('{t("checkout")}</h1>'));
    expect(page.indexOf('{placing ? t("placing_order") : t("place_order")}')).toBeLessThan(page.indexOf('data-testid="back-to-cart-bottom"'));
  });
  it("the arrow turns round in Arabic", () => { expect(page).toContain("rtl:rotate-180"); });
});
