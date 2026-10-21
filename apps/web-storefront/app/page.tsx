import type { Metadata } from "next";
import PhotoBox from "@/components/PhotoBox";
import TileRow from "@/components/TileRow";
import Link from "@/components/LocLink";
import HeroPicker from "@/components/HeroPicker";
import { JsonLd } from "@/components/JsonLd";
import InfiniteProductGrid from "@/components/InfiniteProductGrid";
import AnnouncementBar from "@/components/AnnouncementBar";
import { fetchAnnouncements, fetchCategories, fetchProducts, fetchSiteStats, fetchVehicleBrands } from "@/lib/api";
import { pickName, t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { alternatesFor, websiteJsonLd } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: alternatesFor(await getLang(), "/") };
}

const number = (n: number) => n.toLocaleString("en-US");      // Western digits in both languages, like the rest of the page
const NEWEST_PAGE_SIZE = 8;
// The picture tile of each total: a plain placeholder until a real photo is chosen for it.
const STAT_ICONS: Record<string, string[]> = {
  parts: ["M21 8 12 3 3 8v8l9 5 9-5V8Z", "m3 8 9 5 9-5M12 13v8"],
  brands: ["M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z", "m9 12 2 2 4-4"],
  models: ["M5 16v-5l2-5h10l2 5v5M3 16h18M7 16v2M17 16v2", "M7.5 12.5h.01M16.5 12.5h.01"],
  countries: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", "M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"],
};
const tileClass = "flex h-full flex-col items-center gap-2.5 rounded-[14px] border border-line bg-white p-5 text-center transition-colors hover:border-signal";

// The home page ("Navy Workshop"): find a part for your car, the real totals, shop by section and by brand (one row each, "More" opens the rest), and the newest parts, which load as you scroll. A Server Component: everything here is real data, in real
// HTML, in the page's language, which is the whole point of having this site next to the mobile app (a search engine reads it as it is).
export default async function HomePage() {
  const lang = await getLang();
  const [categories, products, brands, announcements, totals] = await Promise.all([fetchCategories(), fetchProducts({ sort: "newest", lang }), fetchVehicleBrands(), fetchAnnouncements(), fetchSiteStats()]);
  const newest = products.slice(0, NEWEST_PAGE_SIZE);
  // The four real totals counted by the server (not the length of a list that was fetched). If the server cannot give them, the row is left out rather than showing numbers that are not true.
  const stats = totals ? [
    { icon: "parts", n: totals.parts, label: t(lang, "home_stat_parts") }, { icon: "brands", n: totals.brands, label: t(lang, "home_stat_brands") },
    { icon: "models", n: totals.models, label: t(lang, "home_stat_models") }, { icon: "countries", n: totals.countries, label: t(lang, "home_stat_countries") },
  ] : [];

  return (
    <div>
      {/* The announcement line belongs to the HOME page only: it is no longer in the header, so no other page has it. */}
      <AnnouncementBar announcements={announcements} />
      <JsonLd data={websiteJsonLd()} />
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-4 pt-12 sm:px-8 lg:grid-cols-[1.1fr_1fr]" aria-labelledby="home-h1">
        <div>
          <h1 id="home-h1" className="text-[clamp(34px,4.6vw,56px)] font-bold leading-[1.08] tracking-tight text-navy">{t(lang, "hero_title")}</h1>
          <p className="mt-4 max-w-lg text-lg text-muted">{t(lang, "hero_lead")}</p>
        </div>
        <HeroPicker />
      </section>

      {stats.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-8" aria-label="Leap Auto Parts">
          <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((s) => (
              <li key={s.icon} className="flex items-center gap-4 rounded-[14px] border border-line bg-white px-5 py-4">
                <span className="grid size-14 flex-none place-items-center rounded-xl bg-[#e6edf2] text-[#8696a2]">
                  <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{STAT_ICONS[s.icon].map((d) => <path key={d} d={d} />)}</svg>
                </span>
                <span className="min-w-0"><b className="block text-3xl font-extrabold leading-none text-navy">{number(s.n)}</b><span className="mt-1 block text-[15px] text-muted">{s.label}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-8" aria-labelledby="home-sections">
          <h2 id="home-sections" className="mb-6 text-3xl font-bold tracking-tight">{t(lang, "shop_by_section")}</h2>
          <TileRow gridClassName="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6" moreLabel={t(lang, "more_sections")} fewerLabel={t(lang, "show_fewer")}>
            {categories.map((c) => (
              <Link key={c.id} href={`/search?category=${encodeURIComponent(c.id)}`} className={tileClass}>
                <PhotoBox src={c.photoUrl} className="size-16" sizes="64px" />
                <span className="line-clamp-2 w-full min-w-0 text-base font-bold [overflow-wrap:anywhere]">{pickName(lang, c.nameEn, c.nameAr)}</span>
              </Link>
            ))}
          </TileRow>
        </section>
      )}
      {brands.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-8" aria-labelledby="home-brands">
          <h2 id="home-brands" className="mb-6 text-3xl font-bold tracking-tight">{t(lang, "shop_by_brand")}</h2>
          <TileRow gridClassName="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6" moreLabel={t(lang, "more_brands")} fewerLabel={t(lang, "show_fewer")}>
            {brands.map((b) => (
              <Link key={b.id} href={`/search?q=${encodeURIComponent(b.name)}`} className={tileClass}>
                <PhotoBox src={b.photoUrl} className="size-16" sizes="64px" />
                <span className="line-clamp-2 w-full min-w-0 text-base font-bold [overflow-wrap:anywhere]">{pickName(lang, b.name, b.nameAr)}</span>
              </Link>
            ))}
          </TileRow>
        </section>
      )}

      {newest.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-4 pt-16 sm:px-8" aria-labelledby="home-newest">
          <h2 id="home-newest" className="mb-6 text-3xl font-bold tracking-tight">{t(lang, "newest_parts")}</h2>
          {/* The first parts are drawn here, on the server (in the page's HTML); the rest load by themselves as the buyer scrolls, eight at a time, until every part has been shown. */}
          <InfiniteProductGrid id="home-newest-grid" source={{ kind: "newest" }} initial={newest} total={null} pageSize={NEWEST_PAGE_SIZE} gridClassName="grid grid-cols-2 gap-5 lg:grid-cols-4" />
        </section>
      )}
    </div>
  );
}
