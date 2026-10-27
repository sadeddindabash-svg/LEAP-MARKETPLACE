import { discountPercent } from "./discount";

/** The discount of a product on a card: the rounded percentage, or null when there is no genuine discount (the same rule as the product page). */
export function cardDiscount(price: number, original: number | null | undefined): number | null { return discountPercent(price, original); }

/** The colour of the "-N%" tag on a card's photo: solid, so it stands out on a picture. Gold under 15%, orange from 15%, red from 30%. */
export function cardDiscountTagClasses(percent: number): string {
  if (percent >= 30) return "bg-[#d92d20] text-white";
  if (percent >= 15) return "bg-[#f26b21] text-white";
  return "bg-[#fab219] text-navy";
}
