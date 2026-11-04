// Choosing which parts of the basket to order: every line has a tick box (all ticked to start with, and a part added again is ticked again). Only the ticked lines are
// ordered; the others stay in the basket. The server prices the whole basket, so for the ticked lines alone this works out the discount and the shipping fee with the
// SAME rules as the server (services/api: the bigger of the loyalty and the promo discount; shipping measured on the goods after the discount, waived by a free-shipping
// code). The order itself is priced by the server again, from the lines sent.
import type { Cart, CartItem, CartShipping } from "./api";
import { totals } from "./cart";

export const UNSELECTED_KEY = "leap_cart_unselected";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The lines that are ticked. */
export const selectedItems = (items: CartItem[], unselected: ReadonlySet<string>): CartItem[] => items.filter((i) => !unselected.has(i.productId));

/** The discount for the ticked lines, as the server works it out: loyalty percent, or the promo (percentage, or a flat amount up to the goods), whichever is bigger. */
export function discountFor(cart: Pick<Cart, "loyaltyDiscountPercentage" | "appliedPromoDetails">, subtotalUsd: number): { usd: number; source: "loyalty" | "promo" | "none" } {
  const loyalty = round2(subtotalUsd * ((cart.loyaltyDiscountPercentage ?? 0) / 100));
  const p = cart.appliedPromoDetails;
  const promo = !p ? 0 : p.type === "percentage" ? round2(subtotalUsd * ((p.value ?? 0) / 100)) : p.type === "flat" ? Math.min(p.value ?? 0, subtotalUsd) : 0;
  if (loyalty > promo) return { usd: loyalty, source: "loyalty" };
  if (promo > 0) return { usd: promo, source: "promo" };
  return { usd: 0, source: "none" };
}

/** The shipping fee for the ticked lines, with the server's rule (the limit and the fee come from the server's answer for the basket). */
export function shippingFor(s: CartShipping | null | undefined, goodsUsd: number, hasItems: boolean): CartShipping | null | undefined {
  if (!s || !s.enabled) return s;
  const qualifies = goodsUsd >= s.thresholdUsd;
  return { ...s, qualifies, chargedUsd: hasItems && !qualifies && !s.waivedByPromo ? s.feeUsd : 0, remainingUsd: qualifies ? 0 : round2(s.thresholdUsd - goodsUsd) };
}

/**
 * The basket as the checkout sees it: only the ticked lines, with their own discount and shipping fee. When every line is ticked it is exactly the server's basket
 * (nothing is worked out here).
 */
export function selectedCart(cart: Cart, unselected: ReadonlySet<string>): Cart {
  const items = selectedItems(cart.items, unselected);
  if (items.length === cart.items.length) return cart;
  const sub = items.reduce((n, i) => n + i.price * i.quantity, 0);
  const d = discountFor(cart, sub);
  return { ...cart, items, appliedDiscountUsd: d.usd, appliedDiscountSource: d.source, shipping: shippingFor(cart.shipping, Math.max(sub - d.usd, 0), items.length > 0) };
}

export const selectedSummary = (cart: Cart, unselected: ReadonlySet<string>) => {
  const c = selectedCart(cart, unselected);
  return totals({ items: c.items, appliedDiscountUsd: c.appliedDiscountUsd, appliedDiscountSource: c.appliedDiscountSource, loyaltyDiscountPercentage: c.loyaltyDiscountPercentage, appliedPromoCode: c.appliedPromoCode, shipping: c.shipping });
};

/** The unticked lines kept in this browser: read (only ids that are still in the basket count) and written. */
export function readUnselected(): Set<string> {
  try { const v = JSON.parse(localStorage.getItem(UNSELECTED_KEY) ?? "[]"); return new Set(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []); } catch { return new Set(); }
}
export function writeUnselected(ids: ReadonlySet<string>): void {
  try { if (ids.size === 0) localStorage.removeItem(UNSELECTED_KEY); else localStorage.setItem(UNSELECTED_KEY, JSON.stringify([...ids])); } catch { /* private mode: the choice is just not remembered */ }
}
