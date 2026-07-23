import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { fetchCategories, fetchProducts, resolveImageUrl } from "@/lib/api";
import { SaveSearchButton } from "@/components/SaveSearchButton";
import { VehicleFilter } from "@/components/VehicleFilter";

interface PageProps {
  searchParams: Promise<{ q?: string; category?: string; generationId?: string; year?: string }>;
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `Search results for "${q}"` : "Browse all parts",
  };
}

// Real Server Component -- re-fetches real, filtered results on every
// real navigation (a new search query, category, or real vehicle
// fitment is a real new page request in this model), so a search
// engine can index each real filtered result page on its own, with
// its own real URL.
export default async function SearchPage({ searchParams }: PageProps) {
  const { q, category, generationId, year } = await searchParams;
  const [categories, products] = await Promise.all([
    fetchCategories(),
    fetchProducts({ search: q, category, generationId, year: year ? Number(year) : undefined }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <form action="/search" className="mb-8">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by part name, OEM number, or vehicle..."
          className="w-full rounded-md border border-line px-4 py-3 text-sm"
        />
      </form>

      <div className="flex gap-8">
        <aside className="w-56 shrink-0 space-y-6">
          {/* Real <Suspense> boundary required around useSearchParams()
              (see app/checkout/confirmation/page.tsx's own comment for
              the full finding -- a real production build fails
              outright without one, not just a warning). */}
          <Suspense fallback={<div className="rounded-lg border border-line bg-white p-4 text-sm text-muted">Loading…</div>}>
            <VehicleFilter />
          </Suspense>

          <div>
            <h2 className="font-display font-bold text-lg mb-3">Category</h2>
            <ul className="space-y-1 text-sm">
              <li>
                <Link
                  href={`/search${q ? `?q=${encodeURIComponent(q)}` : ""}`}
                  className={!category ? "font-semibold text-signal" : "text-muted hover:text-ink"}
                >
                  All categories
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/search?category=${encodeURIComponent(c.id)}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                    className={category === c.id ? "font-semibold text-signal" : "text-muted hover:text-ink"}
                  >
                    {c.nameEn}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted">
              {products.length} part{products.length === 1 ? "" : "s"} found
              {generationId && " matching your vehicle"}
            </p>
            <SaveSearchButton searchTerm={q} category={category} />
          </div>
          {products.length === 0 ? (
            <p className="text-muted">
              {generationId
                ? "No parts match your vehicle yet. Try browsing without the vehicle filter."
                : "No parts match your search. Try a different term or category."}
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {products.map((p) => (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="group rounded-lg border border-line bg-white overflow-hidden hover:border-ink transition-colors"
                >
                  <div className="aspect-square bg-chalk relative overflow-hidden">
                    {p.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveImageUrl(p.images[0])}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted text-sm">
                        No photo
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-sm line-clamp-2">{p.name}</p>
                    <p className="mt-1 font-display font-bold text-lg">
                      ${p.price.toFixed(2)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
