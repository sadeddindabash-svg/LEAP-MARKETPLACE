// Everything the storefront tells search engines, in one place, as plain functions (so it can be tested without a server and so every page says the same thing).
//
// The rule behind all of it: ONLY REAL DATA. A title, description or structured-data field is built from what the product really has; a field the product does not
// have (a part brand, a condition, a rating nobody gave) is left out. Search engines penalise made-up data, and an invented review rating is the quickest way there.
import type { ProductDetail, ReviewsSummary } from "./api";
import { languageAlternates, localizePath, t, type Lang } from "./i18n";

export const SITE_NAME = "Leap Auto Parts";

/** The public address of this storefront (set NEXT_PUBLIC_SITE_URL in production: https, the real domain). */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001").replace(/\/+$/, "");
}

export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${siteUrl()}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

/**
 * Pages that belong to ONE person (their cart, orders, account...). They have nothing to offer a search engine, so they are kept out two ways: robots.txt
 * (robots.ts) and a noindex tag (a layout.tsx in each of these folders). Both are tested against the real folders, so a new private page cannot be forgotten.
 */
export const PRIVATE_PATHS = ["/cart", "/checkout", "/login", "/signup", "/orders", "/wishlist", "/notifications", "/returns", "/support", "/referrals", "/saved-searches"] as const;

/**
 * What a page tells search engines about its two language versions: its OWN address as the canonical one (/ar/... for the Arabic page, the plain address for English),
 * and the hreflang links between them, so each language is indexed on its own and shown to the right searchers. `englishPath` is the unprefixed path, query included.
 */
export function alternatesFor(lang: Lang, englishPath: string) {
  return { canonical: absoluteUrl(localizePath(lang, englishPath)), languages: languageAlternates(englishPath, absoluteUrl) };
}

/** Roughly what a search result shows of a title (the layout then adds " | Leap Auto Parts"). */
export const TITLE_BUDGET = 62;
export const DESCRIPTION_BUDGET = 160;

/** Cuts [text] to at most [max] characters at a word boundary, with an ellipsis; leaves shorter text alone. */
export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-–]+$/, "")}…`;
}

type TitleFields = Pick<ProductDetail, "name" | "oemNumber" | "brand" | "model" | "year">;

function vehicleOf(p: Pick<ProductDetail, "brand" | "model" | "year">): string {
  return [p.brand, p.model, p.year].filter(Boolean).join(" ");
}

/**
 * "<name> – OEM <part number> – <Brand Model Year>": people search a part by its NUMBER and by the CAR, so both go in the title, as much as fits, the part
 * number first. The name always stays whole (cut only if it alone is too long).
 */
export function productTitle(p: TitleFields): string {
  const parts = [truncate(p.name, TITLE_BUDGET)];
  const fits = (extra: string) => [...parts, extra].join(" – ").length <= TITLE_BUDGET;
  if (p.oemNumber && fits(`OEM ${p.oemNumber}`)) parts.push(`OEM ${p.oemNumber}`);
  const vehicle = vehicleOf(p);
  if (vehicle && fits(vehicle)) parts.push(vehicle);
  return parts.join(" – ");
}

/** The snippet under the title: the product's own words (short), then the facts a buyer scans for: part number, fitment, stock, price, delivery. */
export function productDescription(p: Pick<ProductDetail, "name" | "description" | "oemNumber" | "brand" | "model" | "year" | "stockQuantity" | "price" | "estimatedDeliveryDays">, lang: Lang = "en"): string {
  const vehicle = vehicleOf(p);
  const facts = [
    p.oemNumber ? t(lang, "desc_oem", { n: p.oemNumber }) : null,
    vehicle ? t(lang, "desc_fits", { v: vehicle }) : null,
    t(lang, p.stockQuantity > 0 ? "desc_in_stock" : "desc_out_of_stock"),
    `$${p.price.toFixed(2)}.`,
    p.estimatedDeliveryDays ? t(lang, "desc_delivery", { n: p.estimatedDeliveryDays }) : null,
  ].filter(Boolean).join(" ");
  const lead = truncate(p.description || p.name, 90);
  return truncate(`${lead}${/[.!?…]$/.test(lead) ? "" : "."} ${facts}`, DESCRIPTION_BUDGET);
}

export function categoryPageTitle(name: string, lang: Lang = "en"): string {
  return t(lang, "category_title", { name });
}
export function categoryPageDescription(name: string, lang: Lang = "en"): string {
  return t(lang, "category_description", { name });
}

/**
 * Which search pages belong in Google. A category page ("/search?category=brake") is a real landing page and is indexed. Everything else is endless
 * near-duplicate variations (every typed query, every vehicle filter, page 2, 3...): crawled and followed, but kept out of the index, and pointing at the
 * category page as the one real version.
 */
export function searchIndexing(params: { q?: string; category?: string; generationId?: string; year?: string; page?: string }): { index: boolean; canonicalPath: string } {
  const page = Number(params.page) || 1;
  const filtered = Boolean(params.q?.trim() || params.generationId || params.year) || page > 1;
  return { index: !filtered, canonicalPath: params.category ? `/search?category=${encodeURIComponent(params.category)}` : "/search" };
}

// ---------------------------------------------------------------- structured data (schema.org, as JSON-LD)

/** The text of a <script type="application/ld+json">, with "<" escaped so nothing in a product name can close the tag (this is what the Next.js guide prescribes). */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * A Product with its real offer. Left out on purpose: `brand` (the storefront is not given the part's manufacturer, and a car brand is not it), `itemCondition`
 * (genuine and aftermarket parts are both sold; nothing says which), and any rating unless REAL reviews exist (never the stored seed rating).
 */
export function productJsonLd(p: ProductDetail, reviews: ReviewsSummary, opts: { url: string; imageUrls: string[]; categoryName?: string }) {
  const hasReviews = reviews.reviewCount > 0 && reviews.averageRating != null;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    url: opts.url,
    description: p.description || undefined,
    image: opts.imageUrls.length > 0 ? opts.imageUrls : undefined,
    sku: p.id,
    mpn: p.oemNumber || undefined,
    category: opts.categoryName || p.category || undefined,
    offers: {
      "@type": "Offer",
      url: opts.url,
      priceCurrency: p.currencyCode,
      price: p.price.toFixed(2),
      availability: p.stockQuantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    aggregateRating: hasReviews ? { "@type": "AggregateRating", ratingValue: Number((reviews.averageRating as number).toFixed(1)), reviewCount: reviews.reviewCount, bestRating: 5, worstRating: 1 } : undefined,
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: absoluteUrl(item.path) })),
  };
}

/** The site itself: its name, and the search box Google can offer inside the result for the brand name. */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${siteUrl()}/#organization`, name: SITE_NAME, url: siteUrl() },
      {
        "@type": "WebSite",
        "@id": `${siteUrl()}/#website`,
        name: SITE_NAME,
        url: siteUrl(),
        publisher: { "@id": `${siteUrl()}/#organization` },
        potentialAction: { "@type": "SearchAction", target: `${siteUrl()}/search?q={search_term_string}`, "query-input": "required name=search_term_string" },
      },
    ],
  };
}
