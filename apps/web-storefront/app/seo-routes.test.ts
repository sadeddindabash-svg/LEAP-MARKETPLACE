import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ProductDetail, ProductSummary } from "@/lib/api";

// robots.txt, sitemap.xml and the page metadata, as a search engine gets them. The API is replaced by a fixed catalog.
const base = { description: null, category: "brake", part: "Front Brake Disc", position: null, oemNumber: null, currencyCode: "USD", rating: null, reviewCount: 0, stockQuantity: 5, estimatedDeliveryDays: null, weightKg: null, status: "active", price: 10, images: [] };
const summary = (id: string): ProductSummary => ({ ...base, id, name: `Part ${id}` });
const detail: ProductDetail = { ...summary("p1"), name: "Front Brake Disc 300mm", oemNumber: "34116792217", brand: "BMW", model: "1 Series", year: 2017, fitsVehicleIds: [], images: ["/uploads/a.jpg"] };
const state = { products: [summary("p1"), summary("p2")], categories: [{ id: "brake", nameEn: "Brake System", nameAr: "نظام الفرامل", photoUrl: null, sortOrder: 1 }, { id: "filters", nameEn: "Filters", nameAr: "فلاتر", photoUrl: null, sortOrder: 2 }] };

vi.mock("@/lib/api", () => ({
  fetchProducts: vi.fn(async () => state.products),
  fetchCategories: vi.fn(async () => state.categories),
  fetchProductById: vi.fn(async (id: string) => (id === "p1" ? detail : null)),
  fetchProductReviews: vi.fn(async () => ({ averageRating: null, reviewCount: 0, reviews: [] })),
  resolveImageUrl: (u: string) => `https://api.example.com${u}`,
}));

beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com"); state.products = [summary("p1"), summary("p2")]; });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("robots.txt", () => {
  it("CRITICAL: crawlers may read the site except the private pages, and are pointed at the sitemap", async () => {
    const { default: robots } = await import("./robots");
    const { PRIVATE_PATHS } = await import("@/lib/seo");
    const r = robots() as { rules: { userAgent: string; allow: string; disallow: string[] }; sitemap: string };
    expect(r.rules).toEqual({ userAgent: "*", allow: "/", disallow: [...PRIVATE_PATHS] });
    expect(r.rules.disallow).toEqual(expect.arrayContaining(["/cart", "/checkout", "/login", "/orders", "/support"]));
    expect(r.rules.disallow).not.toContain("/products");
    expect(r.rules.disallow).not.toContain("/search");
    expect(r.sitemap).toBe("https://shop.example.com/sitemap.xml");
  });
});

describe("sitemap.xml", () => {
  it("CRITICAL: lists the home page, the catalog, every CATEGORY page that has products, and every product, with full addresses", async () => {
    const { default: sitemap } = await import("./sitemap");
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toEqual([
      "https://shop.example.com", "https://shop.example.com/search", "https://shop.example.com/search?category=brake",            // (Filters has no products in this catalog: not listed)
      "https://shop.example.com/products/p1", "https://shop.example.com/products/p2",
    ]);
  });
  it("CRITICAL: a category with NO products is left out (an empty landing page is thin content), a category with products is in", async () => {
    state.products = [{ ...summary("p1"), category: "filters" }];                  // only Filters has a product; Brake System has none
    const { default: sitemap } = await import("./sitemap");
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://shop.example.com/search?category=filters");
    expect(urls).not.toContain("https://shop.example.com/search?category=brake");
  });
  it("CRITICAL: no false 'modified now', no ignored hints: only addresses (products have no real updated date)", async () => {
    const { default: sitemap } = await import("./sitemap");
    for (const entry of await sitemap()) expect(Object.keys(entry)).toEqual(["url"]);
  });
  it("never lists a private page", async () => {
    const { default: sitemap } = await import("./sitemap");
    const { PRIVATE_PATHS } = await import("@/lib/seo");
    const urls = (await sitemap()).map((e) => new URL(e.url).pathname);
    for (const p of PRIVATE_PATHS) expect(urls.some((u) => u === p || u.startsWith(`${p}/`)), p).toBe(false);
  });
  it("stays within the 50,000 addresses Google reads from one file, warning loudly when products are left out", async () => {
    state.products = Array.from({ length: 50010 }, (_, i) => summary(`x${i}`));       // all in category "brake"
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { default: sitemap } = await import("./sitemap");
    const entries = await sitemap();
    expect(entries).toHaveLength(50000);
    expect(entries.slice(0, 4).map((e) => e.url)).toContain("https://shop.example.com/search?category=brake");       // (the generated products are in Brake System)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("left out"));
  });
});

