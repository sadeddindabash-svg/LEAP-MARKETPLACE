"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { Cart, CartMerge, addCartItem, applyCartPromoCode, clearCart, fetchCart, lockCartPrices, removeCartItem, setCartItemQuantity } from "@/lib/api";
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
  /** Set when this device's basket was just combined with the account basket (one cart per account); null once dismissed. */
  mergeNotice: CartMerge | null;
  dismissMergeNotice: () => void;
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
  const [mergeNotice, setMergeNotice] = useState<CartMerge | null>(null);
  const cartIdRef = useRef(cartId);
  cartIdRef.current = cartId;
  /** What the server answered: the cart on screen. A signed-in buyer has ONE cart: when the answer is another cart (the account cart) this device uses its id from now on; a notice of carts combined is kept until dismissed. */
  const adopt = useCallback((c: Cart) => {
    setCart(c);
    if (c.cartId && c.cartId !== cartIdRef.current) { writeCartIdCookie(c.cartId); cartIdRef.current = c.cartId; setCartId(c.cartId); }
    if (c.merge) setMergeNotice(c.merge);
  }, []);
  // Signed out: this device gets a fresh empty guest cart, so the next person never sees the account's cart.
  const previousUserId = useRef(userId);
  useEffect(() => {
    if (previousUserId.current && !userId) {
      const id = crypto.randomUUID();
      writeCartIdCookie(id); cartIdRef.current = id; setCartId(id); setCart({ cartId: id, items: [] }); setMergeNotice(null); setError(null);
    }
    previousUserId.current = userId;
  }, [userId]);

  useEffect(() => {
    if (!cartId) return;
    let current = true;
    fetchCart(cartId, { token: getAuthToken(), lang })
      .then((c) => { if (current) { adopt(c); setError(null); } })
      .catch((err) => { if (current) setError(err.message); })
      .finally(() => { if (current) setIsLoading(false); });
    return () => { current = false; };
  }, [cartId, userId, lang]);

  const who = useCallback(() => ({ token: getAuthToken(), lang }), [lang]);

  const addItem = useCallback(async (productId: string, quantity: number) => {
    if (!cartId) return;
    setError(null);
    try {
      adopt(await addCartItem(cartId, productId, quantity, who()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add to cart");
      throw err;
    }
  }, [cartId, who]);

  const updateQuantity = useCallback(async (productId: string, quantity: number) => {
    if (!cartId) return;
    setError(null);
    try {
      adopt(await setCartItemQuantity(cartId, productId, quantity, who()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update quantity");
    }
  }, [cartId, who]);

  const removeItem = useCallback(async (productId: string) => {
    if (!cartId) return;
    setError(null);
    try {
      adopt(await removeCartItem(cartId, productId, who()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove item");
    }
  }, [cartId, who]);

  const lockPrices = useCallback(async () => {
    if (!cartId) return;
    try {
      adopt(await lockCartPrices(cartId, who()));
    } catch {
      // a lock that could not be taken is not worth stopping the checkout for: the live prices are shown instead
    }
  }, [cartId, who]);

  const applyPromo = useCallback(async (code: string | null) => {
    if (!cartId) return;
    adopt(await applyCartPromoCode(cartId, code, who()));
  }, [cartId, who]);

  const refreshCart = useCallback(async () => {
    if (!cartId) return;
    try { adopt(await fetchCart(cartId, who())); } catch { /* the cart on screen stays as it was */ }
  }, [cartId, who]);

  const clearAfterOrder = useCallback(() => {
    setError(null);
    if (getAuthToken()) {      // a signed-in buyer has ONE cart: it is emptied (every device shows it empty), not replaced by another
      setCart({ cartId: cartIdRef.current, items: [] });
      clearCart(cartIdRef.current, who()).then(adopt).catch(() => { /* the cart on screen is already empty; the next refresh shows the server's */ });
      return;
    }
    const id = crypto.randomUUID();
    writeCartIdCookie(id); cartIdRef.current = id; setCartId(id);
    setCart({ cartId: id, items: [] });
  }, [who, adopt]);
  const dismissMergeNotice = useCallback(() => setMergeNotice(null), []);

  const value = useMemo<CartContextValue>(() => {
    const source = cart ?? { items: [] as Cart["items"] };
    return {
      cart, isLoading, error,
      itemCount: countOf(source), total: subtotalOf(source),
      summary: totalsOf({ items: source.items, appliedDiscountUsd: cart?.appliedDiscountUsd, appliedDiscountSource: cart?.appliedDiscountSource, loyaltyDiscountPercentage: cart?.loyaltyDiscountPercentage, appliedPromoCode: cart?.appliedPromoCode, shipping: cart?.shipping }),
      addItem, updateQuantity, removeItem, lockPrices, applyPromo, refreshCart, clearAfterOrder, mergeNotice, dismissMergeNotice,
    };
  }, [cart, isLoading, error, addItem, updateQuantity, removeItem, lockPrices, applyPromo, refreshCart, clearAfterOrder, mergeNotice, dismissMergeNotice]);

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
