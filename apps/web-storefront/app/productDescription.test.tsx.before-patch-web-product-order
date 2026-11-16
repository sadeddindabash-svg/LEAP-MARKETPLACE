import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProductDetail, ProductSummary } from "@/lib/api";
import type { ReactElement } from "react";

// The description of a part is shown under the name and the part chips in the column beside the photos, and stays in the specifications card too. The page is a Server Component, so its element tree is read directly.
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

const SUMMARY = (right: El) => kids(right).find((c) => c.type === "p" && c.props["data-testid"] === "product-summary") ?? null;
const DESC = "Ceramic front brake pads with low dust and quiet braking. Direct replacement for the original part, supplied with new wear sensors.";
describe("the description under the name", () => {
  it("comes right after the title and the chips and before the stock box, the seller lines, the price block and the buttons", async () => {
    const { right } = columns(await page({ description: DESC })); const types = kids(right).map((c) => c.type); expect(types).toEqual(["div", "div", "p", StockBanner, SellerSignals, PriceBlock, "div"]);
    expect(SUMMARY(right)).not.toBeNull();
  });
  it("is the part's description (trimmed), as plain text", async () => { const { right } = columns(await page({ description: `   ${DESC}\n  ` })); expect(textOf(SUMMARY(right))).toBe(DESC); });
  it("is 16 px with comfortable line spacing, in the page's text colour at 80%, 14 px below the chips", async () => {
    const c = (SUMMARY(columns(await page({ description: DESC })).right)!.props.className as string).split(" "); for (const k of ["text-base", "leading-relaxed", "text-ink/80", "mt-3.5"]) expect(c, k).toContain(k);
  });
  it("keeps the supplier's line breaks and never lets a very long word push the column wider", async () => { const c = (SUMMARY(columns(await page({ description: DESC })).right)!.props.className as string).split(" "); expect(c).toContain("whitespace-pre-line"); expect(c).toContain("[overflow-wrap:anywhere]"); });
  it("has no direction of its own, so it follows the page: left to right in English and right to left in Arabic", async () => { for (const lang of ["en", "ar"] as const) { const p = SUMMARY(columns(await page({ description: DESC }, lang)).right)!; expect(p.props.dir).toBeUndefined(); } });
  it("in Arabic it is the description the server sent (already in Arabic), unchanged", async () => { const ar = "فحمات فرامل أمامية من السيراميك قليلة الغبار وهادئة أثناء الكبح."; expect(textOf(SUMMARY(columns(await page({ description: ar }, "ar")).right))).toBe(ar); });
});
describe("a part with no description", () => {
  it("shows nothing under the name (null, empty, or only spaces and line breaks), and the column is as it was", async () => {
    for (const d of [null, "", "   ", "\n \n"]) { const { right } = columns(await page({ description: d as never })); expect(SUMMARY(right)).toBeNull(); expect(kids(right).map((c) => c.type)).toEqual(["div", "div", StockBanner, SellerSignals, PriceBlock, "div"]); }
  });
});
describe("the specifications card keeps the description too", () => {
  it("the card still gets the part with its description (so its Description row is drawn there as before)", async () => { const { left } = columns(await page({ description: DESC })); expect(find(left, ProductDetails)!.props.product).toMatchObject({ description: DESC }); });
  it("and it really draws it: the same text is in the card and under the name (twice on the page, on purpose)", async () => {
    const { render, screen } = await import("@testing-library/react"); const { LangProvider } = await import("@/components/LangProvider"); const Details = (await import("@/components/ProductDetails")).default;
    render(<LangProvider lang="en"><Details product={detail({ description: DESC })} lang="en" /></LangProvider>); expect(screen.getByText(DESC)).toBeInTheDocument(); expect(screen.getByText("Description")).toBeInTheDocument();
  });
  it("a part with no description keeps its \"Not specified\" row in the card, as before", async () => {
    const { render, screen } = await import("@testing-library/react"); const { LangProvider } = await import("@/components/LangProvider"); const Details = (await import("@/components/ProductDetails")).default;
    render(<LangProvider lang="en"><Details product={detail({ description: null })} lang="en" /></LangProvider>); const dt = screen.getByText("Description"); expect(dt.parentElement!.textContent).toContain("Not specified");
  });
});
