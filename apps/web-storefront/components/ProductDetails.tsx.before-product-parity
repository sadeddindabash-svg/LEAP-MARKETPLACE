import type { ReactNode } from "react";
import type { ProductDetail } from "@/lib/api";
import { t, type Lang } from "@/lib/i18n";

// "Product details" under the photos of a product page: brand, model, year, part number, dimensions and weight, each only when the part has it. A part that fits several cars shows the first one with
// "+N more cars". A size that comes from the part (not entered by the supplier for this product) is marked "approx.".
const clean = (n: number) => String(Number(n.toFixed(2)));        // 1.40 -> "1.4", 30 -> "30"

export default function ProductDetails({ product, lang }: { product: ProductDetail; lang: Lang }) {
  const approx = product.sizeApprox ? ` (${t(lang, "detail_approx")})` : "";
  const moreCars = Math.max((product.fitCarCount ?? 0) - 1, 0);
  // One more car, a few more, many more: English and Arabic each need their own wording for these.
  const moreText = moreCars === 1 ? t(lang, "detail_more_car_one") : moreCars > 10 ? t(lang, "detail_more_cars_many", { n: moreCars }) : t(lang, "detail_more_cars", { n: moreCars });
  const rows: Array<[string, ReactNode]> = [];
  if (product.brand) rows.push([t(lang, "detail_brand"), product.brand]);
  if (product.model) rows.push([t(lang, "detail_model"), product.model]);
  if (product.year) rows.push([t(lang, "detail_year"), <>{product.year}{moreCars > 0 && <span className="text-muted"> · {moreText}</span>}</>]);
  if (product.oemNumber) rows.push([t(lang, "part_number"), <span key="pn" className="font-plate font-semibold">{product.oemNumber}</span>]);
  const { lengthCm, widthCm, heightCm, weightKg } = product;
  if (lengthCm != null && widthCm != null && heightCm != null) rows.push([t(lang, "detail_dimensions"), `${clean(lengthCm)} × ${clean(widthCm)} × ${clean(heightCm)} cm${approx}`]);
  if (weightKg != null) rows.push([t(lang, "detail_weight"), `${clean(weightKg)} kg${approx}`]);
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="product-details-h" className="mt-6 rounded-xl border border-line bg-white p-5">
      <h2 id="product-details-h" className="mb-3 text-lg font-bold">{t(lang, "product_details_title")}</h2>
      <dl className="divide-y divide-line text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-2.5"><dt className="text-muted">{label}</dt><dd className="min-w-0 text-end font-semibold text-ink [overflow-wrap:anywhere]">{value}</dd></div>
        ))}
      </dl>
    </section>
  );
}
