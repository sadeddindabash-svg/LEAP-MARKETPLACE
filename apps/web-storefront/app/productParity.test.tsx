import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProductDetail, ProductSummary } from "@/lib/api";
import type { ReactElement } from "react";

// The product page like the mobile app: the column beside the photos holds, in this order, the title, the chips, the stock box with the delivery date, the seller lines, the price block and the buttons; the description and the part
// number are in the specifications card, not in the column. The page is a Server Component, so its element tree is read directly.
vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-22T09:00:00Z"));
const m = vi.hoisted(() => ({ lang: { current: "en" as "en" | "ar" }, product: { current: null as unknown } }));
vi.mock("@/lib/lang", () => ({ getLang: vi.fn(async () => m.lang.current) }));
vi.mock("@/lib/api", () => ({
  fetchProductById: vi.fn(async () => m.product.current), fetchProductReviews: vi.fn(async () => ({ averageRating: null, reviewCount: 0, reviews: [] })),
  fetchCategories: vi.fn(async () => []), fetchOemAlternatives: vi.fn(async () => []), fetchAlternatives: vi.fn(async () => []), fetchSameBrand: vi.fn(async () => []), fetchProductsPaginated: vi.fn(async () => ({ items: [], total: 0 })),
  resolveImageUrl: (u: string) => `https://api.example.com${u}`,
}));
import StockBanner from "@/components/StockBanner";
import SellerSignals from "@/components/SellerSignals";
import PriceBlock from "@/components/PriceBlock";
import ProductDetails from "@/components/ProductDetails";
import NotifyWhenInStock from "@/components/NotifyWhenInStock";
import { AddToCartButton } from "@/components/AddToCartButton";

const summary = (id: string): ProductSummary => ({ id, name: `Part ${id}`, description: null, category: "brake", part: "Disc", position: null, oemNumber: null, currencyCode: "USD", rating: null, reviewCount: 0, stockQuantity: 5, estimatedDeliveryDays: 5, weightKg: null, status: "active", price: 10, images: [], brand: "BYD" });
const detail = (over: Partial<ProductDetail> = {}): ProductDetail => ({ ...summary("cur"), name: "Front Brake Disc", oemNumber: "34116792217", brand: "BYD", model: "Seal", year: 2024, fitsVehicleIds: ["g1", "g2"], images: ["/a.jpg", "/b.jpg"], ...over });
type El = ReactElement<{ children?: unknown; className?: string; [k: string]: unknown }>;
const kids = (el: El): El[] => ([] as unknown[]).concat(el.props.children as never).flat(Infinity as 1).filter((c) => c && typeof c === "object") as El[];
const find = (el: unknown, type: unknown): El | null => { if (!el || typeof el !== "object") return null; if (Array.isArray(el)) { for (const x of el) { const f = find(x, type); if (f) return f; } return null; } const e = el as El; if (e.type === type) return e; return find(e.props?.children, type); };
const textOf = (el: unknown): string => { if (el == null || typeof el === "boolean") return ""; if (typeof el === "string" || typeof el === "number") return String(el); if (Array.isArray(el)) return el.map(textOf).join(" "); const e = el as El; return typeof e.type === "function" ? "" : textOf(e.props?.children); };
async function page(over: Partial<ProductDetail> = {}, lang: "en" | "ar" = "en") { m.lang.current = lang; m.product.current = detail(over); const { default: ProductPage } = await import("./products/[id]/page"); return (await ProductPage({ params: Promise.resolve({ id: "cur" }) } as never)) as El; }
const columns = (root: El) => { const grid = (function f(el: El): El | null { if (typeof el.props.className === "string" && el.props.className.includes("md:grid-cols-2")) return el; for (const c of kids(el)) { const r = f(c); if (r) return r; } return null; })(root)!; const [left, right] = kids(grid); return { left, right }; };
beforeEach(() => { m.lang.current = "en"; });

describe("the column beside the photos, like the mobile app", () => {
  it("holds, in this order: title, chips, stock box, seller lines, price block, buttons", async () => {
    const { right } = columns(await page()); const types = kids(right).map((c) => (typeof c.type === "string" ? c.type : c.type)); expect(types).toEqual(["div", "div", StockBanner, SellerSignals, PriceBlock, "div"]);
    expect(find(kids(right)[5], AddToCartButton)).not.toBeNull();
  });
  it("the stock box gets the real stock and delivery estimate, the seller lines the real flags, the price block both prices", async () => {
    const root = await page({ stockQuantity: 3, estimatedDeliveryDays: 7, isVerifiedSeller: true, shipsFromCountry: "China", shipsFromCountryAr: "الصين", price: 10, originalPrice: 14 });
    const { right } = columns(root); const [, , stock, seller, price] = kids(right);
    expect(stock.props).toMatchObject({ stockQuantity: 3, estimatedDeliveryDays: 7, lang: "en" }); expect(seller.props).toMatchObject({ isVerifiedSeller: true, shipsFromCountry: "China", shipsFromCountryAr: "الصين", lang: "en" }); expect(price.props).toMatchObject({ price: 10, originalPrice: 14, lang: "en" });
  });
  it("Add to cart gets the price of one and the stock (for the total and the limit); out of stock still shows the notify button", async () => {
    const live = find(columns(await page({ stockQuantity: 24, price: 10 })).right, AddToCartButton)!; expect(live.props).toMatchObject({ inStock: true, unitPrice: 10, maxQuantity: 24 });
    const out = columns(await page({ stockQuantity: 0 })).right; expect(find(out, AddToCartButton)!.props).toMatchObject({ inStock: false, maxQuantity: 0 }); expect(find(out, NotifyWhenInStock)).not.toBeNull();
  });
  it("the description and the part number are NOT in the column any more (they are in the specifications card)", async () => {
    const root = await page({ description: "A UNIQUE DESCRIPTION", oemNumber: "34116792217" }); const { left, right } = columns(root);
    const columnText = textOf(right); expect(columnText).not.toContain("A UNIQUE DESCRIPTION"); expect(columnText).not.toContain("34116792217"); expect(columnText).not.toMatch(/OEM number/i);
    const card = find(left, ProductDetails)!; expect(card.props.product).toMatchObject({ description: "A UNIQUE DESCRIPTION", oemNumber: "34116792217" });
  });
  it("the old \"Estimated delivery in N days\" sentence is gone from the column", async () => { const { right } = columns(await page({ estimatedDeliveryDays: 7 })); expect(textOf(right)).not.toMatch(/Estimated delivery|in 7 days/); });
  it("the same in Arabic (the components get the language)", async () => { const { right } = columns(await page({ isVerifiedSeller: true }, "ar")); const [, , stock, seller, price] = kids(right); for (const c of [stock, seller, price]) expect(c.props.lang).toBe("ar"); });
});
