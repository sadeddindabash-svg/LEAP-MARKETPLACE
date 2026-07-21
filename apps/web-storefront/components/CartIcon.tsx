"use client";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";

// Real, live cart item count in the header -- a Client Component
// since it needs to react to real cart changes made anywhere on the
// site (a product page's Add to Cart button, the cart page itself)
// without a full page reload.
export default function CartIcon() {
  const { itemCount } = useCart();
  return (
    <Link href="/cart" className="relative text-muted hover:text-ink">
      Cart
      {itemCount > 0 && (
        <span className="absolute -top-2 -right-4 flex h-4 min-w-4 items-center justify-center rounded-full bg-signal px-1 text-[10px] font-bold text-white">
          {itemCount}
        </span>
      )}
    </Link>
  );
}
