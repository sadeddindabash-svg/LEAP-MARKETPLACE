import type { ReactNode } from "react";
import type { ProductDetail } from "@/lib/api";
import { t, type Lang } from "@/lib/i18n";

// "Technical Specifications" under the photos of a product page, as in the mobile app: brand, model, year, part number, the part's own attributes, dimensions, weight and the description. EVERY row is shown; one the part does not
// have says "Not specified". A part that fits several cars shows the first "+N more cars". A size that comes from the part (not entered by the supplier for this product) is marked "approx.".
const clean = (n: number) => String(Number(n.toFixed(2)));        // 1.40 -> "1.4", 30 -> "30"

export default function ProductDetails({ product, lang }: { product: ProductDetail; lang: Lang }) {
  const approx = product.sizeApprox ? ` (${t(lang, "detail_approx")})` : "";
  const moreCars = Math.max((product.fitCarCount ?? 0) - 1, 0);
  // One more car, a few more, many more: English and Arabic each need their own wording for these.
  const moreText = moreCars === 1 ? t(lang, "detail_more_car_one") : moreCars > 10 ? t(lang, "detail_more_cars_many", { n: moreCars }) : t(lang, "detail_more_cars", { n: moreCars });
  const none = <span className="font-normal text-muted">{t(lang, "detail_not_specified")}</span>;
  const rows: Array<[string, ReactNode]> = [];
  rows.push([t(lang, "detail_brand"), product.brand || none]);
  rows.push([t(lang, "detail_model"), product.model || none]);
  rows.push([t(lang, "detail_year"), product.year ? <>{product.year}{moreCars > 0 && <span className="font-normal text-muted"> · {moreText}</span>}</> : none]);
  rows.push([t(lang, "part_number"), product.oemNumber ? <span className="font-plate font-semibold">{product.oemNumber}</span> : none]);
  for (const a of product.attributes ?? []) rows.push([a.name, a.value]);
  const { lengthCm, widthCm, heightCm, weightKg } = product;
  rows.push([t(lang, "detail_dimensions"), lengthCm != null && widthCm != null && heightCm != null ? `${clean(lengthCm)} × ${clean(widthCm)} × ${clean(heightCm)} cm${approx}` : none]);
  rows.push([t(lang, "detail_weight"), weightKg != null ? `${clean(weightKg)} kg${approx}` : none]);
  return (
    <section aria-labelledby="product-details-h" className="mt-6 rounded-xl border border-line bg-white p-5">
      <h2 id="product-details-h" className="mb-3 text-lg font-bold">{t(lang, "product_details_title")}</h2>
      <dl className="divide-y divide-line text-sm">
        {rows.map(([label, value], i) => (
          <div key={`${i}-${label}`} className="flex justify-between gap-4 py-2.5"><dt className="text-muted">{label}</dt><dd className="min-w-0 text-end font-semibold text-ink [overflow-wrap:anywhere]">{value}</dd></div>
        ))}
        <div className="py-2.5"><dt className="text-muted">{t(lang, "detail_description")}</dt><dd className="mt-1 whitespace-pre-line font-normal leading-relaxed text-ink [overflow-wrap:anywhere]">{product.description?.trim() ? product.description : none}</dd></div>
      </dl>
    </section>
  );
}
