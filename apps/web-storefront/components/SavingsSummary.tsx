"use client";

import { useT } from "@/components/LangProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { Price } from "@/components/Price";

/**
 * Every saving in the order summary (confirmed with the person via mockup): the parts' own discount (a discount rule, or a price held at
 * checkout), the promo or loyalty discount, and the free shipping, added up in one "You save". The total itself never changes here.
 */
type Savings = { itemsBefore?: number; partsSaved?: number; discount: number; shippingSaved: number; saved: number; source: string };

/** "Items before discounts" and "Discount on parts", only when a part is cheaper than its normal price. */
export function PartsDiscountRows({ summary }: { summary: Savings }) {
  const t = useT();
  if (!((summary.partsSaved ?? 0) > 0.004)) return null;
  return (
    <>
      <div data-testid="items-before-discounts" className="flex justify-between border-t border-line py-2"><span>{t("items_before_discounts")}</span><Price usd={summary.itemsBefore ?? 0} /></div>
      <div data-testid="parts-discount" className="flex justify-between py-2 font-semibold text-[#0f6b49]"><span>{t("parts_discount")}</span><span>−<Price usd={summary.partsSaved ?? 0} /></span></div>
    </>
  );
}

/** "36 parts discount + 10 loyalty + 21 free shipping" (in the buyer's currency). */
export function useSavedBreakdown(summary: Savings): string {
  const t = useT();
  const { format } = useCurrency();
  const parts: string[] = [];
  if ((summary.partsSaved ?? 0) > 0.004) parts.push(t("saved_part_parts", { amount: format(summary.partsSaved ?? 0) }));
  if (summary.discount > 0.004) parts.push(t(summary.source === "loyalty" ? "saved_part_loyalty" : "saved_part_promo", { amount: format(summary.discount) }));
  if (summary.shippingSaved > 0.004) parts.push(t("saved_part_shipping", { amount: format(summary.shippingSaved) }));
  return parts.join(" + ");
}

/** The basket: the line under "You saved", now with every saving. */
export function SavedDetail({ summary }: { summary: Savings }) {
  const text = useSavedBreakdown(summary);
  const pieces = [(summary.partsSaved ?? 0) > 0.004, summary.discount > 0.004, summary.shippingSaved > 0.004].filter(Boolean).length;
  if (pieces < 2) return null;
  return <p data-testid="you-saved-detail" className="text-[12.5px] text-muted">{text}</p>;
}

/** The checkout: the gold "You save" card (design H, confirmed with the person): a light sweeps across it every few seconds; the savings as chips. */
export function YouSaveBox({ summary }: { summary: Savings }) {
  const t = useT();
  const { format } = useCurrency();
  if (!(summary.saved > 0.004)) return null;
  const chips: string[] = [];
  if ((summary.partsSaved ?? 0) > 0.004) chips.push(t("saved_part_parts", { amount: format(summary.partsSaved ?? 0) }));
  if (summary.discount > 0.004) chips.push(t(summary.source === "loyalty" ? "saved_part_loyalty" : "saved_part_promo", { amount: format(summary.discount) }));
  if (summary.shippingSaved > 0.004) chips.push(t("saved_part_shipping", { amount: format(summary.shippingSaved) }));
  return (
    <div data-testid="you-save-box" className="relative mt-3 overflow-hidden rounded-[14px] bg-gradient-to-br from-[#ffcf4d] via-[#f9b317] to-[#e39f00] px-4 py-3.5 text-[#0b3146]">
      <style>{SWEEP_CSS}</style>
      <span aria-hidden="true" className="leap-sweep pointer-events-none absolute -top-[40%] h-[180%] w-[40%] rotate-[20deg] bg-gradient-to-r from-transparent via-white/75 to-transparent" />
      <div className="relative flex items-center justify-between gap-3 font-extrabold">
        <span className="text-[15px]">{t("you_save")}</span>
        <span className="text-[26px] leading-none"><Price usd={summary.saved} /></span>
      </div>
      {chips.length > 0 && (
        <div className="relative mt-2 flex flex-wrap gap-1.5">
          {chips.map((c) => <span key={c} className="rounded-full bg-[rgba(11,49,70,0.12)] px-2.5 py-0.5 text-[11.5px] font-extrabold">{c}</span>)}
        </div>
      )}
    </div>
  );
}

// the light sweep (left to right, right to left in Arabic); none when the buyer's device asks for reduced motion
const SWEEP_CSS = "@keyframes leapSweep{0%{inset-inline-start:-60%}60%,100%{inset-inline-start:130%}}.leap-sweep{inset-inline-start:-60%;animation:leapSweep 2.6s ease-in-out infinite}@media (prefers-reduced-motion: reduce){.leap-sweep{display:none}}";
