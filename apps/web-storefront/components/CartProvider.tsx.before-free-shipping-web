"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { Cart, addCartItem, applyCartPromoCode, fetchCart, lockCartPrices, removeCartItem, setCartItemQuantity } from "@/lib/api";
import { itemCount as countOf, subtotal as subtotalOf, totals as totalsOf } from "@/lib/cart";
import { getAuthToken, useAuth } from "./AuthProvider";
import { useLang } from "./LangProvider";

const CART_ID_COOKIE = "leap_cart_id";

function readCartIdCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CART_ID_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCartIdCookie(id: string) {
  document.cookie = `${CART_ID_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 24 * 30}`;
}

function getOrCreateCartId(): string {
  if (typeof window === "undefined") return "";
  let id = readCartIdCookie();
  if (!id) {
    id = crypto.randomUUID();
    writeCartIdCookie(id);
  }
  return id;
}

interface CartContextValue {
  cart: Cart | null;
  isLoading: boolean;
  error: string | null;
  itemCount: number;
  /** The sum of the lines (before any discount). `summary` has the discount and what is left to pay. */
  total: number;
  summary: ReturnType<typeof totalsOf>;
  addItem: (productId: string, quantity: number) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  /** Freezes the prices for the checkout (like the app, the moment the checkout opens). */
  lockPrices: () => Promise<void>;
  /** Puts a promo code on the cart, or removes it with null. THROWS the server's reason when the code is not valid. */
  applyPromo: (code: string | null) => Promise<void>;
  /** Reads the cart again from the server (something else put items in it, like placing an order from a quote). */
  refreshCart: () => Promise<void>;
  /** After an order: a brand new empty cart, so the count in the header drops at once (not only after a reload). */
  clearAfterOrder: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/**
 * The shopper's cart, kept on the server under an id in a cookie. Every call carries the signed-in buyer's token (so the server can apply THEIR loyalty discount and promo
 * rules, and attach the cart to them) and the page's language (Arabic names), and the cart is loaded again when either changes.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const lang = useLang();
  const userId = user?.id ?? null;
  const [cartId, setCartId] = useState<string>(() => getOrCreateCartId());
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cartId) return;
    let current = true;
    fetchCart(cartId, { token: getAuthToken(), lang })
      .then((c) => { if (current) { setCart(c); setError(null); } })
      .catch((err) => { if (current) setError(err.message); })
      .finally(() => { if (current) setIsLoading(false); });
    return () => { current = false; };
  }, [cartId, userId, lang]);

  const who = useCallback(() => ({ token: getAuthToken(), lang }), [lang]);

  const addItem = useCallback(async (productId: string, quantity: number) => {
    if (!cartId) return;
    setError(null);
    try {
      setCart(await addCartItem(cartId, productId, quantity, who()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add to cart");
      throw err;
    }
  }, [cartId, who]);

  const updateQuantity = useCallback(async (productId: string, quantity: number) => {
    if (!cartId) return;
    setError(null);
    try {
      setCart(await setCartItemQuantity(cartId, productId, quantity, who()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update quantity");
    }
  }, [cartId, who]);

  const removeItem = useCallback(async (productId: string) => {
    if (!cartId) return;
    setError(null);
    try {
      setCart(await removeCartItem(cartId, productId, who()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove item");
    }
  }, [cartId, who]);

  const lockPrices = useCallback(async () => {
    if (!cartId) return;
    try {
      setCart(await lockCartPrices(cartId, who()));
    } catch {
      // a lock that could not be taken is not worth stopping the checkout for: the live prices are shown instead
    }
  }, [cartId, who]);

  const applyPromo = useCallback(async (code: string | null) => {
    if (!cartId) return;
    setCart(await applyCartPromoCode(cartId, code, who()));
  }, [cartId, who]);

  const refreshCart = useCallback(async () => {
    if (!cartId) return;
    try { setCart(await fetchCart(cartId, who())); } catch { /* the cart on screen stays as it was */ }
  }, [cartId, who]);

  const clearAfterOrder = useCallback(() => {
    const id = crypto.randomUUID();
    writeCartIdCookie(id);
    setCartId(id);
    setCart({ cartId: id, items: [] });
    setError(null);
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const source = cart ?? { items: [] as Cart["items"] };
    return {
      cart, isLoading, error,
      itemCount: countOf(source), total: subtotalOf(source),
      summary: totalsOf({ items: source.items, appliedDiscountUsd: cart?.appliedDiscountUsd, appliedDiscountSource: cart?.appliedDiscountSource, loyaltyDiscountPercentage: cart?.loyaltyDiscountPercentage, appliedPromoCode: cart?.appliedPromoCode }),
      addItem, updateQuantity, removeItem, lockPrices, applyPromo, refreshCart, clearAfterOrder,
    };
  }, [cart, isLoading, error, addItem, updateQuantity, removeItem, lockPrices, applyPromo, refreshCart, clearAfterOrder]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}

/** The cart, or null when there is no CartProvider above (the page always has one; this is for a button inside a list, which must never take the whole list down). */
export function useOptionalCart(): CartContextValue | null {
  return useContext(CartContext);
}
