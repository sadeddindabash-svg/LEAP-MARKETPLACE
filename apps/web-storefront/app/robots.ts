import type { MetadataRoute } from "next";
import { localizePath } from "@/lib/i18n";
import { PRIVATE_PATHS, siteUrl } from "@/lib/seo";

// Crawlers may read everything EXCEPT the pages that belong to one person (cart, checkout, login, orders...). Those pages also carry a noindex tag (a layout.tsx
// in each of those folders): robots.txt keeps crawlers from wasting visits there, the tag is the safety net for a crawler that ignores robots.txt. A test
// compares this list with the real folders, so a new private page cannot be forgotten.
export default function robots(): MetadataRoute.Robots {
  return {
    // each private page is blocked in BOTH languages (/cart and /ar/cart)
    rules: { userAgent: "*", allow: "/", disallow: [...PRIVATE_PATHS, ...PRIVATE_PATHS.map((p) => localizePath("ar", p)), "/api/"] },          // /api/ is the door the lists load their next page through: not for crawlers
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
