import type { Metadata } from "next";
import Image from "next/image";
import Link from "@/components/LocLink";
import { Price } from "@/components/Price";
import { fetchProductById, resolveImageUrl, type ProductDetail } from "@/lib/api";
import { pickName, t, type Lang } from "@/lib/i18n";
import { parseIds } from "@/lib/compare";
import { getLang } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), "compare_title") };
}

function rows(lang: Lang): Array<[string, (p: ProductDetail) => React.ReactNode]> {
  const dash = "—";
  return [
    [t(lang, "row_price"), (p) => <Price usd={p.price} className="text-lg font-extrabold text-navy" />],
    [t(lang, "row_rating"), (p) => (p.reviewCount > 0 && p.rating != null ? t(lang, "rating_value", { avg: p.rating.toFixed(1), n: p.reviewCount }) : t(lang, "no_reviews_short"))],
    [t(lang, "row_stock"), (p) => (p.stockQuantity > 0 ? t(lang, "stock_n", { n: p.stockQuantity }) : t(lang, "out_of_stock"))],
    [t(lang, "row_delivery"), (p) => (p.estimatedDeliveryDays ? t(lang, "delivery_in_days", { n: p.estimatedDeliveryDays }) : dash)],
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
        <div className="overflow-x-auto rounded-[14px] border border-line bg-white">
          <table className="w-full min-w-[640px] border-collapse text-start">
            <thead>
              <tr>
                <td className="w-40 bg-[#eef2f5]" />
                {found.map((p) => (
                  <th key={p.id} scope="col" className="min-w-44 border-s border-line p-4 text-start align-top">
                    <Link href={`/products/${p.id}`} className="block">
                      <span className="relative mb-3 block h-28 overflow-hidden rounded-lg bg-[#e6edf2]">
                        {p.images[0] && <Image src={resolveImageUrl(p.images[0])} alt="" fill sizes="176px" className="object-cover" unoptimized />}
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
                  <th scope="row" className="bg-[#eef2f5] p-4 text-start text-[13px] font-bold uppercase tracking-wide text-[#33424d]">{label}</th>
                  {found.map((p) => <td key={p.id} className="border-s border-line p-4 text-[15px]">{cell(p)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
