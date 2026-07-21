"use client";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";

// Real Client Component -- a cart is inherently interactive (quantity
// changes, removal) and never needs to be indexed by a search engine,
// so there's no real SEO reason for this page to be server-rendered
// like the browsing/product pages are.
export default function CartPage() {
  const { cart, isLoading, updateQuantity, removeItem, total } = useCart();

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-6 py-16 text-muted">Loading your cart…</div>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="font-display font-bold text-3xl">Your cart is empty</h1>
        <p className="mt-3 text-muted">Find a part to get started.</p>
        <Link
          href="/search"
          className="mt-6 inline-flex items-center rounded-md bg-signal px-6 py-3 text-white font-semibold hover:bg-signal-dark transition-colors"
        >
          Browse parts
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display font-bold text-3xl mb-8">Your cart</h1>

      <div className="space-y-4">
        {cart.items.map((item) => (
          <div
            key={item.productId}
            className="flex items-center gap-4 rounded-lg border border-line bg-white p-4"
          >
            <div className="flex-1">
              <Link href={`/products/${item.productId}`} className="font-medium hover:text-signal">
                {item.name}
              </Link>
              {item.supplierName && (
                <p className="text-xs text-muted mt-1">Sold by {item.supplierName}</p>
              )}
              <p className="font-display font-bold text-lg mt-1">
                ${item.price.toFixed(2)}
              </p>
            </div>
            <div className="flex items-center border border-line rounded-md">
              <button
                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                className="px-3 py-1.5 text-muted hover:text-ink"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="px-3 text-sm font-medium w-8 text-center">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                className="px-3 py-1.5 text-muted hover:text-ink"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
            <button
              onClick={() => removeItem(item.productId)}
              className="text-sm text-muted hover:text-red-600"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-line pt-6">
        <span className="font-display font-bold text-xl">Total</span>
        <span className="font-display font-bold text-2xl">${total.toFixed(2)}</span>
      </div>

      <Link
        href="/checkout"
        className="mt-6 block text-center rounded-md bg-signal px-6 py-3 text-white font-semibold hover:bg-signal-dark transition-colors"
      >
        Proceed to checkout
      </Link>
    </div>
  );
}
