import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// The home page's tiles as decided: the four totals as gold tiles (92 px), the sections as wide tiles with an angled photo (4 per row), the brands as round photos (6 per row, 3 on a phone). The server's answers are replaced by fixed values.
const m = vi.hoisted(() => ({ cats: { current: [] as unknown[] }, brands: { current: [] as unknown[] }, pictures: { current: null as unknown } }));
vi.mock("@/lib/lang", () => ({ getLang: vi.fn(async () => "en") }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/image", () => ({ default: (p: { src: string; alt: string; className?: string }) => <img src={p.src} alt={p.alt} className={p.className} /> }));
vi.mock("@/lib/api", () => ({
  fetchCategories: vi.fn(async () => m.cats.current), fetchVehicleBrands: vi.fn(async () => m.brands.current), fetchAnnouncements: vi.fn(async () => []), fetchProducts: vi.fn(async () => []),
  fetchSiteStats: vi.fn(async () => ({ parts: 1284, brands: 48, models: 312, countries: 39 })), fetchHomePictures: vi.fn(async () => m.pictures.current), fetchHomeText: vi.fn(async () => null), fetchHomeBanner: vi.fn(async () => null),
  fetchModelsForBrand: vi.fn(async () => []), fetchGenerationsForModel: vi.fn(async () => []), resolveImageUrl: (u: string) => `https://api.example.com${u}`,
}));
vi.mock("@/lib/homeFonts", () => ({ homeFontStyle: () => undefined }));
vi.mock("@/components/HeroPicker", () => ({ default: () => <div /> }));
import { LangProvider } from "@/components/LangProvider";

const cat = (i: number, photo: string | null = null) => ({ id: `c${i}`, nameEn: `Section ${i}`, nameAr: `قسم ${i}`, photoUrl: photo, sortOrder: i, commissionPercent: 10 });
const brand = (i: number, photo: string | null = null) => ({ id: `b${i}`, name: `Brand ${i}`, nameAr: `ماركة ${i}`, photoUrl: photo });
async function show(lang: "en" | "ar" = "en") { vi.mocked((await import("@/lib/lang")).getLang).mockResolvedValue(lang); const { default: HomePage } = await import("./page"); return render(<LangProvider lang={lang}>{await HomePage()}</LangProvider>); }
beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com"); m.cats.current = []; m.brands.current = []; m.pictures.current = { parts: null, brands: null, models: null, countries: null }; });

describe("the four totals", () => {
  it("are four GOLD tiles (92 px high) with the real numbers and labels, in a grid of 2 on a phone and 4 on a computer", async () => {
    await show(); const tiles = screen.getAllByTestId("stat-tile"); expect(tiles).toHaveLength(4); expect(tiles.map((t) => t.textContent)).toEqual(["1,284Parts", "48Brands", "312Models", "39Countries"]); for (const t of tiles) { expect(t.className).toContain("h-[92px]"); expect(t.className).toContain("from-[#ffc83d]"); }
    const ul = tiles[0].parentElement!; expect(ul.className).toContain("grid-cols-2"); expect(ul.className).toContain("lg:grid-cols-4");
  });
  it("each tile has its own faint icon, and a picture the admin chose fills that tile instead", async () => { m.pictures.current = { parts: "/uploads/p.jpg", brands: null, models: null, countries: null }; await show(); const tiles = screen.getAllByTestId("stat-tile"); expect(tiles[0].querySelector("img")!.getAttribute("src")).toBe("https://api.example.com/uploads/p.jpg"); expect(tiles[0].querySelector('[data-testid="stat-tile-icon"]')).toBeNull(); for (const t of tiles.slice(1)) expect(t.querySelector('[data-testid="stat-tile-icon"]')).not.toBeNull(); });
});
describe("shop by section", () => {
  it("is a grid of wide tiles: 2 per row on a phone, 3 on a tablet, 4 on a computer, each a link to the section with its photo in an angled panel", async () => {
    m.cats.current = Array.from({ length: 6 }, (_, i) => cat(i, `/uploads/s${i}.png`)); await show(); const tiles = screen.getAllByTestId("section-tile"); expect(tiles).toHaveLength(6); expect(tiles[0].getAttribute("href")).toBe("/search?category=c0");
    const ul = tiles[0].closest("ul")!; for (const c of ["grid-cols-2", "sm:grid-cols-3", "lg:grid-cols-4"]) expect(ul.className.split(" "), c).toContain(c); expect(ul.className).not.toContain("lg:grid-cols-6");
  });
  it("the More tile is the wide dashed one and takes the fourth place (3 sections + More) when there are more sections than a row", async () => { m.cats.current = Array.from({ length: 9 }, (_, i) => cat(i)); const { container } = await show(); const more = container.querySelector('button[data-variant="wide"]'); expect(more).not.toBeNull(); expect(more!.textContent).toBe("More sections"); const shown = [...screen.getAllByTestId("section-tile")].filter((t) => !t.closest("li")!.hasAttribute("hidden")); expect(shown).toHaveLength(3); });
  it("in Arabic the names and links are Arabic", async () => { m.cats.current = [cat(1)]; await show("ar"); expect(screen.getByText("قسم 1")).toBeInTheDocument(); expect(screen.getByTestId("section-tile").getAttribute("href")).toBe("/ar/search?category=c1"); });
});
describe("shop by brand", () => {
  it("is a grid of round photos: 3 per row on a phone, 5 on a tablet, 10 on a wide screen (9 brands and More), each a link to the brand's parts", async () => {
    m.brands.current = Array.from({ length: 6 }, (_, i) => brand(i, `/uploads/b${i}.png`)); await show(); const tiles = screen.getAllByTestId("brand-tile"); expect(tiles).toHaveLength(6); expect(tiles[0].getAttribute("href")).toBe("/search?q=Brand%200");
    const ul = tiles[0].closest("ul")!; for (const c of ["grid-cols-3", "sm:grid-cols-5", "xl:grid-cols-10"]) expect(ul.className.split(" "), c).toContain(c);
  });
  it("the More tile is the dashed circle with the words under it", async () => { m.brands.current = Array.from({ length: 12 }, (_, i) => brand(i)); const { container } = await show(); const more = container.querySelector('button[data-variant="round"]'); expect(more).not.toBeNull(); expect(more!.textContent).toContain("More brands"); const shown = [...screen.getAllByTestId("brand-tile")].filter((t) => !t.closest("li")!.hasAttribute("hidden")); expect(shown).toHaveLength(9); });
  it("9 brands are shown and then More, whatever the screen: 9 or fewer brands have no More tile, 10 have one; on a phone More is a wide button under the 3 x 3 brands", async () => {
    m.brands.current = Array.from({ length: 9 }, (_, i) => brand(i)); let v = await show(); expect(v.container.querySelector('button[data-variant="round"]')).toBeNull(); v.unmount();
    m.brands.current = Array.from({ length: 10 }, (_, i) => brand(i)); v = await show(); expect(v.container.querySelector('button[data-variant="round"]')).not.toBeNull(); const pill = v.container.querySelector('button[data-variant="pill"]'); expect(pill).not.toBeNull(); expect(pill!.textContent).toContain("More brands"); expect(pill!.closest("li")!.className).toContain("col-span-3");
  });
  it("in Arabic the Arabic brand name is shown", async () => { m.brands.current = [brand(1)]; await show("ar"); expect(screen.getByText("ماركة 1")).toBeInTheDocument(); });
});
describe("nothing of the old tiles is left", () => {
  it("no 64 px photo box and no white tile card around a section or a brand", async () => { m.cats.current = [cat(1)]; m.brands.current = [brand(1)]; const { container } = await show(); expect(container.innerHTML).not.toContain("size-16"); expect(container.innerHTML).not.toContain("size-[72px]"); });
});
