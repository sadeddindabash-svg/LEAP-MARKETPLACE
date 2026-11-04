import type { Metadata } from "next";
import SafeImage from "@/components/SafeImage";
import Link from "@/components/LocLink";
import { Price } from "@/components/Price";
import { fetchProductById, resolveImageUrl, type ProductDetail } from "@/lib/api";
import { pickName, t, type Lang } from "@/lib/i18n";
import { COMPARE_MAX_PHONE, parseIds } from "@/lib/compare";
import { getLang } from "@/lib/lang";
import { deliveryDateLabel } from "@/lib/delivery";

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), "compare_title") };
}

function rows(lang: Lang): Array<[string, (p: ProductDetail) => React.ReactNode]> {
  const dash = "—";
  return [
    [t(lang, "row_price"), (p) => <Price usd={p.price} className="text-lg font-extrabold text-navy" />],
    [t(lang, "row_rating"), (p) => (p.reviewCount > 0 && p.rating != null ? t(lang, "rating_value", { avg: p.rating.toFixed(1), n: p.reviewCount }) : t(lang, "no_reviews_short"))],
    [t(lang, "row_stock"), (p) => (p.stockQuantity > 0 ? t(lang, "stock_n", { n: p.stockQuantity }) : t(lang, "out_of_stock"))],
    [t(lang, "row_delivery"), (p) => deliveryDateLabel(p.estimatedDeliveryDays, lang) ?? dash],
    [t(lang, "oem_number"), (p) => (p.oemNumber ? <span className="font-plate">{p.oemNumber}</span> : dash)],
    [t(lang, "row_weight"), (p) => (p.weightKg != null ? `${p.weightKg.toFixed(1)} ${t(lang, "kg")}` : dash)],
    [t(lang, "row_verified"), (p) => (p.isVerifiedSeller ? t(lang, "yes") : dash)],
    [t(lang, "row_ships_from"), (p) => (p.shipsFromCountry ? pickName(lang, p.shipsFromCountry, p.shipsFromCountryAr) : dash)],
  ];
}

// Compare 2 to 4 parts side by side (the rows of the mobile app's compare screen). The parts are named in the address (?ids=...), so a comparison can be shared. It starts from
// the wishlist, like in the app.
export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const lang = await getLang();
  const { ids } = await searchParams;
  const found = (await Promise.all(parseIds(ids).map((id) => fetchProductById(id, lang)))).filter((p): p is ProductDetail => p !== null);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-navy">{t(lang, "compare_title")}</h1>
      {found.length < 2 ? (
        <p className="text-lg text-muted">{t(lang, "compare_need_two")} <Link href="/wishlist" className="font-bold text-navy underline underline-offset-4">{t(lang, "wishlist")}</Link></p>
      ) : (
        <>
        {found.length > COMPARE_MAX_PHONE && <p data-testid="compare-phone-note" className="mb-3 text-sm text-muted md:hidden">{t(lang, "compare_phone_note", { total: found.length })}</p>}
        <div className="overflow-x-auto rounded-[14px] border border-line bg-white">
          <table className="w-full table-fixed border-collapse text-start">
            <thead>
              <tr>
                <td className="w-28 bg-[#eef2f5] md:w-40" />
                {found.map((p, i) => (
                  <th key={p.id} scope="col" className={`border-s border-line p-3 text-center align-top md:p-4 ${i >= COMPARE_MAX_PHONE ? "max-md:hidden" : ""}`}>
                    <Link href={`/products/${p.id}`} className="block">
                      <span className="relative mx-auto mb-3 block aspect-square w-full max-w-36 overflow-hidden rounded-lg border border-line bg-white">
                        {p.images[0] && <SafeImage src={resolveImageUrl(p.images[0])} alt="" fill sizes="144px" className="object-contain p-1.5" unoptimized />}
                      </span>
                      <span className="line-clamp-2 text-sm font-bold leading-snug hover:underline">{p.name}</span>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows(lang).map(([label, cell]) => (
                <tr key={label} className="border-t border-line">
                  <th scope="row" className="bg-[#eef2f5] p-3 text-start text-[13px] font-bold uppercase tracking-wide text-[#33424d] md:p-4">{label}</th>
                  {found.map((p, i) => <td key={p.id} className={`border-s border-line p-3 text-[15px] md:p-4 ${i >= COMPARE_MAX_PHONE ? "max-md:hidden" : ""}`}>{cell(p)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
