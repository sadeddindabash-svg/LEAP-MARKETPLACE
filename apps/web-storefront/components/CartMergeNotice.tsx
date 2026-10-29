"use client";

import { useCart } from "./CartProvider";
import { useT } from "./LangProvider";

/** After signing in, when this device's basket was combined with the account basket (one cart per account): what was combined, and which quantity was lowered for stock. Shown once, until dismissed. */
export default function CartMergeNotice() {
  const { mergeNotice, dismissMergeNotice } = useCart();
  const t = useT();
  if (!mergeNotice) return null;
  const added = mergeNotice.itemsAdded + mergeNotice.itemsCombined;
  return (
    <div role="status" data-testid="cart-merge-notice" className="mb-4 flex items-start gap-3 rounded-lg border border-[#b9d7ee] bg-[#eef6fd] px-4 py-3 text-sm leading-relaxed text-[#12405f]">
      <div className="min-w-0 flex-1">
        <p className="font-bold">{t("cart_merged_title")}</p>
        {added > 0 && <p>{added === 1 ? t("cart_merged_added_one") : t("cart_merged_added_many", { n: added })}</p>}
        {mergeNotice.reduced.map((r) => <p key={`r-${r.productId}`}>{t("cart_merged_reduced", { name: r.name, to: r.to })}</p>)}
        {mergeNotice.dropped.map((d) => <p key={`d-${d.productId}`}>{t("cart_merged_dropped", { name: d.name })}</p>)}
      </div>
      <button type="button" onClick={dismissMergeNotice} aria-label={t("cart_merged_dismiss")} className="grid size-8 flex-none place-items-center rounded-full font-bold hover:bg-[#dcecf8]">✕</button>
    </div>
  );
}
