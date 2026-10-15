import Image from "next/image";
import Link from "@/components/LocLink";
import { resolveImageUrl, type ProductSummary } from "@/lib/api";
import { t, type Lang } from "@/lib/i18n";

// One product on a list (home, search): photo, name, delivery estimate, stock and price. The whole card is one link to the part, so there is one clear place to click.
export default function ProductCard({ product: p, lang }: { product: ProductSummary; lang: Lang }) {
  const inStock = p.stockQuantity > 0;
  return (
    <li className="group flex flex-col overflow-hidden rounded-[14px] border border-line bg-white transition-colors hover:border-navy">
      <Link href={`/products/${p.id}`} className="flex flex-1 flex-col">
        <div className="relative flex h-44 items-center justify-center bg-[#e6edf2]">
          {p.images[0] ? (
            <Image src={resolveImageUrl(p.images[0])} alt={p.name} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" unoptimized />
          ) : (
            <svg aria-hidden="true" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#0b3146" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /><path d="M12 4v3M12 17v3M4 12h3M17 12h3" /></svg>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-4">
          <h3 className="line-clamp-2 text-base font-bold leading-snug">{p.name}</h3>
          {p.oemNumber && <p className="font-plate text-[13px] text-muted">{p.oemNumber}</p>}
          <p className="flex items-center gap-1.5 text-[13.5px] text-muted">
            <span className={inStock ? "font-semibold text-[#0f6b49]" : "font-semibold text-[#a12a21]"}>{t(lang, inStock ? "in_stock" : "out_of_stock")}</span>
            {p.estimatedDeliveryDays ? <span>· {t(lang, "delivery_in_days", { n: p.estimatedDeliveryDays })}</span> : null}
          </p>
          <p className="mt-auto pt-3 text-[22px] font-extrabold text-navy">${p.price.toFixed(2)} <small className="text-xs font-bold text-muted">USD</small></p>
        </div>
      </Link>
    </li>
  );
}
