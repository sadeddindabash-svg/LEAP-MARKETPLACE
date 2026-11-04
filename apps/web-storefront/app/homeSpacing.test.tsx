import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

// The space between the blocks of the home page: the hero (banner or headline), the four totals, Shop by section, Shop by brand and Newest parts. Each block starts 20 px
// (pt-5) below the one before it: the same space as between the product cards (gap-5).
vi.mock("@/lib/lang", () => ({ getLang: vi.fn(async () => "en") }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/homeFonts", () => ({ homeFontStyle: () => undefined }));
vi.mock("@/lib/api", () => ({
  fetchCategories: vi.fn(async () => [{ id: "brake", nameEn: "Brake System", nameAr: "نظام الفرامل", photoUrl: null, sortOrder: 1, commissionPercent: 10 }]),
  fetchVehicleBrands: vi.fn(async () => [{ id: "b1", name: "BYD", nameAr: "بي واي دي", photoUrl: null }]), fetchAnnouncements: vi.fn(async () => []),
  fetchProducts: vi.fn(async () => [{ id: "p1", name: "Brake pad" }]), fetchSiteStats: vi.fn(async () => ({ parts: 27, brands: 24, models: 173, countries: 39 })), fetchHomePictures: vi.fn(async () => null), fetchHomeText: vi.fn(async () => null),
  fetchModelsForBrand: vi.fn(async () => []), fetchGenerationsForModel: vi.fn(async () => []), resolveImageUrl: (u: string) => u,
}));
vi.mock("@/components/HeroPicker", () => ({ default: () => <div /> }));
vi.mock("@/components/InfiniteProductGrid", () => ({ default: () => <div /> }));
import { LangProvider } from "@/components/LangProvider";

beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com"); });
async function blocks() {
  const { default: HomePage } = await import("./page");
  const { container } = render(<LangProvider lang="en">{await HomePage()}</LangProvider>);
  const by = (sel: string) => container.querySelector(sel) as HTMLElement;
  return { hero: by("section[aria-labelledby=home-h1]"), totals: by('section[aria-label="Leap Auto Parts"]'), sections: by("section[aria-labelledby=home-sections]"), brands: by("section[aria-labelledby=home-brands]"), newest: by("section[aria-labelledby=home-newest]") };
}
const cls = (el: HTMLElement) => el.className.split(" ");

describe("the space between the blocks of the home page", () => {
  it("CRITICAL: every block starts 20 px (pt-5) below the one above it, the same as the gap between the product cards", async () => {
    const b = await blocks();
    for (const [name, el] of Object.entries({ hero: b.hero, totals: b.totals, sections: b.sections, brands: b.brands, newest: b.newest })) {
      expect(cls(el), name).toContain("pt-5");
      expect(cls(el).some((c) => /^pt-(?!5$)/.test(c)), name).toBe(false);
    }
  });
  it("nothing else adds space between the blocks (no margin, and no space below any block but the last)", async () => {
    const b = await blocks();
    for (const el of [b.hero, b.totals, b.sections, b.brands]) expect(cls(el).some((c) => /^(mt|mb|my|pb)-/.test(c)), el.className).toBe(false);
    expect(cls(b.newest).some((c) => /^(mt|mb|my)-/.test(c))).toBe(false);
  });
});
