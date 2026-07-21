"use client";

import { useState } from "react";
import { useCart } from "@/components/CartProvider";

interface Props {
  productId: string;
  inStock: boolean;
}

// Real "Add to cart" action -- a Client Component embedded inside the
// otherwise server-rendered product page (see app/products/[id]/page.tsx),
// which is fine: Server Components can render Client Components with
// plain, serializable props like these two.
export function AddToCartButton({ productId, inStock }: Props) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<"idle" | "adding" | "added" | "error">("idle");

  const handleAdd = async () => {
    setStatus("adding");
    try {
      await addItem(productId, quantity);
      setStatus("added");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  };

  if (!inStock) {
    return (
      <button
        disabled
        className="mt-6 w-full rounded-md bg-line px-6 py-3 text-muted font-semibold cursor-not-allowed"
      >
        Out of stock
      </button>
    );
  }

  return (
    <div className="mt-6 flex gap-3">
      <div className="flex items-center rounded-md border border-line">
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          className="px-3 py-3 text-muted hover:text-ink"
          aria-label="Decrease quantity"
        >
          −
        </button>
        <span className="w-8 text-center font-medium">{quantity}</span>
        <button
          type="button"
          onClick={() => setQuantity((q) => q + 1)}
          className="px-3 py-3 text-muted hover:text-ink"
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>
      <button
        onClick={handleAdd}
        disabled={status === "adding"}
        className="flex-1 rounded-md bg-signal px-6 py-3 text-white font-semibold hover:bg-signal-dark transition-colors disabled:opacity-60"
      >
        {status === "adding" ? "Adding…" : status === "added" ? "Added ✓" : status === "error" ? "Couldn't add — try again" : "Add to cart"}
      </button>
    </div>
  );
}
