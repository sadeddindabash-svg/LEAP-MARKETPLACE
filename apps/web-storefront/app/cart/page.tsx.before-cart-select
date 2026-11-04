"use client";

import { useState } from "react";
import SafeImage from "@/components/SafeImage";
import FitCheck from "@/components/FitCheck";
import CartMergeNotice from "@/components/CartMergeNotice";
import Link from "@/components/LocLink";
import { useCart } from "@/components/CartProvider";
import { useT } from "@/components/LangProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { Price } from "@/components/Price";
import { ShippingRow, FreeShippingHint, FreeShippingBadge } from "@/components/FreeShipping";
import { resolveImageUrl, type CartItem } from "@/lib/api";
import { estimatedWeightKg, isOnSale, lineTotal, loyaltyBeatsPromo, stockHint, supplierLabel, atStockLimit } from "@/lib/cart";

const stepper = "grid size-11 place-items-center text-lg font-bold text-navy hover:bg-chalk disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent";

function Line({ item, onChange, onRemove, busy }: { item: CartItem; onChange: (q: number) => void; onRemove: () => void; busy: boolean }) {
  const t = useT();
  const hint = stockHint(item);
  return (
    <li className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 border-b border-line py-5 last:border-b-0 sm:grid-cols-[104px_minmax(0,1fr)_auto]">
      <Link href={`/products/${item.productId}`} className="relative block h-24 overflow-hidden rounded-xl bg-[#e6edf2]">
        {item.imageUrl && <SafeImage src={resolveImageUrl(item.imageUrl)} alt="" fill sizes="104px" className="object-cover" unoptimized />}
      </Link>
      <div className="min-w-0">
        <Link href={`/products/${item.productId}`} className="line-clamp-2 text-[17px] font-bold leading-snug hover:underline">{item.name}</Link>
        {item.supplierName && <p className="mt-0.5 text-sm text-muted">{supplierLabel(item.supplierName, t("supplier_word"))}</p>}
        <FitCheck productId={item.productId} />
        {item.priceChanged && <p role="status" className="mt-2 text-sm font-semibold text-[#7a4e00]">{t("price_updated_since_added")}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div role="group" aria-label={String(item.quantity)} className="inline-flex items-center rounded-[10px] border-[1.5px] border-[#c5d0d8] bg-white">
            <button type="button" className={stepper} disabled={busy || item.quantity <= 1} onClick={() => onChange(item.quantity - 1)} aria-label={t("decrease_quantity")}>−</button>
            <span className="min-w-9 text-center font-bold" aria-live="polite">{item.quantity}</span>
            <button type="button" className={stepper} disabled={busy || atStockLimit(item)} onClick={() => onChange(item.quantity + 1)} aria-label={t("increase_quantity")}>+</button>
          </div>
          <button type="button" onClick={onRemove} disabled={busy} className="min-h-11 text-sm font-bold text-navy underline underline-offset-4 disabled:opacity-50">{t("remove")}</button>
        </div>
        {hint && <p className="mt-2 text-sm font-semibold text-[#7a4e00]">{hint.kind === "limit" ? t("cart_at_stock_limit") : t("cart_only_left", { n: hint.left })}</p>}
      </div>
      <div className="col-span-2 text-end sm:col-span-1">
        <Price usd={lineTotal(item)} className="text-xl font-extrabold text-navy" />
        {isOnSale(item) && <p className="text-sm text-muted line-through"><Price usd={(item.originalPrice as number) * item.quantity} /></p>}
      </div>
    </li>
  );
}

// The cart, with what the mobile app's cart shows: each part with its photo, supplier, line total (and the struck-through price when it is on sale), a stock hint when 5 or
// fewer would remain, "Price updated" when it moved, removing with an Undo, the estimated weight, and the discount the server applied.
export default function CartPage() {
  const { cart, isLoading, error, itemCount, summary, updateQuantity, removeItem, addItem } = useCart();
  const t = useT();
  const { format } = useCurrency();
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState<{ item: CartItem } | null>(null);
  const weight = cart ? estimatedWeightKg(cart) : null;

  const guard = async (action: () => Promise<void>) => { setBusy(true); try { await action(); } finally { setBusy(false); } };

  if (isLoading) return <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8 text-muted" aria-busy="true">{t("search_loading")}</div>;
  if (error && !cart) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
        <p role="alert" className="text-lg font-semibold text-[#a12a21]">{t("cart_load_error")}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-4 inline-flex min-h-11 items-center rounded-[10px] border-[1.5px] border-navy px-5 font-bold text-navy">{t("retry")}</button>
      </div>
    );
  }
  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-navy">{t("cart_title")}</h1>
        <CartMergeNotice />
        <p className="mb-6 mt-3 text-lg text-muted">{t("cart_empty")}</p>
        {removed && (
          <p role="status" className="mb-5 text-sm font-semibold">
            {removed.item.name} {t("cart_removed_from_cart")}{" "}
            <button type="button" className="font-bold text-navy underline underline-offset-4" onClick={() => { const it = removed.item; setRemoved(null); guard(() => addItem(it.productId, it.quantity).catch(() => {})); }}>{t("undo")}</button>
          </p>
        )}
        <Link href="/search" className="inline-flex min-h-12 items-center rounded-[10px] bg-signal px-6 font-bold text-on-signal hover:bg-signal-dark">{t("browse_products")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-navy">{t("cart_title")} <span className="text-lg font-semibold text-muted">({t("cart_items", { n: itemCount })})</span></h1>
      {removed && (
        <p role="status" className="mb-4 rounded-lg bg-[#e3edf7] px-4 py-3 text-sm font-semibold text-navy">
          {removed.item.name} {t("cart_removed_from_cart")}{" "}
          <button type="button" className="font-bold underline underline-offset-4" onClick={() => { const it = removed.item; setRemoved(null); guard(() => addItem(it.productId, it.quantity).catch(() => {})); }}>{t("undo")}</button>
        </p>
      )}
      <CartMergeNotice />
      {error && <p role="alert" className="mb-4 text-sm font-semibold text-[#a12a21]">{error}</p>}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="rounded-[14px] border border-line bg-white px-5" aria-label={t("cart_title")}>
          <ul>
            {cart.items.map((item) => (
              <Line key={item.productId} item={item} busy={busy}
                onChange={(q) => guard(() => updateQuantity(item.productId, q))}
                onRemove={() => { setRemoved({ item }); guard(() => removeItem(item.productId)); }} />
            ))}
          </ul>
        </section>
        <aside className="rounded-[14px] border border-line bg-white p-6" aria-labelledby="cart-summary">
          <h2 id="cart-summary" className="mb-4 text-xl font-bold">{t("order_summary")}</h2>
          <div className="flex justify-between py-2"><span>{t("subtotal")}</span><Price usd={summary.subtotal} /></div>
          {summary.discount > 0 && (
            <div className="flex justify-between py-2 font-semibold text-[#0f6b49]">
              <span>{summary.source === "loyalty" ? t("loyalty_discount_line", { n: Math.round(summary.loyaltyPercent) }) : `${t("discount")}${summary.promoCode ? ` (${summary.promoCode})` : ""}`}</span>
              <span>−<Price usd={summary.discount} /></span>
            </div>
          )}
          {weight !== null && <div className="flex justify-between py-2 text-sm text-muted"><span>{t("estimated_weight")}</span><span>{weight.toFixed(1)} {t("kg")}</span></div>}
          <ShippingRow shipping={cart.shipping} />
          <FreeShippingHint shipping={cart.shipping} />
          <div className="mt-2 flex justify-between border-t-2 border-line pt-4 text-[22px] font-extrabold"><span>{t("total")}</span><Price usd={summary.total} /></div>
          {summary.saved > 0 && (
            <>
              <p data-testid="you-saved" className="mt-1 text-sm font-semibold text-[#0f6b49]">{t("you_saved")} <Price usd={summary.saved} /></p>
              {summary.shippingSaved > 0 && <p data-testid="you-saved-detail" className="text-[12.5px] text-muted">{summary.discount > 0 ? t("saved_breakdown", { discount: format(summary.discount), shipping: format(summary.shippingSaved) }) : t("saved_free_shipping")}</p>}
            </>
          )}
          {loyaltyBeatsPromo(cart) && <p className="mt-3 text-sm text-muted">{t("loyalty_beats_promo", { amount: format(summary.discount) })}</p>}
          <Link href="/checkout" className="relative mt-5 flex min-h-13 w-full items-center justify-center rounded-[10px] bg-signal text-base font-bold text-on-signal hover:bg-signal-dark">{t("checkout")}<FreeShippingBadge shipping={cart.shipping} /></Link>
          <Link href="/search" className="mt-3 block text-center text-sm font-semibold text-navy underline underline-offset-4">{t("continue_shopping")}</Link>
        </aside>
      </div>
    </div>
  );
}
