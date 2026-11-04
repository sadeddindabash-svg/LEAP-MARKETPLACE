import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "@/components/LocLink";
import { fetchCategories, fetchPartsForCategory, fetchProductsPaginated, type CategoryPart } from "@/lib/api";
import InfiniteProductGrid from "@/components/InfiniteProductGrid";
import { localizePath, pickName, t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { SearchFilters } from "@/components/SearchFilters";
import { filterHref, readExtraFilters } from "@/lib/searchFilters";
import { alternatesFor, categoryPageDescription, categoryPageTitle, searchIndexing } from "@/lib/seo";

const PAGE_SIZE = 24;

interface PageProps {
  searchParams: Promise<{ q?: string; category?: string; part?: string; generationId?: string; year?: string; versionId?: string; brandId?: string; modelId?: string; page?: string; sort?: string; minPrice?: string; maxPrice?: string; maxDeliveryDays?: string }>;
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const { q, category, part } = params;
  // A category page is a real landing page: indexed, with its own title. Every other combination (a typed query, a vehicle filter, page 2...) is a variation of
  // it: followed, but kept out of the index and pointing at the category page as the one real version (see searchIndexing in lib/seo.ts).
  const lang = await getLang();
  const { index, canonicalPath } = searchIndexing(params);
  let title = q ? t(lang, "search_results_for", { q }) : t(lang, "search_all_parts");
  let description: string | undefined;
  if (!q && category) {
    const found = (await fetchCategories()).find((c) => c.id === category);
    if (found) {
      const categoryName = pickName(lang, found.nameEn, found.nameAr);
      title = part ? `${part} — ${categoryName}` : categoryPageTitle(categoryName, lang);          // a part page is titled by its part
      description = categoryPageDescription(categoryName, lang);
    }
  }
  return { title, description, alternates: alternatesFor(lang, canonicalPath), robots: { index, follow: true } };
}

// Real Server Component -- re-fetches real, filtered results on every
// real navigation (a new search query, category, real vehicle
// fitment, or page number is a real new page request in this model),
// so a search engine can index each real filtered result page on its
// own, with its own real URL.
export default async function SearchPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { q, category, part, generationId, year, versionId, page } = sp;
  const brandId = sp.brandId && /^[\w.:\-]{1,120}$/.test(sp.brandId) ? sp.brandId : undefined;          // the car chosen step by step (brand, then model, then year)
  const modelId = sp.modelId && /^[\w.:\-]{1,120}$/.test(sp.modelId) ? sp.modelId : undefined;
  const extra = readExtraFilters((n) => sp[n as keyof typeof sp]);          // sort, price range, delivery time (checked; anything odd is ignored)
  const lang = await getLang();
  const pageNum = Math.max(Number(page) || 1, 1);
  const [categories, { items: products, total, unreachable }, sectionParts] = await Promise.all([
    fetchCategories(),
    fetchProductsPaginated({ search: q, category, part, generationId, year: year ? Number(year) : undefined, versionId, brandId, modelId, ...extra, page: pageNum, limit: PAGE_SIZE, lang }),
    part && category ? fetchPartsForCategory(category).catch((): CategoryPart[] => []) : Promise.resolve<CategoryPart[]>([]),          // only for the part's name in the page's language
  ]);
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const sectionName = category ? (() => { const c = categories.find((x) => x.id === category); return c ? pickName(lang, c.nameEn, c.nameAr) : category; })() : null;
  const current = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string"));
  // A link to another page of the SAME results: every filter is kept (search words, section, part, car, sort, price, delivery), only the page changes.
  const pageHref = (p: number) => {
    const href = filterHref(current, {});
    return p > 1 ? `${href}${href.includes("?") ? "&" : "?"}page=${p}` : href;
  };
  // The title says what is being looked at: the part, else the section, else the search words; under it, where, and how many parts (fit the car).
  const partInfo = part ? sectionParts.find((p) => p.nameEn === part) : undefined;
  const title = (part && (partInfo ? pickName(lang, partInfo.nameEn, partInfo.nameAr) : part)) || sectionName || (q ? t(lang, "search_results_for", { q }) : t(lang, "search_all_parts"));
  const countText = generationId || modelId || brandId
    ? (total === 1 ? t(lang, "sf_fit_car_one") : t(lang, "sf_fit_car_many", { n: total }))
    : (total === 1 ? t(lang, "parts_found_one") : t(lang, "parts_found", { n: total }));
  const heading = (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight [overflow-wrap:anywhere]">{title}</h1>
      <p className="mt-1 text-sm text-muted">{part && sectionName ? `${t(lang, "sf_in_section", { section: sectionName })} · ` : ""}{countText}</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <form action={localizePath(lang, "/search")} className="mb-8">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder={t(lang, "search_page_placeholder")}
          className="w-full rounded-md border border-line px-4 py-3 text-sm"
        />
      </form>

      {/* The title, the car, ONE bar of filters (section, part, price, delivery, sort) and the filters that are on, as chips: all in one place above the results, which keep
          four columns. A real <Suspense> boundary is required around useSearchParams() (a production build fails without one); its fallback is the title alone. */}
      <Suspense fallback={<div className="mb-6">{heading}</div>}>
        <SearchFilters sections={categories.map((c) => ({ id: c.id, nameEn: c.nameEn, nameAr: c.nameAr }))} heading={heading} />
      </Suspense>
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <div className="min-w-0 flex-1">
          {products.length === 0 ? (
            <p className="text-muted">
              {unreachable
                ? t(lang, "shop_unreachable")
                : generationId || modelId || brandId
                  ? t(lang, "no_parts_vehicle")
                  : t(lang, "no_parts_search")}
            </p>
          ) : (
            <>
              {pageNum > 1 && <p className="mb-4"><Link href={pageHref(1)} className="text-sm font-bold text-navy underline underline-offset-4">{t(lang, "grid_back_to_start")}</Link></p>}
              {/* The first page is drawn here, on the server (in the page's HTML); the rest loads as the buyer scrolls. The key starts a fresh list whenever the search or a filter changes. */}
              <InfiniteProductGrid
                key={`${filterHref(current, {})}|${pageNum}`}
                id="results"
                source={{ kind: "search", params: { q, category, part, generationId, year: year ? Number(year) : undefined, versionId, brandId, modelId, ...extra } }}
                initial={products}
                total={total}
                startPage={pageNum}
                pageSize={PAGE_SIZE}
                gridClassName="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4"
              />
            </>
          )}

          {/* Real pagination controls (new) -- closes a real, confirmed
              gap: GET /catalog/products had no pagination at all before
              this, so every existing page fetched the ENTIRE real
              catalog on every request. Only rendered when there's
              genuinely more than one real page -- an honest, not just
              cosmetic, hidden state. */}
          {totalPages > 1 && (
            <>
              {/* Without JavaScript the list cannot load itself: ordinary links to the other pages. */}
              <noscript>
                <nav className="mt-8 flex items-center justify-center gap-2" aria-label={t(lang, "search_pages_nav")}>
                  <Link
                    href={pageHref(pageNum - 1)}
                    aria-disabled={pageNum <= 1}
                    className={`rounded-md border border-line px-3 py-1.5 text-sm ${pageNum <= 1 ? "pointer-events-none opacity-40" : "hover:border-ink"}`}
                  >
                    {t(lang, "previous")}
                  </Link>
                  <span className="text-sm text-muted px-2">
                    {t(lang, "page_x_of_y", { page: pageNum, total: totalPages })}
                  </span>
                  <Link
                    href={pageHref(pageNum + 1)}
                    aria-disabled={pageNum >= totalPages}
                    className={`rounded-md border border-line px-3 py-1.5 text-sm ${pageNum >= totalPages ? "pointer-events-none opacity-40" : "hover:border-ink"}`}
                  >
                    {t(lang, "next")}
                  </Link>
                </nav>

              </noscript>
              {/* With JavaScript the same links stay in the page, out of sight, so a search engine can still follow them to every page of results. */}
              <div aria-hidden="true" className="sr-only">
                <Link href={pageHref(Math.max(pageNum - 1, 1))} tabIndex={-1}>{t(lang, "previous")}</Link>
                <Link href={pageHref(Math.min(pageNum + 1, totalPages))} tabIndex={-1}>{t(lang, "next")}</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
