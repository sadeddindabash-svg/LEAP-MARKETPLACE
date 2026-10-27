import { describe, it, expect } from "vitest";
import { totals } from "./cart";
import type { CartItem, CartShipping } from "@/lib/api";

// The totals shown, with the shipping fee of a small order (the server decides it and sends it with the cart): the total is the goods after the discount PLUS the fee.
const item = (price: number, quantity = 1): CartItem => ({ productId: `p${price}`, quantity, name: "x", price, currencyCode: "USD", supplierName: "s", stockQuantity: 99, imageUrl: null } as CartItem);
const shipping = (over: Partial<CartShipping> = {}): CartShipping => ({ enabled: true, thresholdUsd: 50, feeUsd: 5, chargedUsd: 5, remainingUsd: 30, qualifies: false, waivedByPromo: false, ...over });
const cart = (items: CartItem[], over: Record<string, unknown> = {}) => ({ items, appliedDiscountUsd: 0, appliedDiscountSource: "none" as const, loyaltyDiscountPercentage: 0, appliedPromoCode: null, ...over });

describe("the totals with a shipping fee", () => {
  it("a small basket: the total is the goods plus the fee, and the fee is its own number", () => {
    const t = totals(cart([item(20)], { shipping: shipping() })); expect(t.subtotal).toBe(20); expect(t.goods).toBe(20); expect(t.shippingFee).toBe(5); expect(t.total).toBe(25);
  });
  it("with a discount: the fee is added to the goods AFTER the discount (60 less 12, plus 5)", () => {
    const t = totals(cart([item(60)], { appliedDiscountUsd: 12, appliedDiscountSource: "promo", shipping: shipping() })); expect(t.discount).toBe(12); expect(t.goods).toBe(48); expect(t.total).toBe(53);
  });
  it("a basket at the limit pays no fee: the total is just the goods", () => { const t = totals(cart([item(50)], { shipping: shipping({ chargedUsd: 0, remainingUsd: 0, qualifies: true }) })); expect(t.shippingFee).toBe(0); expect(t.total).toBe(50); });
  it("a basket that is not charged by a promo code pays no fee either", () => { expect(totals(cart([item(20)], { shipping: shipping({ chargedUsd: 0, waivedByPromo: true }) })).total).toBe(20); });
  it("with the rule off, or an older server that sends nothing, the total is exactly what it always was", () => {
    for (const s of [undefined, null, shipping({ enabled: false, chargedUsd: 0 })]) { const t = totals(cart([item(20, 2)], { appliedDiscountUsd: 5, appliedDiscountSource: "promo", shipping: s as never })); expect(t.shippingFee).toBe(0); expect(t.total).toBe(35); expect(t.goods).toBe(35); }
  });
  it("a fee that is not a sensible number is ignored (never a NaN or a negative total)", () => {
    for (const bad of [NaN, -5, Infinity, "abc" as never, undefined as never]) { const t = totals(cart([item(20)], { shipping: shipping({ chargedUsd: bad }) })); expect(Number.isFinite(t.total), String(bad)).toBe(true); expect(t.total).toBeGreaterThanOrEqual(20); }
    expect(totals(cart([item(20)], { shipping: shipping({ chargedUsd: -5 }) })).total).toBe(20);
  });
  it("an empty basket pays nothing, fee or no fee", () => { expect(totals(cart([], { shipping: shipping({ chargedUsd: 0 }) })).total).toBe(0); });
  it("the other fields are unchanged: the discount's source, the loyalty percent and the promo code", () => { const t = totals(cart([item(10)], { appliedDiscountSource: "loyalty", loyaltyDiscountPercentage: 5, appliedPromoCode: "X", shipping: shipping() })); expect(t.source).toBe("loyalty"); expect(t.loyaltyPercent).toBe(5); expect(t.promoCode).toBe("X"); });
});
