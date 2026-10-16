import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "@/components/LocLink";
import { fetchCategories, fetchProductsPaginated } from "@/lib/api";
import FitsMyCarToggle from "@/components/FitsMyCarToggle";
import InfiniteProductGrid from "@/components/InfiniteProductGrid";
import { localizePath, pickName, t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { SaveSearchButton } from "@/components/SaveSearchButton";
import { VehicleFilter } from "@/components/VehicleFilter";
import { alternatesFor, categoryPageDescription, categoryPageTitle, searchIndexing } from "@/lib/seo";

const PAGE_SIZE = 24;

interface PageProps {
  searchParams: Promise<{ q?: string; category?: string; part?: string; generationId?: string; year?: string; page?: string }>;
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
  const { q, category, part, generationId, year, page } = await searchParams;
  const lang = await getLang();
  const pageNum = Math.max(Number(page) || 1, 1);
  const [categories, { items: products, total, unreachable }] = await Promise.all([
    fetchCategories(),
    fetchProductsPaginated({ search: q, category, part, generationId, year: year ? Number(year) : undefined, page: pageNum, limit: PAGE_SIZE, lang }),
  ]);
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  // Real pagination link builder -- preserves every other real active
  // filter (q, category, generationId, year) while only changing the
  // real page number, so paging through results doesn't silently drop
  // whatever the buyer was actually filtering by.
  const pageHref = (p: number, dropPart = false) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (part && !dropPart) params.set("part", part);
    if (generationId) params.set("generationId", generationId);
    if (year) params.set("year", year);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/search${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <form action={localizePath(lang, "/search")} className="mb-8">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder={t(lang, "search_page_placeholder")}
          className="w-full rounded-md border border-line px-4 py-3 text-sm"
        />
      </form>

      {/* Phones: the filters stack ABOVE the results (a fixed 224 px sidebar beside them left two 90 px product columns and pushed the page sideways); from 1024 px they sit beside them. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <aside className="w-full space-y-6 lg:w-56 lg:shrink-0">
          {/* Real <Suspense> boundary required around useSearchParams()
              (see app/checkout/confirmation/page.tsx's own comment for
              the full finding -- a real production build fails
              outright without one, not just a warning). */}
          <Suspense fallback={<div className="rounded-lg border border-line bg-white p-4 text-sm text-muted">{t(lang, "search_loading")}</div>}>
            <FitsMyCarToggle />
            <VehicleFilter />
          </Suspense>

          <div>
            <h2 className="font-display font-bold text-lg mb-3">{t(lang, "category_label")}</h2>
            <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 text-sm sm:-mx-8 sm:px-8 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0">          {/* phones: a swipeable row of chips; desktop: the list */}
              <li>
                <Link
                  href={`/search${q ? `?q=${encodeURIComponent(q)}` : ""}`}
                  className={`shrink-0 whitespace-nowrap rounded-full border border-line bg-white px-3 py-1.5 lg:whitespace-normal lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:[overflow-wrap:anywhere] ${!category ? "font-semibold text-signal" : "text-muted hover:text-ink"}`}
                >
                  {t(lang, "all_sections")}
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/search?category=${encodeURIComponent(c.id)}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                    className={`shrink-0 whitespace-nowrap rounded-full border border-line bg-white px-3 py-1.5 lg:whitespace-normal lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:[overflow-wrap:anywhere] ${category === c.id ? "font-semibold text-signal" : "text-muted hover:text-ink"}`}
                  >
                    {pickName(lang, c.nameEn, c.nameAr)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted">
              {total === 1 ? t(lang, "parts_found_one") : t(lang, "parts_found", { n: total })}
              {generationId && ` ${t(lang, "matching_vehicle")}`}
            </p>
            {part && (
              <Link href={pageHref(1, true)} className="inline-flex items-center gap-2 rounded-full bg-navy px-3 py-1 text-xs font-bold text-white">
                {t(lang, "part_filter", { part })}<span aria-hidden="true">×</span><span className="sr-only">{t(lang, "clear")}</span>
              </Link>
            )}
            <SaveSearchButton searchTerm={q} category={category} />
          </div>
          {products.length === 0 ? (
            <p className="text-muted">
              {unreachable
                ? t(lang, "shop_unreachable")
                : generationId
                  ? t(lang, "no_parts_vehicle")
                  : t(lang, "no_parts_search")}
            </p>
          ) : (
            <>
              {pageNum > 1 && <p className="mb-4"><Link href={pageHref(1)} className="text-sm font-bold text-navy underline underline-offset-4">{t(lang, "grid_back_to_start")}</Link></p>}
              {/* The first page is drawn here, on the server (in the page's HTML); the rest loads as the buyer scrolls. The key starts a fresh list whenever the search or a filter changes. */}
              <InfiniteProductGrid
                key={`${q ?? ""}|${category ?? ""}|${part ?? ""}|${generationId ?? ""}|${year ?? ""}|${pageNum}`}
                id="results"
                source={{ kind: "search", params: { q, category, part, generationId, year: year ? Number(year) : undefined } }}
                initial={products}
                total={total}
                startPage={pageNum}
                pageSize={PAGE_SIZE}
                gridClassName="grid grid-cols-2 gap-5 md:grid-cols-3"
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
