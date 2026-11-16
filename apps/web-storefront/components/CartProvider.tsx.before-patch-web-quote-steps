"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { Cart, CartMerge, addCartItem, applyCartPromoCode, clearCart, fetchCart, lockCartPrices, removeCartItem, setCartItemQuantity } from "@/lib/api";
import { itemCount as countOf, subtotal as subtotalOf, totals as totalsOf } from "@/lib/cart";
import { readUnselected, selectedCart, selectedSummary as selectedSummaryOf, writeUnselected } from "@/lib/cartSelection";
import { getAuthToken, useAuth } from "./AuthProvider";
import { useLang } from "./LangProvider";
import { useAutoRefresh } from "./useAutoRefresh";

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
  /** After an order: the lines that were ordered leave the basket (all of them: a brand new empty cart), so the count in the header drops at once. Lines that were not
   *  ticked, and so not ordered, stay. */
  clearAfterOrder: (orderedProductIds?: string[]) => void;
  /** Choosing what to order: the lines NOT ticked (remembered in this browser; every line is ticked to start with, and a part added again is ticked again). */
  unselected: ReadonlySet<string>;
  toggleSelected: (productId: string) => void;
  setAllSelected: (on: boolean) => void;
  /** The basket as the checkout sees it: only the ticked lines, with their own discount and shipping fee (exactly the server's basket when all are ticked). */
  selected: Cart | null;
  selectedSummary: ReturnType<typeof totalsOf>;
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
  const [unselected, setUnselected] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => { setUnselected(readUnselected()); }, []);                      // read after the first paint (the server cannot know this browser's choice)
  const changeUnselected = useCallback((next: (cur: ReadonlySet<string>) => Set<string>) => {
    setUnselected((cur) => { const n = next(cur); writeUnselected(n); return n; });
  }, []);
  const toggleSelected = useCallback((productId: string) => changeUnselected((cur) => { const n = new Set(cur); if (n.has(productId)) n.delete(productId); else n.add(productId); return n; }), [changeUnselected]);
  const cartIdRef = useRef(cartId);
  cartIdRef.current = cartId;
  const cartRef = useRef<Cart | null>(null);
  const adoptions = useRef(0);      // counts the answers put on screen: a quiet refresh that was overtaken by another answer is dropped
  /** What the server answered: the cart on screen. A signed-in buyer has ONE cart: when the answer is another cart (the account cart) this device uses its id from now on; a notice of carts combined is kept until dismissed. */
  const adopt = useCallback((c: Cart) => {
    adoptions.current += 1;
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
    changeUnselected((cur) => { if (!cur.has(productId)) return new Set(cur); const n = new Set(cur); n.delete(productId); return n; });     // added again: ticked again
    try {
      adopt(await addCartItem(cartId, productId, quantity, who()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add to cart");
      throw err;
    }
  }, [cartId, who, changeUnselected]);

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

  // A signed-in buyer's cart is the same on every device: it is read again every 5 seconds (quietly; an answer that arrives after a newer one is dropped, and an error keeps what is on screen).
  useAutoRefresh(async () => {
    const before = adoptions.current;
    const fresh = await fetchCart(cartIdRef.current, who());
    if (adoptions.current === before) adopt(fresh);
  }, { enabled: !!userId && !!cartId });

  const clearAfterOrder = useCallback((orderedProductIds?: string[]) => {
    setError(null);
    const ordered = orderedProductIds ? new Set(orderedProductIds) : null;
    const kept = ordered ? (cartRef.current?.items ?? []).filter((i) => !ordered.has(i.productId)) : [];
    if (ordered && kept.length > 0) {
      // Only some lines were ordered: those leave the basket, one by one; the lines that were not ticked stay (still not ticked).
      setCart((c) => (c ? { ...c, items: kept } : c));
      (async () => { for (const id of ordered) { try { adopt(await removeCartItem(cartIdRef.current, id, who())); } catch { /* the next refresh shows the server's basket */ } } })();
      return;
    }
    changeUnselected(() => new Set());
    if (getAuthToken()) {      // a signed-in buyer has ONE cart: it is emptied (every device shows it empty), not replaced by another
      setCart({ cartId: cartIdRef.current, items: [] });
      clearCart(cartIdRef.current, who()).then(adopt).catch(() => { /* the cart on screen is already empty; the next refresh shows the server's */ });
      return;
    }
    const id = crypto.randomUUID();
    writeCartIdCookie(id); cartIdRef.current = id; setCartId(id);
    setCart({ cartId: id, items: [] });
  }, [who, adopt, changeUnselected]);
  const setAllSelected = useCallback((on: boolean) => changeUnselected(() => (on ? new Set() : new Set((cartRef.current?.items ?? []).map((i) => i.productId)))), [changeUnselected]);
  const dismissMergeNotice = useCallback(() => setMergeNotice(null), []);

  cartRef.current = cart;
  // Only lines still in the basket count as not ticked (a line removed, or ordered, is forgotten).
  const liveUnselected = useMemo(() => new Set([...unselected].filter((id) => cart?.items.some((i) => i.productId === id))), [unselected, cart]);
  useEffect(() => { if (cart && liveUnselected.size !== unselected.size) writeUnselected(liveUnselected); }, [cart, liveUnselected, unselected]);

  const value = useMemo<CartContextValue>(() => {
    const source = cart ?? { items: [] as Cart["items"] };
    const chosen = cart ? selectedCart(cart, liveUnselected) : null;
    return {
      cart, isLoading, error,
      itemCount: countOf(source), total: subtotalOf(source),
      summary: totalsOf({ items: source.items, appliedDiscountUsd: cart?.appliedDiscountUsd, appliedDiscountSource: cart?.appliedDiscountSource, loyaltyDiscountPercentage: cart?.loyaltyDiscountPercentage, appliedPromoCode: cart?.appliedPromoCode, shipping: cart?.shipping }),
      addItem, updateQuantity, removeItem, lockPrices, applyPromo, refreshCart, clearAfterOrder, mergeNotice, dismissMergeNotice,
      unselected: liveUnselected, toggleSelected, setAllSelected,
      selected: chosen,
      selectedSummary: cart ? selectedSummaryOf(cart, liveUnselected) : totalsOf({ items: [] }),
    };
  }, [cart, isLoading, error, addItem, updateQuantity, removeItem, lockPrices, applyPromo, refreshCart, clearAfterOrder, mergeNotice, dismissMergeNotice, liveUnselected, toggleSelected, setAllSelected]);

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
