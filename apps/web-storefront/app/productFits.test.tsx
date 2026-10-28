import ProductChips from "@/components/ProductChips";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProductDetail, ProductSummary } from "@/lib/api";
import type { ReactElement } from "react";

// The chip at the top of a product page says what the part fits: the first model with its years and how many more models, "fits all vehicles" for a part with no fitment, and the single car from an older server. The page is a Server Component, so its element tree is read directly.
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

const chipsEl = async (over: Record<string, unknown> = {}, lang: "en" | "ar" = "en") => { const { right } = columns(await page(over as never, lang)); const el = kids(kids(right)[1]).find((c) => c.type === ProductChips); return el as { props: { product: Record<string, unknown>; lang: string } } | undefined; };
const grp = (model: string, ranges: Array<[number, number]>, extra: Record<string, unknown> = {}) => ({ brand: "BYD", model, ranges, vehicleCount: 1, ...extra });

// The wording of the chips is tested where it is drawn (components/ProductChips.test.tsx); here: the page hands the chips area the product and the language.
describe("the chips under the name", () => {
  it("the chips area is the ProductChips component, given the whole product (with what it fits) and the page language", async () => {
    const el = await chipsEl({ fitGroups: [grp("Seal", [[2022, 2024]]), grp("Dolphin", [[2023, 2023]])], fitGroupCount: 2, partPhotoUrl: "/uploads/part.png" });
    expect(el).toBeDefined(); expect(el!.props.lang).toBe("en"); expect((el!.props.product.fitGroups as unknown[]).length).toBe(2); expect(el!.props.product.partPhotoUrl).toBe("/uploads/part.png");
  });
  it("on the Arabic page the language is Arabic", async () => { const el = await chipsEl({ fitGroups: [grp("Seal", [[2022, 2024]])] }, "ar"); expect(el!.props.lang).toBe("ar"); });
  it("a product from an older server (no groups, no part photo) is passed as it is", async () => { const el = await chipsEl({ brand: "BYD", model: "Seal", year: 2022, fitGroups: undefined }); expect(el!.props.product.fitGroups).toBeUndefined(); expect(el!.props.product.brand).toBe("BYD"); });
  it("the chip is in the same place as before: second in the column (after the title), before the description and the stock box", async () => { const { right } = columns(await page({ fitGroups: [grp("Seal", [[2022, 2024]])], fitGroupCount: 1, description: "x" } as never)); expect(kids(right).map((c) => c.type).slice(0, 3)).toEqual(["div", "div", "p"]); });
});
