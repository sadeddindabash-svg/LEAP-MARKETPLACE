import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ProductDetail, ProductSummary } from "@/lib/api";

// The product page's structure: which sections it has, in which order, with what, in each language. The page is a Server Component, so its element tree is read directly.
const m = vi.hoisted(() => ({
  lang: { current: "en" as "en" | "ar" },
  product: { current: null as unknown },
  oem: { current: [] as unknown[] },
  alternatives: { current: [] as unknown[] },
  sameBrand: { current: [] as unknown[] },
  newest: { current: [] as unknown[] },
  reviews: { current: { averageRating: null, reviewCount: 0, reviews: [] } as unknown },
}));
vi.mock("@/lib/lang", () => ({ getLang: vi.fn(async () => m.lang.current) }));
vi.mock("@/lib/api", () => ({
  fetchProductById: vi.fn(async () => m.product.current),
  fetchProductReviews: vi.fn(async () => m.reviews.current),
  fetchCategories: vi.fn(async () => [{ id: "brake", nameEn: "Brake System", nameAr: "نظام الفرامل", photoUrl: null, sortOrder: 1, commissionPercent: 10 }]),
  fetchOemAlternatives: vi.fn(async () => m.oem.current),
  fetchAlternatives: vi.fn(async () => m.alternatives.current),
  fetchSameBrand: vi.fn(async () => m.sameBrand.current),
  fetchProductsPaginated: vi.fn(async () => ({ items: m.newest.current, total: 99 })),
  resolveImageUrl: (u: string) => `https://api.example.com${u}`,
}));

import OemComparison from "@/components/OemComparison";
import ReviewsSection from "@/components/ReviewsSection";
import CustomerPhotos from "@/components/CustomerPhotos";
import ProductSection from "@/components/ProductSection";
import LoadMoreGrid from "@/components/LoadMoreGrid";
import ProductGallery from "@/components/ProductGallery";
import FitCheck from "@/components/FitCheck";
import NotifyWhenInStock from "@/components/NotifyWhenInStock";
import ShareButton from "@/components/ShareButton";

const summary = (id: string): ProductSummary => ({ id, name: `Part ${id}`, description: null, category: "brake", part: "Disc", position: null, oemNumber: null, currencyCode: "USD", rating: null, reviewCount: 0, stockQuantity: 5, estimatedDeliveryDays: 5, weightKg: null, status: "active", price: 10, images: [], brand: "BYD" });
const detail = (over: Partial<ProductDetail> = {}): ProductDetail => ({ ...summary("cur"), name: "Front Brake Disc", oemNumber: "34116792217", brand: "BYD", model: "Seal", year: 2024, fitsVehicleIds: ["g1", "g2"], images: ["/a.jpg", "/b.jpg"], ...over });

type El = { type: unknown; props: Record<string, unknown> };
async function render(lang: "en" | "ar" = "en") {
  m.lang.current = lang;
  const { default: ProductPage } = await import("./products/[id]/page");
  const found: El[] = [];
  const watched = [OemComparison, ReviewsSection, CustomerPhotos, ProductSection, LoadMoreGrid, ProductGallery, FitCheck, NotifyWhenInStock, ShareButton];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    const el = node as El;
    if (watched.includes(el.type as never)) found.push(el);
    walk(el.props?.children);
  };
  walk(await ProductPage({ params: Promise.resolve({ id: "cur" }) }));
  return found;
}
const names = (els: El[]) => els.map((e) => (e.type as { name: string }).name);

beforeEach(() => {
  m.product.current = detail();
  m.oem.current = [summary("o1")];
  m.alternatives.current = [summary("a1"), summary("a2")];
  m.sameBrand.current = Array.from({ length: 10 }, (_, i) => summary(`s${i}`));
  m.newest.current = [...Array.from({ length: 9 }, (_, i) => summary(`n${i}`)), summary("cur")];
  m.reviews.current = { averageRating: 5, reviewCount: 1, reviews: [{ id: 1, buyerName: "B", rating: 5, comment: null, createdAt: "2026-01-01", photos: ["/p.jpg"], isVerifiedPurchase: true }] };
});

