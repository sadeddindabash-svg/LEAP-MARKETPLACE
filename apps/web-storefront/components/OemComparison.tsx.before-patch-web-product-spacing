import Link from "@/components/LocLink";
import { Price } from "@/components/Price";
import type { ProductSummary } from "@/lib/api";
import { t, type Lang } from "@/lib/i18n";
import { deliveryLine } from "@/lib/delivery";

/** "Same part, other listings": the same OEM part number sold by other suppliers, so the buyer can compare price and delivery. Nothing is drawn when there are none. */
export default function OemComparison({ products, lang }: { products: ProductSummary[]; lang: Lang }) {
  if (products.length === 0) return null;
  return (
    <section className="mt-14" aria-labelledby="oem-h">
      <h2 id="oem-h" className="text-2xl font-bold tracking-tight">{t(lang, "oem_title")}</h2>
      <p className="mb-5 mt-1 text-muted">{t(lang, "oem_subtitle")}</p>
      <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-white">
        {products.map((p) => (
          <li key={p.id}>
            <Link href={`/products/${p.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4 hover:bg-chalk">
              <Price usd={p.price} className="text-xl font-extrabold text-navy" />
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                <span className={p.stockQuantity > 0 ? "font-semibold text-[#0f6b49]" : "font-semibold text-[#a12a21]"}>{t(lang, p.stockQuantity > 0 ? "in_stock" : "out_of_stock")}</span>
                {deliveryLine(p.estimatedDeliveryDays, lang) ? <span>{deliveryLine(p.estimatedDeliveryDays, lang)}</span> : null}
                {p.isVerifiedSeller ? <span className="font-semibold text-navy">{t(lang, "row_verified")}</span> : null}
              </span>
              <span className="ms-auto line-clamp-1 text-sm font-semibold">{p.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
