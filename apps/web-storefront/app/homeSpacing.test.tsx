import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

// The space between the blocks of the home page: the four totals, Shop by section, Shop by brand and Newest parts. Each block starts 32 px (pt-8) below the one before it (it was 64 px).
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
  return { totals: by('section[aria-label="Leap Auto Parts"]'), sections: by("section[aria-labelledby=home-sections]"), brands: by("section[aria-labelledby=home-brands]"), newest: by("section[aria-labelledby=home-newest]") };
}
const cls = (el: HTMLElement) => el.className.split(" ");

describe("the space between the blocks of the home page", () => {
  it("Shop by section, Shop by brand and Newest parts each start 32 px (pt-8) below the block above them, not 64 px", async () => {
    const b = await blocks();
    for (const [name, el] of Object.entries({ sections: b.sections, brands: b.brands, newest: b.newest })) { expect(cls(el), name).toContain("pt-8"); expect(cls(el), name).not.toContain("pt-16"); }
  });
  it("the totals keep their own space above (it is the space under the hero, which was not changed)", async () => {
    expect(cls((await blocks()).totals)).toContain("pt-10");
  });
  it("nothing else adds space between the blocks (no margin below or above any of them)", async () => {
    const b = await blocks(); for (const el of [b.totals, b.sections, b.brands, b.newest]) expect(cls(el).some((c) => /^(mt|mb|my|pb-(?!4$))/.test(c)), el.className).toBe(false);
  });
});
