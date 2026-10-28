"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { addToWishlist, fetchWishlist, removeFromWishlist } from "@/lib/api";
import { getAuthToken, useAuth } from "@/components/AuthProvider";

/**
 * ONE list of the signed-in buyer's saved parts, loaded once, that every heart on the page reads (a page of 24 cards makes one request, not 24). A heart changes at once and goes back if the save fails.
 * Signed out: nothing is loaded and `signedIn` is false (the heart then leads to the login page).
 */
export interface WishlistContextValue {
  signedIn: boolean;
  /** The list has been loaded (or there is nothing to load). */
  ready: boolean;
  isSaved: (productId: string) => boolean;
  toggle: (productId: string) => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const userId = user?.id ?? null;
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());
  const [ready, setReady] = useState(false);
  const idsRef = useRef<ReadonlySet<string>>(ids);
  const pending = useRef(new Set<string>());
  idsRef.current = ids;

  useEffect(() => {
    if (isLoading) return;
    let alive = true;
    if (!userId) { setIds(new Set()); setReady(true); return; }
    const token = getAuthToken();
    if (!token) { setIds(new Set()); setReady(true); return; }
    setReady(false);
    fetchWishlist(token)
      .then((list) => { if (alive) setIds(new Set(list.map((p) => p.id))); })
      .catch(() => { /* the hearts stay empty: a failed load never shows a wrong "saved" */ })
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [isLoading, userId]);

  const toggle = useCallback(async (productId: string) => {
    const token = getAuthToken();
    if (!token || pending.current.has(productId)) return;
    const wasSaved = idsRef.current.has(productId);
    const set = (saved: boolean) => setIds((cur) => { const next = new Set(cur); if (saved) next.add(productId); else next.delete(productId); return next; });
    pending.current.add(productId);
    set(!wasSaved);
    try {
      if (wasSaved) await removeFromWishlist(token, productId); else await addToWishlist(token, productId);
    } catch {
      set(wasSaved);
    } finally {
      pending.current.delete(productId);
    }
  }, []);

  const value = useMemo<WishlistContextValue>(() => ({ signedIn: !!userId, ready, isSaved: (id) => ids.has(id), toggle }), [userId, ready, ids, toggle]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

/** The shared list, or null where there is no provider (a heart then draws nothing, like the card's cart button without a cart). */
export function useOptionalWishlist(): WishlistContextValue | null {
  return useContext(WishlistContext);
}
