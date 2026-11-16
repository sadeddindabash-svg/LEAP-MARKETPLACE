import { t, type Lang } from "@/lib/i18n";
import { deliveryLine } from "@/lib/delivery";

/** From this many or fewer, the number left is shown ("Only 3 left"), as in the mobile app; above it just "In stock". */
export const LOW_STOCK = 5;

/** The box under the title: "In stock · Delivery: Oct. 29", "Only 3 left · Delivery: Oct. 29" (warm colour), or "Currently out of stock". */
export default function StockBanner({ stockQuantity, estimatedDeliveryDays, lang }: { stockQuantity: number; estimatedDeliveryDays: number | null | undefined; lang: Lang }) {
  const out = stockQuantity <= 0;
  const low = !out && stockQuantity <= LOW_STOCK;
  const delivery = deliveryLine(estimatedDeliveryDays, lang);
  const text = out ? t(lang, "stock_none_now") : [low ? t(lang, "only_n_left", { n: stockQuantity }) : t(lang, "in_stock"), delivery].filter(Boolean).join(" · ");
  // The colours of the product cards' stock boxes (green / red), with amber for "only a few left".
  const tone = out ? "bg-[#c62f26] text-white" : low ? "bg-[#fab219] text-navy" : "bg-[#0f6b49] text-white";
  return (
    <p data-stock={out ? "out" : low ? "low" : "in"} className={`mt-5 flex w-fit max-w-full items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-bold ${tone}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <circle cx="12" cy="12" r="10" />
        {out ? <path d="m15 9-6 6M9 9l6 6" /> : <path d="m8 12 3 3 5-6" />}
      </svg>
      <span>{text}</span>
    </p>
  );
}
