"use client";

import Link from "@/components/LocLink";
import { useCart } from "@/components/CartProvider";
import { useT } from "@/components/LangProvider";

// Real, small -- the live item count in the header's cart link. Reads CartProvider's own real itemCount directly (the same real source of truth the cart page
// and the Add-to-cart button both use), so it can never drift out of sync with the actual cart.
export default function CartIcon() {
  const { itemCount } = useCart();
  const t = useT();
  return (
    <Link href="/cart" className="relative flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs font-semibold text-white hover:bg-white/10">
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h2l2 10h9l2-7H7" /><circle cx="9" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></svg>
      <span>{t("cart")}</span>
      {itemCount > 0 && (
        <span className="absolute top-0 end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-signal px-1 text-xs font-bold text-on-signal">
          {itemCount}
        </span>
      )}
    </Link>
  );
}
