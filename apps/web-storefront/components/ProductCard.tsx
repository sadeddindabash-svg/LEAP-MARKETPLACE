import Link from "@/components/LocLink";
import CardPhotos from "@/components/CardPhotos";
import SafeImage from "@/components/SafeImage";
import BrandBadge from "@/components/BrandBadge";
import CardAddToCart from "@/components/CardAddToCart";
import WishlistHeart from "@/components/WishlistHeart";
import { resolveImageUrl, type ProductSummary } from "@/lib/api";
import { cardDiscount, cardDiscountTagClasses } from "@/lib/cardDiscount";
import { deliveryLine } from "@/lib/delivery";
import { cardReviews } from "@/lib/review";
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
            <CardPhotos images={p.images.map(resolveImageUrl)} alt={p.name} />
          ) : (
            <div className="absolute inset-0 grid place-items-center">
              <svg aria-hidden="true" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#0b3146" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 4v2M12 18v2M4 12h2M18 12h2" /></svg>
            </div>
          )}
          {p.brandLogoUrl && <BrandBadge src={resolveImageUrl(p.brandLogoUrl)} name={p.brand ?? ""} />}
          {percent !== null && <span data-testid="discount-tag" aria-label={t(lang, "percent_off", { n: percent })} className={`absolute end-2.5 top-2.5 rounded-lg px-2.5 py-1 text-sm font-extrabold shadow-sm ${cardDiscountTagClasses(percent)}`}><bdi dir="ltr">-{percent}%</bdi></span>}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="line-clamp-2 text-base font-bold leading-snug">{p.name}</h3>
          {p.oemNumber && <p className="font-plate text-[13px] text-muted">{p.oemNumber}</p>}
          <CardReviews rating={p.rating} count={p.reviewCount} lang={lang} />
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
      <WishlistHeart productId={p.id} name={p.name} variant="card" />
    </li>
  );
}

/** The part's stars, average and number of reviews (approved reviews only, counted by the server), or "No reviews yet". */
function CardReviews({ rating, count, lang }: { rating: number | null; count: number; lang: Lang }) {
  const r = cardReviews(rating, count);
  if (!r) {
    return (
      <p data-testid="card-reviews" className="flex items-center gap-1.5 text-[13px] text-muted">
        <CardStar filled={false} />
        <span>{t(lang, "card_no_reviews")}</span>
      </p>
    );
  }
  return (
    <p data-testid="card-reviews" className="flex items-center gap-1.5 text-[13px] text-muted">
      <span className="flex" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <CardStar key={i} filled={i < r.fullStars} />)}</span>
      <bdi dir="ltr" className="font-bold text-navy">{r.average}</bdi>
      <span>({r.count === 1 ? t(lang, "card_review_one") : t(lang, "reviews_count", { n: r.count })})</span>
    </p>
  );
}

function CardStar({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" fill={filled ? "#F5A623" : "none"} stroke="#F5A623" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