describe("the full product page", () => {
  it("CRITICAL: the sections come in the mobile app's order: other listings, reviews, customer photos, similar parts, more of the brand, newest", async () => {
    const found = await render();
    expect(names(found.filter((e) => !["ProductGallery", "FitCheck", "NotifyWhenInStock", "ShareButton"].includes((e.type as { name: string }).name)))).toEqual(
      ["OemComparison", "ReviewsSection", "CustomerPhotos", "ProductSection", "LoadMoreGrid", "LoadMoreGrid"]);
  });

  it("the gallery gets every photo with the real address, the share button the part's name, and the fit badge the part's fit list", async () => {
    const found = await render();
    expect(found.find((e) => e.type === ProductGallery)?.props).toMatchObject({ images: ["https://api.example.com/a.jpg", "https://api.example.com/b.jpg"], alt: "Front Brake Disc" });
    expect(found.find((e) => e.type === ShareButton)?.props.title).toBe("Front Brake Disc");
    expect(found.find((e) => e.type === FitCheck)?.props.fitsVehicleIds).toEqual(["g1", "g2"]);
  });

  it("the fit message gets the cars the part fits, how many, and a key of each, so it can tell whether the buyer's own car is one of them", async () => {
    m.product.current = detail({ fitCars: [{ generationId: "g1", year: 2024, brand: "BYD", model: "Seal" }], fitCarCount: 7, fitKeys: ["g1|2024", "g2|2023"] });
    const found = await render();
    expect(found.find((e) => e.type === FitCheck)?.props).toMatchObject({ fitCarCount: 7, fitKeys: ["g1|2024", "g2|2023"], fitCars: [{ generationId: "g1", year: 2024, brand: "BYD", model: "Seal" }] });
  });

  it("CRITICAL: 'Notify me when back in stock' appears only on a part that is sold out", async () => {
    expect((await render()).some((e) => e.type === NotifyWhenInStock)).toBe(false);
    m.product.current = detail({ stockQuantity: 0 });
    const found = await render();
    expect(found.find((e) => e.type === NotifyWhenInStock)?.props.productId).toBe("cur");
  });

  it("CRITICAL: the sections are fed from the right sources: the brand grid is named by the brand the server sent and pages the same part; the newest grid is given the FULL first page and told which part to hide", async () => {
    const found = await render();
    const grids = found.filter((e) => e.type === LoadMoreGrid);
    expect(grids[0].props).toMatchObject({ title: "More BYD parts", source: { kind: "sameBrand", productId: "cur" } });
    expect((grids[0].props.initial as unknown[]).length).toBe(10);
    expect(grids[1].props).toMatchObject({ title: "Newest products", source: { kind: "newest", excludeId: "cur" } });
    expect((grids[1].props.initial as unknown[]).length).toBe(10);                      // the page as the server sent it, not shortened
    expect(found.find((e) => e.type === ProductSection)?.props).toMatchObject({ title: "Similar products" });
    expect(found.find((e) => e.type === OemComparison)?.props.products).toHaveLength(1);
    expect((found.find((e) => e.type === ReviewsSection)?.props.summary as { reviewCount: number }).reviewCount).toBe(1);
  });

  it("with no brand grid results the title falls back to the part's own brand", async () => {
    m.sameBrand.current = [];
    const grid = (await render()).filter((e) => e.type === LoadMoreGrid)[0];
    expect(grid.props.title).toBe("More BYD parts");
  });

  it("CRITICAL: in Arabic the section titles are the app's Arabic", async () => {
    const grids = (await render("ar")).filter((e) => e.type === LoadMoreGrid);
    expect(grids[0].props.title).toBe("المزيد من قطع BYD");
    expect(grids[1].props.title).toBe("أحدث المنتجات");
    const found = await render("ar");
    expect(found.find((e) => e.type === ProductSection)?.props.title).toBe("منتجات مماثلة");
  });
});
