import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { ProductDetail, ReviewsSummary } from "./api";
import {
  DESCRIPTION_BUDGET, PRIVATE_PATHS, TITLE_BUDGET, absoluteUrl, alternatesFor, breadcrumbJsonLd, categoryPageDescription, categoryPageTitle, jsonLdString, productDescription,
  productJsonLd, productTitle, searchIndexing, siteUrl, truncate, websiteJsonLd,
} from "./seo";

// The rule behind all of it: ONLY REAL DATA in what search engines are told. These tests pin the rules down.
const product: ProductDetail = {
  id: "p1", name: "RIDEX Front Brake Disc, Vented 300mm", description: "Vented front brake disc for BMW 1 Series.", category: "brake", part: "Front Brake Disc", position: "Front",
  oemNumber: "34116792217", currencyCode: "USD",
  rating: 4.6, reviewCount: 812,                      // the SEED's stored numbers (invented): they must never reach a search engine
  stockQuantity: 12, estimatedDeliveryDays: 5, weightKg: 5, status: "active", price: 34.9, images: ["/uploads/a.jpg", "/uploads/b.jpg"],
  brand: "BMW", model: "1 Series", year: 2017, fitsVehicleIds: [],
};
const noReviews: ReviewsSummary = { averageRating: null, reviewCount: 0, reviews: [] };
const realReviews: ReviewsSummary = { averageRating: 4.5, reviewCount: 2, reviews: [] };

beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com/"); });
afterEach(() => { vi.unstubAllEnvs(); });

describe("addresses", () => {
  it("the site address has no trailing slash, and relative paths become full addresses", () => {
    expect(siteUrl()).toBe("https://shop.example.com");
    expect(absoluteUrl("/products/p1")).toBe("https://shop.example.com/products/p1");
    expect(absoluteUrl("products/p1")).toBe("https://shop.example.com/products/p1");
    expect(absoluteUrl("https://cdn.example.com/x.jpg")).toBe("https://cdn.example.com/x.jpg");
  });
  it("falls back to localhost only when no address is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(siteUrl()).toBe("http://localhost:3001");
  });
});

describe("alternatesFor: a page and its other-language twin", () => {
  it("CRITICAL: each language's page names ITSELF as canonical and lists both languages and the default", () => {
    expect(alternatesFor("en", "/products/p1")).toEqual({ canonical: "https://shop.example.com/products/p1", languages: { en: "https://shop.example.com/products/p1", ar: "https://shop.example.com/ar/products/p1", "x-default": "https://shop.example.com/products/p1" } });
    expect(alternatesFor("ar", "/products/p1").canonical).toBe("https://shop.example.com/ar/products/p1");
    expect(alternatesFor("ar", "/search?category=brake").canonical).toBe("https://shop.example.com/ar/search?category=brake");
    expect(alternatesFor("ar", "/").canonical).toBe("https://shop.example.com/ar");
  });
});

describe("the page text follows the language", () => {
  it("product description facts and category titles come out in Arabic, and default to English", () => {
    const p = { ...product, description: null };
    expect(productDescription(p, "ar")).toContain("رقم OEM 34116792217.");
    expect(productDescription(p, "ar")).toContain("التوصيل المتوقع خلال 5 أيام.");
    expect(productDescription(p)).toContain("Estimated delivery 5 days.");
    expect(categoryPageTitle("Brake System")).toBe("Brake System parts");
    expect(categoryPageTitle("نظام الفرامل", "ar")).toBe("قطع نظام الفرامل");
    expect(categoryPageDescription("نظام الفرامل", "ar")).toContain("نظام الفرامل");
  });
});

describe("truncate", () => {
  it("leaves short text alone, collapses whitespace, and cuts long text at a word with an ellipsis", () => {
    expect(truncate("  short   text ", 50)).toBe("short text");
    const out = truncate("one two three four five six seven eight nine ten", 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/\s…$/);
    expect(out.replace("…", "").trim().split(" ").every((w) => ["one", "two", "three", "four", "five"].includes(w))).toBe(true);   // no half words
  });
});

