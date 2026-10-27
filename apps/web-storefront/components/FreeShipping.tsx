"use client";

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
 */
const TRUCK = (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
    <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18H9" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" /><circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" />
  </svg>
);
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
  if (!shipping || !shipping.enabled) return null;
  if (shipping.waivedByPromo) {
    return <div data-testid="shipping-hint" data-state="promo" role="status" className="mt-1 flex items-start gap-2 rounded-[10px] border border-[#b7e0cd] bg-[#e3f4ec] px-3 py-2.5 text-sm font-semibold text-[#0f6b49]">{TRUCK}<span>{t("shipping_promo_free")}</span></div>;
  }
  if (shipping.qualifies) {
    return <div data-testid="shipping-hint" data-state="reached" role="status" className="mt-1 flex items-start gap-2 rounded-[10px] border border-[#b7e0cd] bg-[#e3f4ec] px-3 py-2.5 text-sm font-semibold text-[#0f6b49]">{TRUCK}<span>{t("shipping_reached", { amount: format(shipping.thresholdUsd) })}</span></div>;
  }
  const percent = shipping.thresholdUsd > 0 ? Math.min(100, Math.max(0, Math.round(((shipping.thresholdUsd - shipping.remainingUsd) / shipping.thresholdUsd) * 100))) : 0;
  return (
    <div data-testid="shipping-hint" data-state="below" className="mt-1 flex items-start gap-2 rounded-[10px] border border-[#f3dd9a] bg-[#fff6dc] px-3 py-2.5 text-sm font-semibold text-[#6b4e00]">
      {TRUCK}
      <div className="min-w-0 flex-1">
        <span>{t("shipping_add_more", { amount: format(shipping.remainingUsd) })}</span>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={t("shipping_fees")} className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#efe3b8]"><div data-testid="shipping-progress" style={{ width: `${percent}%` }} className="h-full bg-[#1e9d6b]" /></div>
      </div>
    </div>
  );
}

export function FreeShippingBadge({ shipping }: { shipping?: CartShipping | null }) {
  const t = useT();
  if (!isFree(shipping)) return null;
  return <span data-testid="free-shipping-badge" className="absolute -top-3.5 end-3.5 flex items-center gap-1.5 rounded-full border-2 border-white bg-[#1e9d6b] px-2.5 py-1 text-[12.5px] font-bold text-white shadow-md">{TRUCK}{t("shipping_free_badge")}</span>;
}
