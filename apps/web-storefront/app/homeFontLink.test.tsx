import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// The home page and its fonts: the fonts are linked, not built into the site, and nothing but the layout asks Google for a font while the site is built (that is what stopped the storefront from starting).
const m = vi.hoisted(() => ({ text: { current: null as unknown } }));
vi.mock("@/lib/lang", () => ({ getLang: vi.fn(async () => "en") }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/api", () => ({
  fetchCategories: vi.fn(async () => []), fetchVehicleBrands: vi.fn(async () => []), fetchAnnouncements: vi.fn(async () => []), fetchProducts: vi.fn(async () => []), fetchSiteStats: vi.fn(async () => null), fetchHomePictures: vi.fn(async () => null),
  fetchHomeText: vi.fn(async () => m.text.current), fetchModelsForBrand: vi.fn(async () => []), fetchGenerationsForModel: vi.fn(async () => []), resolveImageUrl: (u: string) => u,
}));
vi.mock("@/components/HeroPicker", () => ({ default: () => <div /> }));
import { LangProvider } from "@/components/LangProvider";

const block = (over = {}) => ({ en: null, ar: null, font: "default", size: "large", ...over });
const text = (over: Record<string, unknown> = {}) => ({ topBar: { en: null, ar: null }, headline: block(), subheadline: block({ size: "medium" }), ...over });
async function show() { const { default: HomePage } = await import("./page"); return render(<LangProvider lang="en">{await HomePage()}</LangProvider>); }
beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com"); m.text.current = null; });

describe("the home page links to the fonts it uses", () => {
  it("the admin's two fonts: one link to Google Fonts for both, and the headline and sub-headline use them", async () => {
    m.text.current = text({ headline: block({ font: "poppins" }), subheadline: block({ font: "cairo", size: "medium" }) }); const { container } = await show();
    expect(container.querySelector('link[rel="stylesheet"]')?.getAttribute("href")).toBe("https://fonts.googleapis.com/css2?family=Poppins:wght@500;700&family=Cairo:wght@500;700&display=swap");
    const h1 = container.querySelector("h1") as HTMLElement; expect(h1.style.fontFamily).toContain("Poppins"); expect((h1.nextElementSibling as HTMLElement).style.fontFamily).toContain("Cairo");
  });
  it("nothing chosen (or the shop cannot be reached): no font link at all, exactly as before", async () => {
    m.text.current = null; expect((await show()).container.querySelector('link[rel="stylesheet"]')).toBeNull();
  });
});
describe("no font is downloaded while the site is built (that step stopped the storefront from starting)", () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return n === "node_modules" || n === ".next" ? [] : statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) ? [p] : []; });
  it("CRITICAL: no file uses next/font at all (the home page fonts and the website's own fonts are linked instead)", () => {
    const root = join(__dirname, ".."); const users = [...walk(join(root, "app")), ...walk(join(root, "components")), ...walk(join(root, "lib"))].filter((f) => /next\/font/.test(readFileSync(f, "utf8"))).map((f) => f.slice(root.length + 1).replace(/\\/g, "/"));
    expect(users).toEqual([]);
  });
});
