import { describe, it, expect } from "vitest";
import type { Cart, CartItem } from "./api";
import { discountFor, selectedCart, selectedSummary, shippingFor } from "./cartSelection";

// Ordering only the ticked lines: the discount and the shipping fee for them alone, with the server's rules.
const line = (productId: string, price: number, quantity = 1): CartItem => ({ productId, quantity, name: productId, price, currencyCode: "USD", supplierName: "S", stockQuantity: 10, imageUrl: null });
const ship = { enabled: true, thresholdUsd: 50, feeUsd: 5, chargedUsd: 0, remainingUsd: 0, qualifies: true, waivedByPromo: false };
const cart = (over: Partial<Cart> = {}): Cart => ({ cartId: "c", items: [line("a", 40), line("b", 30), line("c", 10)], appliedDiscountUsd: 0, appliedDiscountSource: "none", loyaltyDiscountPercentage: 0, shipping: ship, ...over });

describe("the ticked lines", () => {
  it("CRITICAL: all ticked: exactly the server's basket (nothing worked out here)", () => {
    const c = cart(); expect(selectedCart(c, new Set())).toBe(c);
  });
  it("CRITICAL: some ticked: only those lines, and the shipping fee for them (40 is under the 50 limit: the 5 fee comes back)", () => {
    const c = selectedCart(cart(), new Set(["b", "c"]));
    expect(c.items.map((i) => i.productId)).toEqual(["a"]);
    expect(c.shipping).toMatchObject({ qualifies: false, chargedUsd: 5, remainingUsd: 10 });
    expect(selectedSummary(cart(), new Set(["b", "c"]))).toMatchObject({ subtotal: 40, total: 45 });
  });
  it("the discount for the ticked lines: loyalty percent or the promo, whichever is bigger (as the server)", () => {
    expect(discountFor({ loyaltyDiscountPercentage: 10 }, 40)).toEqual({ usd: 4, source: "loyalty" });
    expect(discountFor({ loyaltyDiscountPercentage: 5, appliedPromoDetails: { code: "X", type: "percentage", value: 20 } }, 40)).toEqual({ usd: 8, source: "promo" });
    expect(discountFor({ appliedPromoDetails: { code: "F", type: "flat", value: 100 } }, 40)).toEqual({ usd: 40, source: "promo" });
    expect(discountFor({ appliedPromoDetails: { code: "S", type: "free_shipping", value: null } }, 40)).toEqual({ usd: 0, source: "none" });
  });
  it("a free-shipping code still waives the fee; with the rule off nothing changes; nothing ticked charges nothing", () => {
    expect(shippingFor({ ...ship, waivedByPromo: true }, 10, true)).toMatchObject({ chargedUsd: 0, qualifies: false });
    expect(shippingFor({ ...ship, enabled: false }, 10, true)).toMatchObject({ enabled: false });
    expect(shippingFor(ship, 0, false)).toMatchObject({ chargedUsd: 0 });
  });
});
