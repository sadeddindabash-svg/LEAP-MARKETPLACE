import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// The four tiles of the home page show the pictures the admin chose (72 px), and the icon wherever there is none. The server's answers are replaced by fixed values.
const m = vi.hoisted(() => ({ pictures: { current: null as unknown } }));
vi.mock("@/lib/lang", () => ({ getLang: vi.fn(async () => "en") }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/api", () => ({
  fetchCategories: vi.fn(async () => []), fetchVehicleBrands: vi.fn(async () => []), fetchAnnouncements: vi.fn(async () => []), fetchProducts: vi.fn(async () => []),
  fetchSiteStats: vi.fn(async () => ({ parts: 1284, brands: 48, models: 312, countries: 39 })), fetchHomePictures: vi.fn(async () => m.pictures.current),
  fetchModelsForBrand: vi.fn(async () => []), fetchGenerationsForModel: vi.fn(async () => []), resolveImageUrl: (u: string) => `https://api.example.com${u}`,
}));
vi.mock("@/components/HeroPicker", () => ({ default: () => <div /> }));
import { LangProvider } from "@/components/LangProvider";

async function show(lang: "en" | "ar" = "en") {
  vi.mocked((await import("@/lib/lang")).getLang).mockResolvedValue(lang);
  const { default: HomePage } = await import("./page");
  render(<LangProvider lang={lang}>{await HomePage()}</LangProvider>);
  return screen.getByLabelText("Leap Auto Parts").querySelectorAll("li");
}
beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com"); m.pictures.current = { parts: null, brands: null, models: null, countries: null }; });

describe("home page: the pictures of the four tiles", () => {
  it("a tile with a picture shows it (square, 72 px) and no icon; a tile without one keeps its icon (also 72 px)", async () => {
    m.pictures.current = { parts: null, brands: "/uploads/brands.jpg", models: null, countries: "/uploads/countries.jpg" };
    const [parts, brands, models, countries] = await show();
    expect(brands.querySelector("img")!.getAttribute("src")).toBe("https://api.example.com/uploads/brands.jpg"); expect(brands.querySelector("svg")).toBeNull();
    expect(countries.querySelector("img")!.getAttribute("src")).toBe("https://api.example.com/uploads/countries.jpg");
    for (const icon of [parts, models]) { expect(icon.querySelector("svg")).not.toBeNull(); expect(icon.querySelector("img")).toBeNull(); expect(icon.innerHTML).toContain("size-[72px]"); }
    expect(brands.innerHTML).toContain("size-[72px]");
  });
  it("all four pictures set: all four tiles show a picture", async () => {
    m.pictures.current = { parts: "/uploads/a.jpg", brands: "/uploads/b.jpg", models: "/uploads/c.jpg", countries: "/uploads/d.jpg" };
    for (const li of await show()) { expect(li.querySelector("img")).not.toBeNull(); expect(li.querySelector("svg")).toBeNull(); }
  });
  it("no pictures at all, or the server cannot give them: the four icons, and the page still loads with its numbers", async () => {
    m.pictures.current = null;
    const tiles = [...await show()]; expect(tiles).toHaveLength(4);
    for (const li of tiles) { expect(li.querySelector("svg")).not.toBeNull(); expect(li.querySelector("img")).toBeNull(); }
    expect(tiles.map((li) => li.textContent)).toEqual(["1,284Parts", "48Brands", "312Models", "39Countries"]);
  });
  it("the picture does not change the number or the label, in Arabic too", async () => {
    m.pictures.current = { parts: "/uploads/a.jpg", brands: null, models: null, countries: null };
    expect([...await show("ar")].map((li) => li.textContent)).toEqual(["1,284القطع", "48الماركات", "312الطرازات", "39الدول"]);
  });
});
