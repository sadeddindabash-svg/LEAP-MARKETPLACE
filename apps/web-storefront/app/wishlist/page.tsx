"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, getAuthToken } from "@/components/AuthProvider";
import { ProductSummary, fetchWishlist, removeFromWishlist, resolveImageUrl } from "@/lib/api";

// Real wishlist page (new) -- a buyer's saved-for-later products.
// Client Component, same reasoning as orders/saved-searches: real
// logged-in account, no SEO value in a buyer's own private list.
export default function WishlistPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<ProductSummary[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      Promise.resolve().then(() => setLoadState("ready"));
      return;
    }
    const token = getAuthToken();
    if (!token) return;
    fetchWishlist(token)
      .then((data) => { setItems(data); setLoadState("ready"); })
      .catch((err) => { setError(err.message); setLoadState("error"); });
  }, [authLoading, user]);

  const handleRemove = async (productId: string) => {
    const token = getAuthToken();
    if (!token) return;
    try {
      await removeFromWishlist(token, productId);
      setItems((prev) => prev.filter((p) => p.id !== productId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    }
  };

  if (authLoading || loadState === "loading") {
    return <div className="mx-auto max-w-2xl px-6 py-16 text-muted">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="font-display font-bold text-3xl">Wishlist</h1>
        <p className="mt-3 text-muted">Log in to save products for later.</p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center rounded-md bg-signal px-6 py-3 text-white font-semibold hover:bg-signal-dark transition-colors"
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display font-bold text-3xl">Wishlist</h1>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {loadState === "ready" && items.length === 0 ? (
        <p className="mt-8 text-muted">
          Nothing saved yet.{" "}
          <Link href="/" className="text-signal font-medium">
            Start shopping
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8 space-y-3">
          {items.map((p) => (
            <div key={p.id} className="flex items-center gap-4 rounded-lg border border-line bg-white p-4">
              {p.images.length > 0 && (
                // eslint-disable-next-line @next/next/no-img-element -- see app/page.tsx's own comment on why next/image isn't used yet
                <img src={resolveImageUrl(p.images[0])} alt="" className="h-16 w-16 rounded-md object-cover flex-shrink-0" />
              )}
              <Link href={`/products/${p.id}`} className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{p.name}</p>
                <p className="text-xs text-muted mt-1">{p.currencyCode} {p.price.toFixed(2)}</p>
              </Link>
              <button
                onClick={() => handleRemove(p.id)}
                className="text-xs font-semibold text-muted hover:text-ink flex-shrink-0"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
