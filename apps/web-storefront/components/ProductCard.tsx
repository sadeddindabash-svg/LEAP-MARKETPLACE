import Link from "@/components/LocLink";
import SafeImage from "@/components/SafeImage";
import { resolveImageUrl, type ProductSummary } from "@/lib/api";
import { t, type Lang } from "@/lib/i18n";
import { Price } from "./Price";
import { deliveryLine } from "@/lib/delivery";

// One product on a list (home, search): photo, name, delivery estimate, stock and price. The whole card is one link to the part, so there is one clear place to click.
export default function ProductCard({ product: p, lang }: { product: ProductSummary; lang: Lang }) {
  const inStock = p.stockQuantity > 0;
  return (
    <li className="group flex flex-col overflow-hidden rounded-[14px] border border-line bg-white transition-colors [contain-intrinsic-size:auto_440px] [content-visibility:auto] hover:border-navy">          {/* a long list: the browser skips drawing cards far off screen (lighter on a phone) */}
      <Link href={`/products/${p.id}`} className="flex flex-1 flex-col">
        {/* A true SQUARE. A real photo is drawn WHOLE (object-contain) inside a small margin, so a long part (a wiper blade) is never cut off; no photo shows the icon on grey. */}
        <div className={`relative aspect-square ${p.images[0] ? "border-b border-line bg-white" : "bg-[#e6edf2]"}`}>
          {p.images[0] ? (
            <div className="absolute inset-2">
              <SafeImage src={resolveImageUrl(p.images[0])} alt={p.name} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-contain" unoptimized />
            </div>
          ) : (
            <div className="absolute inset-0 grid place-items-center">
              <svg aria-hidden="true" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#0b3146" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /><path d="M12 4v3M12 17v3M4 12h3M17 12h3" /></svg>
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-4">
          <h3 className="line-clamp-2 text-base font-bold leading-snug">{p.name}</h3>
          {p.oemNumber && <p className="font-plate text-[13px] text-muted">{p.oemNumber}</p>}
          <p className="flex items-center gap-1.5 text-[13.5px] text-muted">
            <span className={inStock ? "font-semibold text-[#0f6b49]" : "font-semibold text-[#a12a21]"}>{t(lang, inStock ? "in_stock" : "out_of_stock")}</span>
            {deliveryLine(p.estimatedDeliveryDays, lang) ? <span>· {deliveryLine(p.estimatedDeliveryDays, lang)}</span> : null}
          </p>
          <p className="mt-auto pt-3 text-[22px] font-extrabold text-navy"><Price usd={p.price} /></p>
        </div>
      </Link>
    </li>
  );
}
