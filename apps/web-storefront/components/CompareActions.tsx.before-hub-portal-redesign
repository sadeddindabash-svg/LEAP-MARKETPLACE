"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useOptionalCart } from "@/components/CartProvider";
import { useT } from "@/components/LangProvider";
import { flyToCart } from "@/lib/flyToCart";

/** "Add to cart" under one compared part: one of it goes in the cart, its photo flies there, and the button says "Added" for 2 seconds. */
export function CompareAddButton({ productId, inStock }: { productId: string; inStock: boolean }) {
  const cart = useOptionalCart();
  const t = useT();
  const [state, setState] = useState<"idle" | "adding" | "added" | "error">("idle");
  const button = useRef<HTMLButtonElement>(null);
  if (!inStock) return <span className="inline-flex min-h-9 items-center rounded-[10px] bg-[#eef2f5] px-3 text-[13px] font-bold text-muted">{t("out_of_stock")}</span>;
  const add = async () => {
    if (!cart) return;
    flyToCart(button.current?.closest("th")?.querySelector("img") ?? button.current);
    setState("adding");
    try { await cart.addItem(productId, 1); setState("added"); setTimeout(() => setState("idle"), 2000); } catch { setState("error"); }
  };
  return (
    <button ref={button} type="button" onClick={add} disabled={state === "adding"} className="inline-flex min-h-9 items-center rounded-[10px] bg-signal px-4 text-[13px] font-bold text-on-signal hover:bg-signal-dark disabled:opacity-60">
      {state === "added" ? `✓ ${t("added")}` : t("add_to_cart")}
    </button>
  );
}

/** "Share comparison": in the navy box at the top of the page when the account menu is there, otherwise above the table (the Wishlist tabs lead back to the saved parts). */
export function CompareTopActions() {
  const t = useT();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setSlot(document.getElementById("account-header-actions")); }, []);
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: document.title, url }); return; }
      await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { /* the buyer closed the share sheet */ }
  };
  const onNavy = !!slot;
  const actions = (
    <div data-testid="compare-actions" className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={share} className="inline-flex min-h-10 items-center rounded-[10px] bg-signal px-4 text-sm font-bold text-on-signal hover:bg-signal-dark">{copied ? `✓ ${t("link_copied")}` : t("compare_share")}</button>
    </div>
  );
  return slot ? createPortal(actions, slot) : <div className="mb-3">{actions}</div>;
}
