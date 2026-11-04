"use client";

import { useEffect, useRef, useState } from "react";
import { useCurrency } from "@/components/CurrencyProvider";
import { useT } from "@/components/LangProvider";
import { Price } from "@/components/Price";
import type { CartShipping } from "@/lib/api";

/**
 * Free shipping above a limit (the admin sets it; the server works the fee out and sends it with the cart as `shipping`). Three small pieces, drawn only when the rule is on:
 *   ShippingRow        a line of the order summary: "Shipping fees +$5" under the limit; at or above it the fee is struck through and says "Free"
 *   FreeShippingHint   a note under the lines: "Add $30 more for free shipping" with a progress bar; "You've reached $50: shipping is free" at the limit; "Free shipping with your promo code" when a code waives it
 *   FreeShippingBadge  a green "Free shipping" pill over the corner of the Checkout button, once shipping is free
 * With the rule off, or an older server that sends no `shipping`, none of them draws anything.
 *
 * Free shipping is celebrated (the same as the mobile app): every time the cart is opened with shipping already free, and the moment it becomes free. The note
 * glows green with a short pulse and a few pieces of confetti (when it has just become free, its bar first runs to the end), and the pill pops onto Checkout
 * with its truck driving; afterwards a light shine crosses the pill every few seconds. Someone who asked their computer to reduce motion sees it simply green.
 */
const TRUCK = (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
    <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18H9" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" /><circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" />
  </svg>
);
const MOTION_CSS = `
@keyframes fs-glow { 0% { box-shadow: 0 0 0 0 rgba(30,157,107,.55); transform: scale(1); } 25% { transform: scale(1.03); } 50% { transform: scale(1); } 100% { box-shadow: 0 0 18px 6px rgba(30,157,107,0); } }
@keyframes fs-piece { 0% { transform: translate(0,0) rotate(0); opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) rotate(400deg); opacity: 0; } }
@keyframes fs-pop { 0% { transform: scale(0); } 60% { transform: scale(1.18); } 100% { transform: scale(1); } }
@keyframes fs-drive { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(var(--drive, 6px)); } }
@keyframes fs-shine { 0% { transform: translateX(-120%) skewX(-20deg); } 32%, 100% { transform: translateX(320%) skewX(-20deg); } }
.fs-celebrate { animation: fs-glow 900ms ease-out both; }
.fs-piece { position: absolute; left: 50%; top: 14px; width: 6px; height: 6px; border-radius: 2px; animation: fs-piece 750ms ease-out both; pointer-events: none; }
.fs-pop { animation: fs-pop 450ms cubic-bezier(.34,1.56,.64,1) both; }
.fs-drive { animation: fs-drive 600ms ease-in-out 400ms both; }
[dir="rtl"] .fs-drive { --drive: -6px; }
.fs-shine { position: absolute; inset-block: 0; width: 34%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.75), transparent); animation: fs-shine 2200ms linear 900ms infinite; pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .fs-celebrate, .fs-piece, .fs-pop, .fs-drive, .fs-shine { animation: none !important; } .fs-piece, .fs-shine { display: none; } }
`;
/** The motion's CSS, put once into the page's <head> (not inside the pill or the note, so it is never part of their text or of the Checkout link's name). */
function useMotionStyles() {
  useEffect(() => {
    if (typeof document === "undefined" || document.getElementById("fs-motion")) return;
    const el = document.createElement("style");
    el.id = "fs-motion";
    el.textContent = MOTION_CSS;
    document.head.appendChild(el);
  }, []);
}

// The confetti: the same 14 pieces each time (no randomness, so the server and the browser draw the same thing).
const PIECES = Array.from({ length: 14 }, (_, i) => {
  const a = -Math.PI / 2 + (((i * 37) % 100) / 100 - 0.5) * 2.4;
  const v = 60 + ((i * 53) % 70);
  return { dx: `${Math.round(Math.cos(a) * v)}px`, dy: `${Math.round(Math.sin(a) * v + 60)}px`, color: i % 2 ? "#1e9d6b" : "#f9b317" };
});
function Confetti() {
  return <>{PIECES.map((p, i) => <span key={i} aria-hidden="true" className="fs-piece" style={{ background: p.color, ["--dx" as string]: p.dx, ["--dy" as string]: p.dy }} />)}</>;
}

/** Counts each celebration: a new one each time the cart opens free, or turns free while it is open (its key restarts the CSS animations). */
function useCelebration(done: boolean): number {
  const [n, setN] = useState(0);
  const was = useRef<boolean | null>(null);
  useEffect(() => {
    if (done && was.current !== true) setN((x) => x + 1);
    was.current = done;
  }, [done]);
  return n;
}

export const isFree = (s: CartShipping | null | undefined): boolean => Boolean(s && s.enabled && s.chargedUsd === 0 && (s.qualifies || s.waivedByPromo));

