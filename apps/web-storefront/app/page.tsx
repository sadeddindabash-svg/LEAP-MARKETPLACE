import Link from "next/link";
import { fetchCategories, fetchProducts, resolveImageUrl } from "@/lib/api";

// Real Server Component -- this data is fetched and rendered into
// real, crawlable HTML at request time, on the server. This is the
// entire reason this app exists alongside the mobile app: a search
// engine sees real product names, prices, and descriptions in the
// initial HTML response, not an empty shell waiting for client-side
// JavaScript to fill it in.
export default async function HomePage() {
  const [categories, products] = await Promise.all([
    fetchCategories(),
    fetchProducts({ sort: "newest" }),
  ]);

  return (
    <div>
      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <h1 className="font-display font-bold text-5xl md:text-7xl leading-[0.95] tracking-tight max-w-3xl">
            Find the exact part your car actually needs.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">
            Real parts from verified suppliers, matched to your vehicle&rsquo;s
            real fitment — not a guess from a part number search.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              href="/search"
              className="inline-flex items-center rounded-md bg-signal px-6 py-3 text-white font-semibold hover:bg-signal-dark transition-colors"
            >
              Browse parts
            </Link>
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="font-display font-bold text-2xl tracking-tight mb-6">
            Shop by category
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/search?category=${encodeURIComponent(c.id)}`}
                className="rounded-lg border border-line bg-white px-4 py-5 text-center hover:border-ink transition-colors"
              >
                <span className="font-medium text-sm">{c.nameEn}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="font-display font-bold text-2xl tracking-tight mb-6">
          Recently listed
        </h2>
        {products.length === 0 ? (
          <p className="text-muted">
            No parts are listed right now — check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {products.slice(0, 12).map((p) => (
              <Link
                key={p.id}
                href={`/products/${p.id}`}
                className="group rounded-lg border border-line bg-white overflow-hidden hover:border-ink transition-colors"
              >
                <div className="aspect-square bg-chalk relative overflow-hidden">
                  {p.images[0] ? (
                    // Real product photos, not placeholders -- an
                    // <img> here (not next/image) deliberately, since
                    // these come from a configurable, potentially
                    // cloud-hosted origin decided at runtime by the
                    // backend (see resolveImageUrl's own comment),
                    // which next/image's static domain allowlist isn't
                    // set up for in this project yet.
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
                  {p.part && (
                    <span className="plate-chip mt-2">{p.part}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
