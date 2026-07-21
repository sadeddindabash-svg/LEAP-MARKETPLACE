import type { MetadataRoute } from "next";
import { fetchProducts } from "@/lib/api";

// Real, dynamic sitemap -- generated from the real, current product
// catalog every time a search engine requests it (Next.js serves this
// at /sitemap.xml automatically), so every real product page is
// actually discoverable, not just the ones a crawler happens to find
// by following links.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";
  const products = await fetchProducts();

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${siteUrl}/products/${p.id}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/search`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.5,
    },
    ...productEntries,
  ];
}
