import { Price } from "@/components/Price";
import { discountPercent } from "@/lib/discount";
import { cardDiscountTagClasses } from "@/lib/cardDiscount";
import { t, type Lang } from "@/lib/i18n";

/** The price, and when the server sends a higher original price: that price struck through and a "-N% off" tag. */
export default function PriceBlock({ price, originalPrice, lang }: { price: number; originalPrice?: number | null; lang: Lang }) {
  const percent = discountPercent(price, originalPrice);
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="font-display font-bold text-4xl"><Price usd={price} /></span>
      {percent !== null && originalPrice != null && (
        <>
          <del className="text-lg text-muted"><Price usd={originalPrice} /></del>
          <span className={`rounded-md px-2.5 py-0.5 text-sm font-bold ${cardDiscountTagClasses(percent)}`}>{t(lang, "percent_off", { n: percent })}</span>
        </>
      )}
    </div>
  );
}