describe("the product page", () => {
  it("CRITICAL: its title has the part number, its address is canonical, and it is indexable", async () => {
    const { generateMetadata } = await import("./products/[id]/page");
    const m = await generateMetadata({ params: Promise.resolve({ id: "p1" }) });
    expect(m.title).toBe("Front Brake Disc 300mm – OEM 34116792217 – BMW 1 Series 2017");
    expect(m.alternates?.canonical).toBe("/products/p1");
    expect(m.robots).toBeUndefined();                                                        // indexable
    expect(m.description).toContain("OEM 34116792217");
    expect(m.openGraph).toMatchObject({ url: "https://shop.example.com/products/p1", siteName: "Leap Auto Parts", images: ["https://api.example.com/uploads/a.jpg"] });
    expect(m.twitter).toMatchObject({ card: "summary_large_image" });
  });
  it("a product that does not exist is never indexed", async () => {
    const { generateMetadata } = await import("./products/[id]/page");
    const m = await generateMetadata({ params: Promise.resolve({ id: "nope" }) });
    expect(m.robots).toEqual({ index: false, follow: false });
  });
  it("CRITICAL: the page carries the Product and the breadcrumb as structured data, with the category named", async () => {
    const { default: ProductPage } = await import("./products/[id]/page");
    const { JsonLd } = await import("@/components/JsonLd");
    const tree = await ProductPage({ params: Promise.resolve({ id: "p1" }) });
    const found: unknown[] = [];
    const walk = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(walk);
      const el = node as { type?: unknown; props?: { data?: unknown; children?: unknown } };
      if (el.type === JsonLd) found.push(el.props?.data);
      walk(el.props?.children);
    };
    walk(tree);
    expect(found).toHaveLength(2);
    const [product, crumbs] = found as [{ "@type": string; mpn: string; offers: { price: string }; aggregateRating?: unknown; category: string }, { itemListElement: Array<{ name: string }> }];
    expect(product).toMatchObject({ "@type": "Product", mpn: "34116792217", category: "Brake System" });
    expect(product.offers.price).toBe("10.00");
    expect(product.aggregateRating).toBeUndefined();
    expect(crumbs.itemListElement.map((i) => i.name)).toEqual(["Home", "Brake System", "Front Brake Disc 300mm"]);
  });
});

describe("the search page", () => {
  it("CRITICAL: a category page is indexed with its own title; a typed query or a vehicle filter is kept out and points at the category page", async () => {
    const { generateMetadata } = await import("./search/page");
    const category = await generateMetadata({ searchParams: Promise.resolve({ category: "brake" }) });
    expect(category.title).toBe("Brake System parts");
    expect(category.robots).toEqual({ index: true, follow: true });
    expect(category.alternates?.canonical).toBe("/search?category=brake");
    const typed = await generateMetadata({ searchParams: Promise.resolve({ category: "brake", q: "disc" }) });
    expect(typed.robots).toEqual({ index: false, follow: true });
    expect(typed.alternates?.canonical).toBe("/search?category=brake");
    expect(typed.title).toBe('Search results for "disc"');
    const paged = await generateMetadata({ searchParams: Promise.resolve({ category: "brake", page: "3" }) });
    expect(paged.robots).toEqual({ index: false, follow: true });
    const all = await generateMetadata({ searchParams: Promise.resolve({}) });
    expect(all.title).toBe("Browse all parts");
    expect(all.alternates?.canonical).toBe("/search");
  });
});
