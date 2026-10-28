import { describe, it, expect } from "vitest";
import { totals } from "./cart";

// "You saved": the discount AND the shipping fee the buyer does not pay when shipping is free.
const items = (price: number, quantity = 1) => [{ productId: "p", quantity, name: "x", price, currencyCode: "USD", supplierName: "s", stockQuantity: 9, imageUrl: null }];
const base = { appliedDiscountUsd: 0, appliedDiscountSource: "none" as const, loyaltyDiscountPercentage: 0, appliedPromoCode: null };
const ship = (over: Record<string, unknown> = {}) => ({ enabled: true, thresholdUsd: 50, feeUsd: 5, chargedUsd: 0, remainingUsd: 0, qualifies: true, waivedByPromo: false, ...over });
const t = (over: Record<string, unknown> = {}, price = 78, discount = 0) => totals({ items: items(price), ...base, appliedDiscountUsd: discount, shipping: ship(over) as never } as never);

describe("the shipping fee saved", () => {
  it("free shipping reached: the fee that would have been charged below the limit is saved (and is the whole saving when there is no discount)", () => { const r = t(); expect(r.shippingSaved).toBe(5); expect(r.discount).toBe(0); expect(r.saved).toBe(5); });
  it("with a discount too: both are counted (8 + 5 = 13), and the total is unchanged by this (goods + no fee)", () => { const r = t({}, 78, 8); expect(r.shippingSaved).toBe(5); expect(r.saved).toBe(13); expect(r.total).toBe(70); });
  it("a free-shipping promo code that waives the fee counts too, even below the limit", () => { const r = t({ qualifies: false, waivedByPromo: true, remainingUsd: 20 }, 30); expect(r.shippingSaved).toBe(5); expect(r.saved).toBe(5); });
  it("under the limit a fee is CHARGED: nothing is saved on shipping, and a discount alone is the whole saving as before", () => { const r = t({ qualifies: false, chargedUsd: 5, remainingUsd: 30 }, 20, 3); expect(r.shippingSaved).toBe(0); expect(r.saved).toBe(3); expect(r.shippingFee).toBe(5); expect(t({ qualifies: false, chargedUsd: 5 }, 20).saved).toBe(0); });
  it("a fee that IS charged saves nothing even if the answer also says the limit was reached (a contradictory answer is never trusted as a saving)", () => { expect(t({ chargedUsd: 5, qualifies: true }).shippingSaved).toBe(0); expect(t({ chargedUsd: 5, waivedByPromo: true }).saved).toBe(0); });
  it("the rule off, or a server that sends no shipping answer: nothing saved on shipping (a discount alone is as before)", () => { expect(t({ enabled: false }).shippingSaved).toBe(0); expect(totals({ items: items(40), ...base, appliedDiscountUsd: 4 } as never).saved).toBe(4); expect(totals({ items: items(40), ...base } as never).saved).toBe(0); });
  it("a fee of 0 saves nothing (there was nothing to pay), and bad numbers never give a saving", () => { expect(t({ feeUsd: 0 }).shippingSaved).toBe(0); for (const feeUsd of [NaN, -5, "abc", undefined, null]) expect(t({ feeUsd }).shippingSaved, String(feeUsd)).toBe(0); });
  it("free for no real reason (not reached, no promo, but nothing charged: an empty basket) saves nothing", () => { expect(totals({ items: [], ...base, shipping: ship({ qualifies: false, remainingUsd: 50 }) } as never).shippingSaved).toBe(0); });
});