describe("product title: what people search for (the part number and the car), as much as fits", () => {
  it("CRITICAL: name, then the part number; the vehicle is added only if it still fits the budget", () => {
    expect(productTitle(product)).toBe("RIDEX Front Brake Disc, Vented 300mm – OEM 34116792217");
    const short = { ...product, name: "Brake Disc" };
    expect(productTitle(short)).toBe("Brake Disc – OEM 34116792217 – BMW 1 Series 2017");
    expect(productTitle(short).length).toBeLessThanOrEqual(TITLE_BUDGET);
  });
  it("uses only what exists: no part number, no vehicle, nothing invented", () => {
    expect(productTitle({ ...product, oemNumber: null, brand: null, model: null, year: null })).toBe("RIDEX Front Brake Disc, Vented 300mm");
    expect(productTitle({ ...product, name: "Disc", oemNumber: null })).toBe("Disc – BMW 1 Series 2017");
    expect(productTitle({ ...product, name: "Disc", oemNumber: null, model: null, year: null })).toBe("Disc – BMW");
  });
  it("a name that is too long alone is cut, never overflowing the budget", () => {
    const title = productTitle({ ...product, name: "A".repeat(40) + " " + "B".repeat(60), oemNumber: null, brand: null, model: null, year: null });
    expect(title.length).toBeLessThanOrEqual(TITLE_BUDGET);
  });
});

describe("product description: the facts a buyer scans for", () => {
  it("CRITICAL: carries the part number, the fitment, stock, price and delivery, within the budget", () => {
    const d = productDescription(product);
    expect(d).toContain("OEM 34116792217");
    expect(d).toContain("Fits BMW 1 Series 2017");
    expect(d).toContain("In stock.");
    expect(d).toContain("$34.90");
    expect(d).toContain("Estimated delivery 5 days");
    expect(d.length).toBeLessThanOrEqual(DESCRIPTION_BUDGET);
  });
  it("says so when sold out, falls back to the name when there is no description, and skips what is unknown", () => {
    const d = productDescription({ ...product, description: null, stockQuantity: 0, oemNumber: null, brand: null, model: null, year: null, estimatedDeliveryDays: null });
    expect(d).toBe("RIDEX Front Brake Disc, Vented 300mm. Currently out of stock. $34.90.");
    expect(d).not.toMatch(/OEM|Fits|delivery/);
  });
  it("a long product description is shortened so the facts still fit", () => {
    const d = productDescription({ ...product, description: "Very long description. ".repeat(30) });
    expect(d.length).toBeLessThanOrEqual(DESCRIPTION_BUDGET);
    expect(d).toContain("$34.90");
  });
});

describe("which search pages are indexed", () => {
  it("CRITICAL: a category page is indexed; a typed query, a vehicle filter or page 2 is not, and each points at the category page", () => {
    expect(searchIndexing({})).toEqual({ index: true, canonicalPath: "/search" });
    expect(searchIndexing({ category: "brake" })).toEqual({ index: true, canonicalPath: "/search?category=brake" });
    for (const params of [{ q: "disc" }, { category: "brake", q: "disc" }, { category: "brake", generationId: "g1" }, { category: "brake", year: "2017" }, { category: "brake", page: "2" }]) {
      const r = searchIndexing(params);
      expect(r.index, JSON.stringify(params)).toBe(false);
      expect(r.canonicalPath).toBe(params.category ? "/search?category=brake" : "/search");
    }
    expect(searchIndexing({ q: "   " }).index).toBe(true);           // an empty box is not a query
    // a PART page is a landing page of its own: indexed, canonical to itself; with a vehicle, a query or page 2 it points back at the part page
    expect(searchIndexing({ category: "brake", part: "Front Brake Disc" })).toEqual({ index: true, canonicalPath: "/search?category=brake&part=Front%20Brake%20Disc" });
    expect(searchIndexing({ category: "brake", part: "Front Brake Disc", generationId: "g1", year: "2017" })).toEqual({ index: false, canonicalPath: "/search?category=brake&part=Front%20Brake%20Disc" });
    expect(searchIndexing({ part: "Front Brake Disc" }).canonicalPath).toBe("/search");          // a part without its category is not a page of its own
    expect(searchIndexing({ category: "a&b" }).canonicalPath).toBe("/search?category=a%26b");
  });
  it("category pages have their own title and description", () => {
    expect(categoryPageTitle("Brake System")).toBe("Brake System parts");
    expect(categoryPageDescription("Brake System")).toContain("Brake System");
  });
});

