import type { Metadata } from "next";
import TileRow from "@/components/TileRow";
import StatTile from "@/components/StatTile";
import SectionTile from "@/components/SectionTile";
import BrandTile from "@/components/BrandTile";
import HeroPicker from "@/components/HeroPicker";
import { JsonLd } from "@/components/JsonLd";
import InfiniteProductGrid from "@/components/InfiniteProductGrid";
import AnnouncementBar from "@/components/AnnouncementBar";
import { fetchAnnouncements, fetchCategories, fetchHomeBanner, fetchHomePictures, fetchHomeText, fetchProducts, fetchSiteStats, fetchVehicleBrands, resolveImageUrl } from "@/lib/api";
import { homeFontStyle } from "@/lib/homeFonts";
import HomeFontLink from "@/components/HomeFontLink";
import { HEADLINE_SIZE_CLASS, SUBHEADLINE_SIZE_CLASS, pickHomeText } from "@/lib/homeText";
import { pickName, t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { alternatesFor, websiteJsonLd } from "@/lib/seo";
import HomeBanner from "@/components/HomeBanner";
import { viewSlides } from "@/lib/homeBanner";

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

// The home page ("Navy Workshop"): find a part for your car, the real totals, shop by section and by brand (one row each, "More" opens the rest), and the newest parts, which load as you scroll. A Server Component: everything here is real data, in real
// HTML, in the page's language, which is the whole point of having this site next to the mobile app (a search engine reads it as it is).
export default async function HomePage() {
  const lang = await getLang();
  // The banner is optional: if it cannot be read (or is not set up) the home page simply shows the headline, as it always did.
  const bannerPromise = (async () => { try { return await fetchHomeBanner(); } catch { return null; } })();
  const [categories, products, brands, announcements, totals, pictures, homeText] = await Promise.all([fetchCategories(), fetchProducts({ sort: "newest", lang }), fetchVehicleBrands(), fetchAnnouncements(), fetchSiteStats(), fetchHomePictures(), fetchHomeText()]);
  const newest = products.slice(0, NEWEST_PAGE_SIZE);
  const banner = await bannerPromise;
  const bannerSlides = banner?.mode === "banner" ? viewSlides(banner, lang, resolveImageUrl) : [];
  const showBanner = bannerSlides.length > 0;
  // The four real totals counted by the server (not the length of a list that was fetched). If the server cannot give them, the row is left out rather than showing numbers that are not true.
  const stats = totals ? [
    { icon: "parts", n: totals.parts, picture: pictures?.parts ?? null, label: t(lang, "home_stat_parts") }, { icon: "brands", n: totals.brands, picture: pictures?.brands ?? null, label: t(lang, "home_stat_brands") },
    { icon: "models", n: totals.models, picture: pictures?.models ?? null, label: t(lang, "home_stat_models") }, { icon: "countries", n: totals.countries, picture: pictures?.countries ?? null, label: t(lang, "home_stat_countries") },
  ] : [];

  return (
    <div>
      {/* The announcement line belongs to the HOME page only: it is no longer in the header, so no other page has it. */}
      <AnnouncementBar announcements={announcements} />
      <JsonLd data={websiteJsonLd()} />
      {/* The left side of the hero is EITHER the headline and sub-headline OR the banner (one switch in the admin portal), never both. The banner is as big as the finder box beside it. The page keeps its h1 for search engines either way. */}
      <section className={`mx-auto grid max-w-7xl px-4 pb-4 pt-12 sm:px-8 ${showBanner ? "gap-6 lg:grid-cols-2 lg:items-stretch" : "items-center gap-12 lg:grid-cols-[1.1fr_1fr]"}`} aria-labelledby="home-h1">
        {showBanner ? (
          <>
            <h1 id="home-h1" className="sr-only">{pickHomeText(homeText?.headline, lang, t(lang, "hero_title"))}</h1>
            <HomeBanner slides={bannerSlides} rtl={lang === "ar"} />
          </>
        ) : (
          <div>
            <HomeFontLink fonts={[homeText?.headline.font, homeText?.subheadline.font]} />
            <h1 id="home-h1" style={homeFontStyle(homeText?.headline.font)} className={`${HEADLINE_SIZE_CLASS[homeText?.headline.size ?? "large"]} font-bold leading-[1.08] tracking-tight text-navy`}>{pickHomeText(homeText?.headline, lang, t(lang, "hero_title"))}</h1>
            <p style={homeFontStyle(homeText?.subheadline.font)} className={`mt-4 max-w-lg ${SUBHEADLINE_SIZE_CLASS[homeText?.subheadline.size ?? "medium"]} text-muted`}>{pickHomeText(homeText?.subheadline, lang, t(lang, "hero_lead"))}</p>
          </div>
        )}
        <HeroPicker />
      </section>

      {stats.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-8" aria-label="Leap Auto Parts">
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {stats.map((s) => <StatTile key={s.icon} n={number(s.n)} label={s.label} paths={STAT_ICONS[s.icon]} picture={s.picture} />)}
          </ul>
        </section>
      )}
      {categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-8" aria-labelledby="home-sections">
          <h2 id="home-sections" className="mb-6 text-3xl font-bold tracking-tight">{t(lang, "shop_by_section")}</h2>
          <TileRow variant="wide" defaultColumns={4} gridClassName="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4" moreLabel={t(lang, "more_sections")} fewerLabel={t(lang, "show_fewer")}>
            {categories.map((c) => <SectionTile key={c.id} href={`/search?category=${encodeURIComponent(c.id)}`} name={pickName(lang, c.nameEn, c.nameAr)} photo={c.photoUrl} />)}
          </TileRow>
        </section>
      )}
      {brands.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-8" aria-labelledby="home-brands">
          <h2 id="home-brands" className="mb-6 text-3xl font-bold tracking-tight">{t(lang, "shop_by_brand")}</h2>
          <TileRow variant="round" defaultColumns={6} maxCollapsed={9} gridClassName="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-5 sm:gap-x-4 xl:grid-cols-10" moreLabel={t(lang, "more_brands")} fewerLabel={t(lang, "show_fewer")}>
            {brands.map((b) => <BrandTile key={b.id} href={`/search?q=${encodeURIComponent(b.name)}`} name={pickName(lang, b.name, b.nameAr)} photo={b.photoUrl} />)}
          </TileRow>
        </section>
      )}

      {newest.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-4 pt-8 sm:px-8" aria-labelledby="home-newest">
          <h2 id="home-newest" className="mb-6 text-3xl font-bold tracking-tight">{t(lang, "newest_parts")}</h2>
          {/* The first parts are drawn here, on the server (in the page's HTML); the rest load by themselves as the buyer scrolls, eight at a time, until every part has been shown. */}
          <InfiniteProductGrid id="home-newest-grid" source={{ kind: "newest" }} initial={newest} total={null} pageSize={NEWEST_PAGE_SIZE} gridClassName="grid grid-cols-2 gap-5 lg:grid-cols-4" />
        </section>
      )}
    </div>
  );
}
