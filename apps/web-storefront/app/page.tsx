import Image from "next/image";
import type { Metadata } from "next";
import Link from "@/components/LocLink";
import HeroPicker from "@/components/HeroPicker";
import { JsonLd } from "@/components/JsonLd";
import ProductCard from "@/components/ProductCard";
import { fetchCategories, fetchProducts, fetchVehicleBrands, resolveImageUrl } from "@/lib/api";
import { pickName, t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { alternatesFor, websiteJsonLd } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: alternatesFor(await getLang(), "/") };
}

const number = (n: number) => n.toLocaleString("en-US");      // Western digits in both languages, like the rest of the page

// The home page ("Navy Workshop"): find a part for your car, shop by section and by brand, and the newest parts. A Server Component: everything here is real data, in real
// HTML, in the page's language, which is the whole point of having this site next to the mobile app (a search engine reads it as it is).
export default async function HomePage() {
  const lang = await getLang();
  const [categories, products, brands] = await Promise.all([fetchCategories(), fetchProducts({ sort: "newest", lang }), fetchVehicleBrands()]);
  const newest = products.slice(0, 8);
  const stats: Array<[number, string]> = [[products.length, t(lang, "stat_parts")], [brands.length, t(lang, "stat_brands")], [categories.length, t(lang, "stat_sections")]];

  return (
    <div>
      <JsonLd data={websiteJsonLd()} />
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-4 pt-12 sm:px-8 lg:grid-cols-[1.1fr_1fr]" aria-labelledby="home-h1">
        <div>
          <h1 id="home-h1" className="text-[clamp(34px,4.6vw,56px)] font-bold leading-[1.08] tracking-tight text-navy">{t(lang, "hero_title")}</h1>
          <p className="mt-4 max-w-lg text-lg text-muted">{t(lang, "hero_lead")}</p>
        </div>
        <HeroPicker />
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-8" aria-label="Leap Auto Parts">
        <ul className="grid gap-4 sm:grid-cols-3">
          {stats.map(([n, label]) => (
            <li key={label} className="flex items-baseline gap-3 rounded-[14px] border border-line bg-white px-6 py-4">
              <b className="text-3xl font-extrabold leading-none text-navy">{number(n)}</b>
              <span className="text-[15px] text-muted">{label}</span>
            </li>
          ))}
        </ul>
      </section>

      {categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-8" aria-labelledby="home-sections">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="home-sections" className="text-3xl font-bold tracking-tight">{t(lang, "shop_by_section")}</h2>
            <Link href="/search" className="font-bold text-navy underline underline-offset-4">{t(lang, "see_all_sections")}</Link>
          </div>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/search?category=${encodeURIComponent(c.id)}`} className="flex h-full flex-col items-center gap-2.5 rounded-[14px] border border-line bg-white p-5 text-center transition-colors hover:border-navy">
                  <span className="relative grid size-16 place-items-center overflow-hidden rounded-xl bg-signal text-navy">
                    {c.photoUrl ? (
                      <Image src={resolveImageUrl(c.photoUrl)} alt="" fill sizes="64px" className="object-cover" unoptimized />
                    ) : (
                      <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 6a4 4 0 0 0 5 5l-8 8a2.5 2.5 0 0 1-4-4l8-8a4 4 0 0 0-1-1z" /></svg>
                    )}
                  </span>
                  <span className="text-base font-bold">{pickName(lang, c.nameEn, c.nameAr)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {brands.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-8" aria-labelledby="home-brands">
          <h2 id="home-brands" className="mb-6 text-3xl font-bold tracking-tight">{t(lang, "shop_by_brand")}</h2>
          <ul className="flex flex-wrap gap-3">
            {brands.slice(0, 24).map((b) => (
              <li key={b.id}>
                <Link href={`/search?q=${encodeURIComponent(b.name)}`} className="flex min-h-14 min-w-28 items-center justify-center rounded-[10px] border border-line bg-white px-5 text-[15px] font-extrabold uppercase tracking-wide hover:border-signal">
                  {pickName(lang, b.name, b.nameAr)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {newest.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-4 pt-16 sm:px-8" aria-labelledby="home-newest">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="home-newest" className="text-3xl font-bold tracking-tight">{t(lang, "newest_parts")}</h2>
            <Link href="/search" className="font-bold text-navy underline underline-offset-4">{t(lang, "see_all_parts")}</Link>
          </div>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {newest.map((p) => <ProductCard key={p.id} product={p} lang={lang} />)}
          </ul>
        </section>
      )}
    </div>
  );
}