describe("structured data (JSON-LD)", () => {
  const opts = { url: "https://shop.example.com/products/p1", imageUrls: ["https://api.example.com/uploads/a.jpg"], categoryName: "Brake System" };

  it("CRITICAL: the Product carries the real offer: price, currency, availability, part number", () => {
    const ld = productJsonLd(product, noReviews, opts);
    expect(ld["@type"]).toBe("Product");
    expect(ld).toMatchObject({ name: product.name, sku: "p1", mpn: "34116792217", category: "Brake System", image: opts.imageUrls });
    expect(ld.offers).toEqual({ "@type": "Offer", url: opts.url, priceCurrency: "USD", price: "34.90", availability: "https://schema.org/InStock" });
    expect(productJsonLd({ ...product, stockQuantity: 0 }, noReviews, opts).offers.availability).toBe("https://schema.org/OutOfStock");
  });
  it("CRITICAL: NO rating without real reviews: the seed's stored 4.6 stars and 812 reviews never reach a search engine", () => {
    const ld = productJsonLd(product, noReviews, opts);
    expect(ld.aggregateRating).toBeUndefined();
    expect(JSON.stringify(ld)).not.toMatch(/4\.6|812|aggregateRating|ratingValue/);
  });
  it("with REAL reviews, the rating is theirs", () => {
    const ld = productJsonLd(product, realReviews, opts);
    expect(ld.aggregateRating).toEqual({ "@type": "AggregateRating", ratingValue: 4.5, reviewCount: 2, bestRating: 5, worstRating: 1 });
    expect(productJsonLd(product, { averageRating: null, reviewCount: 3, reviews: [] }, opts).aggregateRating).toBeUndefined();    // a count without an average is not a rating
  });
  it("leaves out what the product does not have, and never states a brand or a condition it was not given", () => {
    const text = JSON.stringify(productJsonLd({ ...product, oemNumber: null, description: null, images: [] }, noReviews, { url: opts.url, imageUrls: [] }));
    expect(text).not.toMatch(/mpn|description|"image"/);
    expect(text).not.toMatch(/"brand"|itemCondition/);
  });
  it("the breadcrumb trail has full addresses in order", () => {
    const ld = breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Brake System", path: "/search?category=brake" }, { name: "Disc", path: "/products/p1" }]);
    expect(ld.itemListElement.map((i) => [i.position, i.name, i.item])).toEqual([
      [1, "Home", "https://shop.example.com/"], [2, "Brake System", "https://shop.example.com/search?category=brake"], [3, "Disc", "https://shop.example.com/products/p1"],
    ]);
  });
  it("the site data names the organization and offers the search box, pointing at the real search address", () => {
    const graph = websiteJsonLd()["@graph"];
    expect(graph.map((g) => g["@type"])).toEqual(["Organization", "WebSite"]);
    expect(JSON.stringify(graph[1])).toContain("https://shop.example.com/search?q={search_term_string}");
  });
  it("CRITICAL: nothing in a product name can close the script tag (the character < is escaped)", () => {
    const text = jsonLdString({ name: "</script><script>alert(1)</script>" });
    expect(text).not.toContain("<");
    expect(text).toContain("\\u003c/script>");
    expect(JSON.parse(text).name).toBe("</script><script>alert(1)</script>");          // and it still reads back exactly
  });
});

describe("private pages are kept out of search results, two ways, checked against the REAL folders", () => {
  const appDir = path.resolve(__dirname, "../app");
  const PUBLIC_SECTIONS = ["products", "search", "find", "contact", "about-us", "terms-conditions", "delivery-shipping-policy", "refund-policy", "privacy-policy", "cancellation-replacement-policy", "privecy-policy"];                                        // the only sections meant for search engines
  const NOT_PAGES = ["api"];                                                                                // doors the website's own pages call (lazy loading): not pages, and robots.txt keeps crawlers out

  it("CRITICAL: every section of the site is either public on purpose or listed as private: a new private page cannot be forgotten", () => {
    const sections = fs.readdirSync(appDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => `/${e.name}`);
    const unknown = sections.filter((s) => !PRIVATE_PATHS.includes(s as (typeof PRIVATE_PATHS)[number]) && !PUBLIC_SECTIONS.includes(s.slice(1)) && !NOT_PAGES.includes(s.slice(1)));
    expect(unknown).toEqual([]);
    for (const p of PRIVATE_PATHS) expect(sections, `${p} is listed as private but has no folder`).toContain(p);
    expect(PRIVATE_PATHS).toEqual(expect.arrayContaining(["/garage", "/compare"]));          // the garage and a comparison belong to one buyer
  });

  it("CRITICAL: each private section has a layout that says noindex, so even a crawler that ignores robots.txt keeps it out", async () => {
    for (const p of PRIVATE_PATHS) {
      const file = path.join(appDir, p.slice(1), "layout.tsx");
      expect(fs.existsSync(file), `${p} has no layout.tsx`).toBe(true);
      const mod = await import(/* @vite-ignore */ file);
      expect(mod.metadata?.robots, p).toEqual({ index: false, follow: false });
    }
  });
});
