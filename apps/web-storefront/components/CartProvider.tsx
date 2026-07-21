"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  Cart,
  addCartItem,
  fetchCart,
  removeCartItem,
  setCartItemQuantity,
} from "@/lib/api";

// Real, client-side cart state -- the cart is a real, per-visitor,
// interactive concern with no SEO value, so this is deliberately the
// one part of this app that isn't a Server Component. A real cart ID
// persists in a real cookie (not localStorage -- the checkout page
// clears it via document.cookie after a real order is placed, and a
// cookie is the more conventional real-world choice for this exact
// kind of per-visitor identifier) so a visitor's real cart survives a
// page refresh or closing the tab.
const CART_ID_COOKIE = "leap_cart_id";

function readCartIdCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CART_ID_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCartIdCookie(id: string) {
  // Real, 30-day real cart persistence -- long enough for a real
  // visitor to come back and finish a real purchase, short enough not
  // to accumulate forever for someone who never returns.
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
  total: number;
  addItem: (productId: string, quantity: number) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  // Real, lazy initial state -- computed once on mount (reading/
  // creating the real cookie), rather than a separate real useEffect
  // that calls setState synchronously right away, which would trigger
  // a real, avoidable extra render.
  const [cartId] = useState<string>(() => getOrCreateCartId());
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cartId) return;
    fetchCart(cartId)
      .then(setCart)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [cartId]);

  const addItem = useCallback(
    async (productId: string, quantity: number) => {
      if (!cartId) return;
      setError(null);
      try {
        setCart(await addCartItem(cartId, productId, quantity));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add to cart");
        throw err;
      }
    },
    [cartId]
  );

  const updateQuantity = useCallback(
    async (productId: string, quantity: number) => {
      if (!cartId) return;
      setError(null);
      try {
        setCart(await setCartItemQuantity(cartId, productId, quantity));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update quantity");
      }
    },
    [cartId]
  );

  const removeItem = useCallback(
    async (productId: string) => {
      if (!cartId) return;
      setError(null);
      try {
        setCart(await removeCartItem(cartId, productId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove item");
      }
    },
    [cartId]
  );

  const itemCount = cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  const total = cart?.items.reduce((sum, i) => sum + i.price * i.quantity, 0) ?? 0;

  return (
    <CartContext.Provider
      value={{ cart, isLoading, error, itemCount, total, addItem, updateQuantity, removeItem }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
