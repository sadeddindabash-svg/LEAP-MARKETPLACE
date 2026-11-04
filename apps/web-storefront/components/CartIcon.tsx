"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/LocLink";
import { useCart } from "@/components/CartProvider";
import { useT } from "@/components/LangProvider";
import { FLY_LANDED, FLY_START } from "@/lib/flyToCart";

const reduceMotion = () => typeof window === "undefined" || typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Real, small -- the live item count in the header's cart link. Reads CartProvider's own real itemCount directly (the same real source of truth the cart page
// and the Add-to-cart button both use), so it can never drift out of sync with the actual cart.
// "Fly to cart" (lib/flyToCart.ts): it is where an added part lands (data-cart-target). While a part is in the air its number waits; when the part lands the cart
// bounces and the number goes up, with a small pop.
export default function CartIcon() {
  const { itemCount } = useCart();
  const t = useT();
  const [held, setHeld] = useState<number | null>(null);
  const [landings, setLandings] = useState(0);
  const count = useRef(itemCount);
  count.current = itemCount;
  const icon = useRef<SVGSVGElement>(null);
  const badge = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const start = () => setHeld((h) => h ?? count.current);
    const land = () => { setHeld(null); setLandings((n) => n + 1); };
    window.addEventListener(FLY_START, start);
    window.addEventListener(FLY_LANDED, land);
    return () => { window.removeEventListener(FLY_START, start); window.removeEventListener(FLY_LANDED, land); };
  }, []);

  useEffect(() => {
    if (landings === 0 || reduceMotion()) return;
    icon.current?.animate?.([{ transform: "scale(1) rotate(0)" }, { transform: "scale(1.28) rotate(-8deg)" }, { transform: "scale(1) rotate(0)" }], { duration: 360, easing: "ease-out" });
    badge.current?.animate?.([{ transform: "scale(1)" }, { transform: "scale(1.45)" }, { transform: "scale(1)" }], { duration: 300, easing: "ease-out" });
  }, [landings]);

  const shown = held ?? itemCount;
  return (
    <Link href="/cart" data-cart-target="" className="relative flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs font-semibold text-white hover:bg-white/10">
      <svg ref={icon} aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h2l2 10h9l2-7H7" /><circle cx="9" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></svg>
      <span>{t("cart")}</span>
      {shown > 0 && (
        <span ref={badge} className="absolute top-0 end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-signal px-1 text-xs font-bold text-on-signal">
          {shown}
        </span>
      )}
    </Link>
  );
}
