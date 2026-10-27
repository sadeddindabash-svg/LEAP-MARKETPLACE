// What the cart page and the checkout work out from the cart the server sends (the server already prices every line, applies the loyalty discount or the promo code
// (whichever is bigger) and says which one it applied; nothing here recomputes a discount).
import type { Cart, CartItem } from "./api";

/** The buyer has reached the stock: one more would be more than the supplier has. */
export const atStockLimit = (item: Pick<CartItem, "quantity" | "stockQuantity">): boolean => item.quantity >= item.stockQuantity;
export const leftInStock = (item: Pick<CartItem, "quantity" | "stockQuantity">): number => Math.max(item.stockQuantity - item.quantity, 0);

/** Lines asking for more than is in stock now (stock moved since they were added): named in the checkout warning, which then blocks placing the order. */
export function overStockItems(cart: Pick<Cart, "items">): CartItem[] {
  return cart.items.filter((i) => i.quantity > i.stockQuantity);
}

/** "Wait and ship together" is only offered when the cart has parts from more than one supplier: a single supplier has nothing to wait for. */
export function hasMultipleSuppliers(cart: Pick<Cart, "items">): boolean {
  return new Set(cart.items.map((i) => i.supplierName)).size > 1;
}

/** What the cart says about a line's stock, the app's rule: nothing until 5 or fewer would remain, then "Only N left", and at the limit "You've reached the available stock". */
export type StockHint = { kind: "limit" } | { kind: "only"; left: number } | null;
export function stockHint(item: Pick<CartItem, "quantity" | "stockQuantity">): StockHint {
  const left = item.stockQuantity - item.quantity;
  if (left > 5) return null;
  return left <= 0 ? { kind: "limit" } : { kind: "only", left };
}

/** One line's total, and the estimated weight of the whole cart (shown when ANY line has a weight; a line without one counts as zero, like the app). */
export const lineTotal = (item: Pick<CartItem, "price" | "quantity">): number => item.price * item.quantity;
export function estimatedWeightKg(cart: Pick<Cart, "items">): number | null {
  if (!cart.items.some((i) => i.weightKg != null)) return null;
  return cart.items.reduce((sum, i) => sum + (i.weightKg ?? 0) * i.quantity, 0);
}
/** The part is on sale: it has an original price higher than the one charged. */
export const isOnSale = (item: Pick<CartItem, "price" | "originalPrice">): boolean => item.originalPrice != null && item.originalPrice > item.price;

export const itemCount = (cart: Pick<Cart, "items">): number => cart.items.reduce((n, i) => n + i.quantity, 0);
export const subtotal = (cart: Pick<Cart, "items">): number => cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

export type DiscountSource = "loyalty" | "promo" | "none";

/** The totals shown: the subtotal, the ONE discount the server applied (loyalty or promo, never both), and what is left to pay. Never below zero. */
export function totals(cart: Pick<Cart, "items" | "appliedDiscountUsd" | "appliedDiscountSource" | "loyaltyDiscountPercentage" | "appliedPromoCode">) {
  const sub = subtotal(cart);
  const discount = Math.min(Math.max(cart.appliedDiscountUsd ?? 0, 0), sub);
  return {
    subtotal: sub,
    discount,
    total: Math.max(sub - discount, 0),
    source: (cart.appliedDiscountSource ?? "none") as DiscountSource,
    loyaltyPercent: cart.loyaltyDiscountPercentage ?? 0,
    promoCode: cart.appliedPromoCode ?? null,
  };
}

/** A promo code was entered but the buyer's loyalty discount is bigger, so the server applied the loyalty one: the app says so ("Your loyalty discount already beats this code"). */
export const loyaltyBeatsPromo = (cart: Pick<Cart, "appliedDiscountSource" | "appliedPromoCode">): boolean => cart.appliedDiscountSource === "loyalty" && !!cart.appliedPromoCode;

/** The Arabic word for "Supplier" instead of the English one the server sends in the anonymised label ("Supplier 1 LEAP-SLR-AB12"); the code stays. */
export function supplierLabel(label: string | null | undefined, word: string): string {
  return (label ?? "").replace(/^Supplier\b/, word);
}

/** A key that makes placing the SAME order twice (a double click, a retry after a slow answer) create one order: the server returns the first order for a key it has seen. */
export function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
