import { describe, it, expect } from "vitest";
import { productDescription } from "./seo";

// The text search engines read keeps "N days": a date written there would be out of date as soon as the page is cached or crawled.
const p = { name: "Disc", description: null, oemNumber: null, brand: null, model: null, year: null, stockQuantity: 5, price: 10, estimatedDeliveryDays: 7 };
describe("the search-engine description of a product", () => {
  it("keeps the number of days (English and Arabic), never a calendar date", () => {
    expect(productDescription(p, "en")).toContain("Estimated delivery 7 days."); expect(productDescription(p, "ar")).toContain("التوصيل المتوقع خلال 7 أيام."); expect(productDescription(p, "en")).not.toMatch(/Oct\.|Nov\.|Delivery:/);
  });
});
