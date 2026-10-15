import type { MetadataRoute } from "next";
import { fetchCategories, fetchProducts } from "@/lib/api";
import { languageAlternates } from "@/lib/i18n";
import { absoluteUrl } from "@/lib/seo";

// Google reads at most this many URLs from one sitemap file. (When the catalog outgrows it, split it with generateSitemaps: see the Next.js docs.)
const MAX_URLS = 50000;

// Every page is listed once per language (English, and Arabic under /ar), each entry pointing at the other: that is how a search engine learns they are the same page.
//
// The pages worth finding: the home page, the full catalog, every CATEGORY page that has products (a real landing page for "brake parts", "filters"...), and
// every product. A category with no products is left out: an empty landing page is thin content and does the site no good.
//
// Deliberately NOT here: lastModified, changeFrequency, priority. A product page has no "last changed" date to be honest about (prices are worked out live),
// and a sitemap that says "changed just now" for every page teaches Google to ignore it. Google also ignores the other two. Add a real lastModified only when
// products carry a real updated date.
//
// Regenerated as the product data is (see REVALIDATE_SECONDS in lib/api.ts), so new products appear without a rebuild.
// One page, as its English and Arabic entries.
function bothLanguages(path: string): MetadataRoute.Sitemap {
  const alt = languageAlternates(path, absoluteUrl);
  const languages = { en: alt.en, ar: alt.ar };
  return [{ url: alt.en, alternates: { languages } }, { url: alt.ar, alternates: { languages } }];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([fetchProducts(), fetchCategories()]);

  const withProducts = new Set(products.map((p) => p.category));
  const fixed: MetadataRoute.Sitemap = [
    ...bothLanguages("/"),
    ...bothLanguages("/search"),
    ...bothLanguages("/find"),
    ...categories.filter((c) => withProducts.has(c.id)).flatMap((c) => bothLanguages(`/search?category=${encodeURIComponent(c.id)}`)),
  ];
  // (each product is two entries, so the room is counted in entries, not products)
  const room = Math.max(MAX_URLS - fixed.length, 0);
  const capacity = Math.floor(room / 2);
  if (products.length > capacity) {
    console.warn(`[sitemap] ${products.length} products but a sitemap file holds ${MAX_URLS} URLs (two per product, one per language): the last ${products.length - capacity} are left out. Split the sitemap.`);
  }
  return [...fixed, ...products.slice(0, capacity).flatMap((p) => bothLanguages(`/products/${p.id}`))];
}
