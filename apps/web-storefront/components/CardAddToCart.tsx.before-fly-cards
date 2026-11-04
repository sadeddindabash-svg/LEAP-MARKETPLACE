"use client";

import { useEffect, useRef, useState } from "react";
import { useOptionalCart } from "@/components/CartProvider";
import { useT } from "@/components/LangProvider";

const CART = <><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></>;
const Svg = ({ children }: { children: React.ReactNode }) => <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;

/**
 * The add-to-cart icon on a product card: one press puts ONE of this part in the cart (another press, one more) and shows a check mark for a moment. It is a button of its own, never inside the card's link. With none in stock it is
 * greyed out and cannot be pressed.
 */
export default function CardAddToCart({ productId, name, inStock }: { productId: string; name: string; inStock: boolean }) {
  const cart = useOptionalCart();
  const t = useT();
  const [status, setStatus] = useState<"idle" | "adding" | "added" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  if (!inStock || !cart) {
    return <button type="button" disabled aria-label={inStock ? `${t("add_to_cart")}: ${name}` : `${t("out_of_stock")}: ${name}`} className="grid size-11 cursor-not-allowed place-items-center rounded-[11px] bg-[#e6edf2] text-[#8696a2]"><Svg>{CART}</Svg></button>;
  }
  const press = async () => {
    if (status === "adding") return;
    setStatus("adding");
    try { await cart.addItem(productId, 1); setStatus("added"); } catch { setStatus("error"); }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 1600);
  };
  return (
    <>
      <button type="button" onClick={press} disabled={status === "adding"} aria-label={`${t("add_to_cart")}: ${name}`} title={status === "error" ? t("add_failed") : undefined} data-status={status}
        className="grid size-11 place-items-center rounded-[11px] bg-signal text-on-signal shadow-[0_2px_6px_rgba(250,178,25,0.4)] transition-colors hover:bg-signal-dark disabled:opacity-60">
        {status === "added" ? <Svg><path d="m5 12 5 5 9-10" /></Svg> : status === "error" ? <Svg><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></Svg> : <Svg>{CART}</Svg>}
      </button>
      <span role="status" className="sr-only">{status === "added" ? t("added") : status === "error" ? t("add_failed") : ""}</span>
    </>
  );
}
