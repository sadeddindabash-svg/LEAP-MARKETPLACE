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
import LazyProductRow from "@/components/LazyProductRow";
import ProductDetails from "@/components/ProductDetails";
import ProductGallery from "@/components/ProductGallery";
import NotifyWhenInStock from "@/components/NotifyWhenInStock";
import ShareButton from "@/components/ShareButton";

const summary = (id: string): ProductSummary => ({ id, name: `Part ${id}`, description: null, category: "brake", part: "Disc", position: null, oemNumber: null, currencyCode: "USD", rating: null, reviewCount: 0, stockQuantity: 5, estimatedDeliveryDays: 5, weightKg: null, status: "active", price: 10, images: [], brand: "BYD" });
const detail = (over: Partial<ProductDetail> = {}): ProductDetail => ({ ...summary("cur"), name: "Front Brake Disc", oemNumber: "34116792217", brand: "BYD", model: "Seal", year: 2024, fitsVehicleIds: ["g1", "g2"], images: ["/a.jpg", "/b.jpg"], ...over });

type El = { type: unknown; props: Record<string, unknown> };
async function render(lang: "en" | "ar" = "en") {
  m.lang.current = lang;
  const { default: ProductPage } = await import("./products/[id]/page");
  const found: El[] = [];
  const watched = [OemComparison, ReviewsSection, CustomerPhotos, LazyProductRow, ProductGallery, ProductDetails, NotifyWhenInStock, ShareButton];
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
  const ROW = ["ProductDetails", "OemComparison", "ReviewsSection", "CustomerPhotos", "LazyProductRow", "LazyProductRow", "LazyProductRow"];
  const content = (els: El[]) => els.filter((e) => !["ProductGallery", "NotifyWhenInStock", "ShareButton"].includes((e.type as { name: string }).name));

  it("CRITICAL: the sections come in this order: the details under the photos, other listings, reviews, customer photos, more parts of the same model, of the same brand, the newest", async () => {
    expect(names(content(await render()))).toEqual(ROW);
  });

  it("the gallery gets every photo with the real address, and the share button the part's name", async () => {
    const found = await render();
    expect(found.find((e) => e.type === ProductGallery)?.props).toMatchObject({ images: ["https://api.example.com/a.jpg", "https://api.example.com/b.jpg"], alt: "Front Brake Disc" });
    expect(found.find((e) => e.type === ShareButton)?.props.title).toBe("Front Brake Disc");
  });

  it("the details block is given the part and the language", async () => {
    const found = await render("ar");
    expect(found.find((e) => e.type === ProductDetails)?.props).toMatchObject({ lang: "ar" });
    expect((found.find((e) => e.type === ProductDetails)?.props.product as { id: string }).id).toBe("cur");
  });

  it("the 'This part fits ... Your car ...' note is NOT on the product page any more (it stays in the cart)", async () => {
    const { default: ProductPage } = await import("./products/[id]/page");
    const text = JSON.stringify(await ProductPage({ params: Promise.resolve({ id: "cur" }) }), (k, v) => (typeof v === "function" ? (v as { name?: string }).name : v));
    expect(text).not.toContain("FitCheck");
  });

  it("CRITICAL: 'Notify me when back in stock' appears only on a part that is sold out", async () => {
    expect((await render()).some((e) => e.type === NotifyWhenInStock)).toBe(false);
    m.product.current = detail({ stockQuantity: 0 });
    expect((await render()).find((e) => e.type === NotifyWhenInStock)?.props.productId).toBe("cur");
  });

  it("CRITICAL: the three rows ask for the right lists: the model row and the brand row stop after two more batches of 8; the newest row never stops and hides this part", async () => {
    const rows = (await render()).filter((e) => e.type === LazyProductRow).map((e) => e.props);
    expect(rows[0]).toMatchObject({ id: "model-h", title: "More parts for BYD Seal", source: { kind: "sameModel", productId: "cur" }, pageSize: 8, maxExtraPages: 2 });
    expect(rows[1]).toMatchObject({ id: "brand-h", title: "More BYD parts", source: { kind: "sameBrand", productId: "cur" }, pageSize: 8, maxExtraPages: 2 });
    expect(rows[2]).toMatchObject({ id: "newest-h", title: "Newest products", source: { kind: "newest" }, pageSize: 8, hiddenId: "cur" });
    expect(rows[2].maxExtraPages).toBeUndefined();
  });

  it("the page does not fetch the three lists itself (each row asks when it is scrolled to), so it opens faster", async () => {
    await render(); const api = await import("@/lib/api");
    expect(vi.mocked(api.fetchSameBrand)).not.toHaveBeenCalled(); expect(vi.mocked(api.fetchAlternatives)).not.toHaveBeenCalled(); expect(vi.mocked(api.fetchProductsPaginated)).not.toHaveBeenCalled();
  });

  it("a part that fits any car (no brand, no model) has no model row and no brand row, but still has the newest row", async () => {
    m.product.current = detail({ brand: null, model: null, year: null });
    expect(names(content(await render()))).toEqual(["ProductDetails", "OemComparison", "ReviewsSection", "CustomerPhotos", "LazyProductRow"]);
  });

  it("CRITICAL: in Arabic the row titles are the app's Arabic", async () => {
    const rows = (await render("ar")).filter((e) => e.type === LazyProductRow).map((e) => e.props);
    expect(rows[0].title).toBe("المزيد من القطع لـ BYD Seal"); expect(rows[1].title).toBe("المزيد من قطع BYD"); expect(rows[2].title).toBe("أحدث المنتجات");
  });

  it("the other listings and the reviews still get their data", async () => {
    const found = await render();
    expect(found.find((e) => e.type === OemComparison)?.props.products).toHaveLength(1);
    expect((found.find((e) => e.type === ReviewsSection)?.props.summary as { reviewCount: number }).reviewCount).toBe(1);
  });
});
