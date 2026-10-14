import type { MetadataRoute } from "next";
import { fetchCategories, fetchProducts } from "@/lib/api";
import { absoluteUrl, siteUrl } from "@/lib/seo";

// Google reads at most this many URLs from one sitemap file. (When the catalog outgrows it, split it with generateSitemaps: see the Next.js docs.)
const MAX_URLS = 50000;

// The pages worth finding: the home page, the full catalog, every CATEGORY page that has products (a real landing page for "brake parts", "filters"...), and
// every product. A category with no products is left out: an empty landing page is thin content and does the site no good.
//
// Deliberately NOT here: lastModified, changeFrequency, priority. A product page has no "last changed" date to be honest about (prices are worked out live),
// and a sitemap that says "changed just now" for every page teaches Google to ignore it. Google also ignores the other two. Add a real lastModified only when
// products carry a real updated date.
//
// Regenerated as the product data is (see REVALIDATE_SECONDS in lib/api.ts), so new products appear without a rebuild.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([fetchProducts(), fetchCategories()]);

  const withProducts = new Set(products.map((p) => p.category));
  const fixed: MetadataRoute.Sitemap = [
    { url: siteUrl() },
    { url: absoluteUrl("/search") },
    ...categories.filter((c) => withProducts.has(c.id)).map((c) => ({ url: absoluteUrl(`/search?category=${encodeURIComponent(c.id)}`) })),
  ];
  const room = Math.max(MAX_URLS - fixed.length, 0);
  if (products.length > room) {
    console.warn(`[sitemap] ${products.length} products but a sitemap file holds ${MAX_URLS} URLs: the last ${products.length - room} are left out. Split the sitemap.`);
  }
  return [...fixed, ...products.slice(0, room).map((p) => ({ url: absoluteUrl(`/products/${p.id}`) }))];
}
