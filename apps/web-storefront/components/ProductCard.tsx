import Link from "@/components/LocLink";
import SafeImage from "@/components/SafeImage";
import BrandBadge from "@/components/BrandBadge";
import CardAddToCart from "@/components/CardAddToCart";
import { resolveImageUrl, type ProductSummary } from "@/lib/api";
import { cardDiscount, cardDiscountTagClasses } from "@/lib/cardDiscount";
import { deliveryLine } from "@/lib/delivery";
import { t, type Lang } from "@/lib/i18n";
import { Price } from "./Price";

/**
 * One product on a list (home, search, the rows of a product page): the photo with the brand's logo in one corner and the discount tag in the other, the name, a green "In stock" or red "Out of stock" box (with the delivery date),
 * and the price (with the old price struck through when there is a discount) beside the add-to-cart icon. The photo, name and price are ONE link to the part; the add-to-cart icon is a button of its own beside it (a button cannot sit
 * inside a link).
 */
export default function ProductCard({ product: p, lang }: { product: ProductSummary; lang: Lang }) {
  const inStock = p.stockQuantity > 0;
  const percent = cardDiscount(p.price, p.originalPrice);
  const delivery = inStock ? deliveryLine(p.estimatedDeliveryDays, lang) : null;
  return (
    <li className="group relative flex flex-col overflow-hidden rounded-[14px] border border-line bg-white transition-colors [contain-intrinsic-size:auto_440px] [content-visibility:auto] hover:border-navy">          {/* a long list: the browser draws a card only when it is near the screen */}
      <Link href={`/products/${p.id}`} className="flex flex-1 flex-col">
        {/* A true SQUARE. A real photo is drawn WHOLE (object-contain) inside a small margin, so a long part (a wiper blade) is never cut off; no photo shows the icon on grey. */}
        <div className={`relative aspect-square ${p.images[0] ? "border-b border-line bg-white" : "bg-[#e6edf2]"}`}>
          {p.images[0] ? (
            <div className="absolute inset-2">
              <SafeImage src={resolveImageUrl(p.images[0])} alt={p.name} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-contain" unoptimized />
            </div>
          ) : (
            <div className="absolute inset-0 grid place-items-center">
              <svg aria-hidden="true" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#0b3146" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 4v2M12 18v2M4 12h2M18 12h2" /></svg>
            </div>
          )}
          {p.brandLogoUrl && <BrandBadge src={resolveImageUrl(p.brandLogoUrl)} name={p.brand ?? ""} />}
          {percent !== null && <span data-testid="discount-tag" dir="ltr" aria-label={t(lang, "percent_off", { n: percent })} className={`absolute end-2.5 top-2.5 rounded-lg px-2.5 py-1 text-sm font-extrabold shadow-sm ${cardDiscountTagClasses(percent)}`}>-{percent}%</span>}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="line-clamp-2 text-base font-bold leading-snug">{p.name}</h3>
          {p.oemNumber && <p className="font-plate text-[13px] text-muted">{p.oemNumber}</p>}
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-muted">
            <span data-testid="stock-box" data-stock={inStock ? "in" : "out"} className={`rounded-md px-2.5 py-0.5 text-[12.5px] font-bold text-white ${inStock ? "bg-[#0f6b49]" : "bg-[#c62f26]"}`}>{t(lang, inStock ? "in_stock" : "out_of_stock")}</span>
            {delivery ? <span>{delivery}</span> : null}
          </p>
          <p className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-3 pe-14">
            <span className="text-[22px] font-extrabold text-navy"><Price usd={p.price} /></span>
            {percent !== null && p.originalPrice != null && <del className="text-sm text-muted"><Price usd={p.originalPrice} /></del>}
          </p>
        </div>
      </Link>
      <div className="absolute bottom-4 end-4"><CardAddToCart productId={p.id} name={p.name} inStock={inStock} /></div>
    </li>
  );
}
