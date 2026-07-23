"use client";

import { useEffect, useState } from "react";
import { useAuth, getAuthToken } from "@/components/AuthProvider";
import { checkWishlisted, addToWishlist, removeFromWishlist } from "@/lib/api";

interface Props {
  productId: string;
}

// Real "add to wishlist" heart toggle -- a Client Component embedded
// inside the otherwise server-rendered product page, same reasoning
// as AddToCartButton. Requires a real logged-in account (unlike the
// cart, which works for guests) -- prompts to log in rather than
// silently doing nothing when signed out.
export function WishlistButton({ productId }: Props) {
  const { user, isLoading: authLoading } = useAuth();
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsChecking(false);
      return;
    }
    const token = getAuthToken();
    if (!token) return;
    checkWishlisted(token, productId)
      .then(setIsWishlisted)
      .finally(() => setIsChecking(false));
  }, [authLoading, user, productId]);

  const handleToggle = async () => {
    const token = getAuthToken();
    if (!token) return;
    setIsToggling(true);
    try {
      if (isWishlisted) {
        await removeFromWishlist(token, productId);
        setIsWishlisted(false);
      } else {
        await addToWishlist(token, productId);
        setIsWishlisted(true);
      }
    } catch {
      // Real, honest no-op on failure -- the button just stays in its
      // last known-good state rather than showing a misleading toggle.
    } finally {
      setIsToggling(false);
    }
  };

  if (authLoading || isChecking) {
    return (
      <button disabled className="mt-3 w-full rounded-md border border-line px-6 py-3 text-muted font-semibold opacity-60">
        ♡ Wishlist
      </button>
    );
  }

  if (!user) {
    return (
      <a
        href="/login"
        className="mt-3 flex w-full items-center justify-center rounded-md border border-line px-6 py-3 text-muted font-semibold hover:border-signal hover:text-signal transition-colors"
      >
        ♡ Log in to save
      </a>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isToggling}
      className={`mt-3 w-full rounded-md border px-6 py-3 font-semibold transition-colors disabled:opacity-60 ${
        isWishlisted ? "border-signal text-signal" : "border-line text-ink hover:border-signal hover:text-signal"
      }`}
    >
      {isWishlisted ? "♥ Saved to wishlist" : "♡ Add to wishlist"}
    </button>
  );
}