export function ShippingRow({ shipping }: { shipping?: CartShipping | null }) {
  const t = useT();
  if (!shipping || !shipping.enabled) return null;
  const free = shipping.chargedUsd === 0;
  return (
    <div data-testid="shipping-row" className="flex justify-between py-2">
      <span>{t("shipping_fees")}</span>
      {free ? (
        <span className="font-bold text-[#0f6b49]"><del data-testid="shipping-fee-struck" className="me-2 font-normal text-muted"><Price usd={shipping.feeUsd} /></del>{t("shipping_free")}</span>
      ) : (
        <span data-testid="shipping-fee">+<Price usd={shipping.chargedUsd} /></span>
      )}
    </div>
  );
}

export function FreeShippingHint({ shipping }: { shipping?: CartShipping | null }) {
  const t = useT();
  const { format } = useCurrency();
  const done = Boolean(shipping?.enabled && (shipping.waivedByPromo || shipping.qualifies));
  useMotionStyles();
  const celebration = useCelebration(done);
  // The moment it BECOMES free while the cart is open, the bar first runs to the end (0.45 s), then the note turns green.
  const lastBelow = useRef<{ percent: number; remaining: number } | null>(null);
  const [finishing, setFinishing] = useState<{ percent: number; remaining: number } | null>(null);
  useEffect(() => {
    if (!done) return;
    const from = lastBelow.current;
    lastBelow.current = null;
    const reduce = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!from || reduce) return;
    setFinishing(from);
    const timer = setTimeout(() => setFinishing(null), 450);
    return () => clearTimeout(timer);
  }, [done]);
  if (!shipping || !shipping.enabled) return null;
  const percentOf = (remaining: number) => (shipping.thresholdUsd > 0 ? Math.min(100, Math.max(0, Math.round(((shipping.thresholdUsd - remaining) / shipping.thresholdUsd) * 100))) : 0);
  if (finishing) {
    return (
      <div data-testid="shipping-hint" data-state="below" className="mt-1 flex items-start gap-2 rounded-[10px] border border-[#f3dd9a] bg-[#fff6dc] px-3 py-2.5 text-sm font-semibold text-[#6b4e00]">
        {TRUCK}
        <div className="min-w-0 flex-1">
          <span>{t("shipping_add_more", { amount: format(finishing.remaining) })}</span>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#efe3b8]"><div data-testid="shipping-progress" style={{ width: "100%", transition: "width 420ms ease-out" }} className="h-full bg-[#1e9d6b]" /></div>
        </div>
      </div>
    );
  }
  if (done) {
    const text = shipping.waivedByPromo ? t("shipping_promo_free") : t("shipping_reached", { amount: format(shipping.thresholdUsd) });
    return (
      <div className="relative mt-1">
        <div key={celebration} data-testid="shipping-hint" data-state={shipping.waivedByPromo ? "promo" : "reached"} role="status" className={`flex items-start gap-2 rounded-[10px] border border-[#b7e0cd] bg-[#e3f4ec] px-3 py-2.5 text-sm font-semibold text-[#0f6b49] ${celebration > 0 ? "fs-celebrate" : ""}`}>{TRUCK}<span>{text}</span></div>
        {celebration > 0 && <span key={`c${celebration}`} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible"><Confetti /></span>}
      </div>
    );
  }
  const percent = percentOf(shipping.remainingUsd);
  lastBelow.current = { percent, remaining: shipping.remainingUsd };
  return (
    <div data-testid="shipping-hint" data-state="below" className="mt-1 flex items-start gap-2 rounded-[10px] border border-[#f3dd9a] bg-[#fff6dc] px-3 py-2.5 text-sm font-semibold text-[#6b4e00]">
      {TRUCK}
      <div className="min-w-0 flex-1">
        <span>{t("shipping_add_more", { amount: format(shipping.remainingUsd) })}</span>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={t("shipping_fees")} className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#efe3b8]"><div data-testid="shipping-progress" style={{ width: `${percent}%`, transition: "width 420ms ease-out" }} className="h-full bg-[#1e9d6b]" /></div>
      </div>
    </div>
  );
}

export function FreeShippingBadge({ shipping }: { shipping?: CartShipping | null }) {
  const t = useT();
  const free = isFree(shipping);
  useMotionStyles();
  const celebration = useCelebration(free);
  if (!free) return null;
  return (
    <span key={celebration} data-testid="free-shipping-badge" className="fs-pop absolute -top-3.5 end-3.5 flex items-center gap-1.5 overflow-hidden rounded-full border-2 border-white bg-[#1e9d6b] px-2.5 py-1 text-[12.5px] font-bold text-white shadow-md" style={{ animationDelay: "250ms" }}>
      <span className="fs-drive flex">{TRUCK}</span>{t("shipping_free_badge")}
      <span aria-hidden="true" className="fs-shine" />
    </span>
  );
}
