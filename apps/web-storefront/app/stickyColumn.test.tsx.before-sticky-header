import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProductDetail, ProductSummary } from "@/lib/api";
import type { ReactElement } from "react";

// The product page on a computer: the column beside the photos (title, price, Add to cart) is pinned while the photos and the details card are scrolled, and is released where they end. The page is a Server Component,
// so its element tree is read directly.
const m = vi.hoisted(() => ({ lang: { current: "en" as "en" | "ar" }, product: { current: null as unknown } }));
vi.mock("@/lib/lang", () => ({ getLang: vi.fn(async () => m.lang.current) }));
vi.mock("@/lib/api", () => ({
  fetchProductById: vi.fn(async () => m.product.current), fetchProductReviews: vi.fn(async () => ({ averageRating: null, reviewCount: 0, reviews: [] })),
  fetchCategories: vi.fn(async () => []), fetchOemAlternatives: vi.fn(async () => []), fetchAlternatives: vi.fn(async () => []), fetchSameBrand: vi.fn(async () => []), fetchProductsPaginated: vi.fn(async () => ({ items: [], total: 0 })),
  resolveImageUrl: (u: string) => `https://api.example.com${u}`,
}));
import ProductGallery from "@/components/ProductGallery";
import OemComparison from "@/components/OemComparison";
import ReviewsSection from "@/components/ReviewsSection";
import { AddToCartButton } from "@/components/AddToCartButton";

const summary = (id: string): ProductSummary => ({ id, name: `Part ${id}`, description: null, category: "brake", part: "Disc", position: null, oemNumber: null, currencyCode: "USD", rating: null, reviewCount: 0, stockQuantity: 5, estimatedDeliveryDays: 5, weightKg: null, status: "active", price: 10, images: [], brand: "BYD" });
const detail = (over: Partial<ProductDetail> = {}): ProductDetail => ({ ...summary("cur"), name: "Front Brake Disc", oemNumber: "34116792217", brand: "BYD", model: "Seal", year: 2024, fitsVehicleIds: ["g1", "g2"], images: ["/a.jpg", "/b.jpg"], ...over });
type El = ReactElement<{ children?: unknown; className?: string; [k: string]: unknown }>;
const kids = (el: El): El[] => ([] as unknown[]).concat(el.props.children as never).flat(Infinity as 1).filter((c) => c && typeof c === "object") as El[];
const contains = (el: unknown, type: unknown): boolean => { if (!el || typeof el !== "object") return false; if (Array.isArray(el)) return el.some((x) => contains(x, type)); const e = el as El; return e.type === type || contains(e.props?.children, type); };
async function page(lang: "en" | "ar" = "en") { m.lang.current = lang; m.product.current = detail(); const { default: ProductPage } = await import("./products/[id]/page"); return (await ProductPage({ params: Promise.resolve({ id: "cur" }) } as never)) as El; }
const grid = (root: El) => { const find = (el: El): El | null => { if (typeof el.props.className === "string" && el.props.className.includes("md:grid-cols-2")) return el; for (const c of kids(el)) { const f = find(c); if (f) return f; } return null; }; return find(root); };
beforeEach(() => { m.lang.current = "en"; });

describe("the column beside the photos (computer screens)", () => {
  it("is pinned below the top of the screen, starts at the top of its row, and is the one that holds the title, the price and Add to cart", async () => {
    const g = grid(await page()); expect(g).not.toBeNull(); const [left, right] = kids(g!); const cls = String(right.props.className);
    for (const c of ["md:sticky", "md:top-4", "md:self-start"]) expect(cls.split(" "), c).toContain(c); expect(contains(right, AddToCartButton)).toBe(true); expect(contains(right.props.children, "h1")).toBe(true);
    expect(contains(left, ProductGallery)).toBe(true); expect(contains(left, AddToCartButton)).toBe(false);
  });
  it("the photos side is NOT pinned (it is the one that scrolls past)", async () => { const g = grid(await page()); const [left] = kids(g!); expect(String(left.props.className ?? "")).not.toMatch(/sticky/); });
  it("a very tall column gets its own small scroll instead of hiding the buttons, and keeps a little room for it", async () => {
    const cls = String(kids(grid(await page())!)[1].props.className).split(" "); expect(cls).toContain("md:max-h-[calc(100vh-2rem)]"); expect(cls).toContain("md:overflow-y-auto"); expect(cls).toContain("md:pe-1");
  });
  it("is pinned only from the medium screen up: on a phone (one column) none of it applies", async () => {
    const cls = String(kids(grid(await page())!)[1].props.className).split(" ").filter((c) => /sticky|top-4|self-start|max-h|overflow/.test(c)); expect(cls.length).toBeGreaterThan(0); for (const c of cls) expect(c.startsWith("md:"), c).toBe(true);
  });
  it("is released where the photos and details end: the sections below (other listings, reviews) are NOT inside the two columns, so they are never covered", async () => {
    const root = await page(); const g = grid(root)!; expect(contains(g, OemComparison)).toBe(false); expect(contains(g, ReviewsSection)).toBe(false); expect(contains(root, ReviewsSection)).toBe(true); expect(contains(root, OemComparison)).toBe(true);
  });
  it("the same in Arabic (the columns swap sides by themselves)", async () => { const g = grid(await page("ar")); expect(String(kids(g!)[1].props.className)).toContain("md:sticky"); });
});
