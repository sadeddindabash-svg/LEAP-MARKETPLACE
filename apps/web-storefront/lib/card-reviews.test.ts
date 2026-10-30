import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cardReviews } from "./review";

describe("cardReviews: the reviews line of a product card", () => {
  it("shows the average to one decimal, the count and the whole stars", () => {
    expect(cardReviews(4.6, 12)).toEqual({ average: "4.6", count: 12, fullStars: 5 });
    expect(cardReviews(4.24, 5)).toEqual({ average: "4.2", count: 5, fullStars: 4 });
    expect(cardReviews(5, 1)).toEqual({ average: "5.0", count: 1, fullStars: 5 });
  });
  it("no approved review -> null, so the card says 'No reviews yet'", () => {
    expect(cardReviews(null, 0)).toBeNull();
    expect(cardReviews(4.5, 0)).toBeNull();       // an old rating with no review left counts as none
    expect(cardReviews(null, 3)).toBeNull();
    expect(cardReviews(undefined, undefined)).toBeNull();
  });
  it("the card shows the line, in English and Arabic", () => {
    const card = readFileSync("components/ProductCard.tsx", "utf8");
    expect(card).toContain("<CardReviews rating={p.rating} count={p.reviewCount} lang={lang} />");
    const i18n = readFileSync("lib/i18n.ts", "utf8");
    expect(i18n).toContain('card_no_reviews: "No reviews yet"');
    expect(i18n).toContain('card_no_reviews: "لا توجد تقييمات بعد"');
  });
});
