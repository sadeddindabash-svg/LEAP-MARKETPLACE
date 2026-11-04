"use client";

import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { useT } from "@/components/LangProvider";

interface Props {
  productId: string;
  inStock: boolean;
  /** The price of one (in US dollars): the button then says "Add to cart · total" and the total follows the quantity. */
  unitPrice?: number;
  /** How many are in stock: the quantity cannot go above it. */
  maxQuantity?: number;
}

// Real "Add to cart" action -- a Client Component embedded inside the otherwise server-rendered product page (see app/products/[id]/page.tsx), which is fine: Server Components can render Client Components with plain, serializable props.
export function AddToCartButton({ productId, inStock, unitPrice, maxQuantity }: Props) {
  const { addItem } = useCart();
  const { format } = useCurrency();
  const t = useT();
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<"idle" | "adding" | "added" | "error">("idle");
  const max = maxQuantity != null && maxQuantity > 0 ? maxQuantity : Infinity;

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
        {t("out_of_stock")}
      </button>
    );
  }

  const atMax = quantity >= max;
  const idle = unitPrice != null ? t("add_to_cart_total", { total: format(unitPrice * quantity) }) : t("add_to_cart");
  return (
    <div className="mt-6 flex gap-3">
      <div className="flex items-center rounded-md border border-line">
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          className="px-3 py-3 text-muted hover:text-ink"
          aria-label={t("decrease_quantity")}
        >
          −
        </button>
        <span className="w-8 text-center font-medium">{quantity}</span>
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.min(max, q + 1))}
          disabled={atMax}
          className="px-3 py-3 text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={t("increase_quantity")}
        >
          +
        </button>
      </div>
      <button
        onClick={handleAdd}
        disabled={status === "adding"}
        className="flex-1 rounded-md bg-signal px-6 py-3 text-on-signal font-semibold hover:bg-signal-dark transition-colors disabled:opacity-60"
      >
        {status === "adding" ? t("adding") : status === "added" ? `${t("added")} ✓` : status === "error" ? t("add_failed") : idle}
      </button>
    </div>
  );
}
