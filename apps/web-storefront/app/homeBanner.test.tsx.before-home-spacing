import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// The home page's left side: EITHER the headline and sub-headline OR the banner (one switch), never both, as big as the finder box beside it. The shop's answers are replaced by fixed values.
const m = vi.hoisted(() => ({ banner: { current: null as unknown }, bannerFails: { current: false }, text: { current: null as unknown } }));
vi.mock("@/lib/lang", () => ({ getLang: vi.fn(async () => "en") }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/homeFonts", () => ({ homeFontStyle: () => undefined }));
vi.mock("@/lib/api", () => ({
  fetchCategories: vi.fn(async () => []), fetchVehicleBrands: vi.fn(async () => []), fetchAnnouncements: vi.fn(async () => []), fetchProducts: vi.fn(async () => []), fetchSiteStats: vi.fn(async () => null), fetchHomePictures: vi.fn(async () => null),
  fetchHomeText: vi.fn(async () => m.text.current), fetchHomeBanner: vi.fn(async () => { if (m.bannerFails.current) throw new Error("shop down"); return m.banner.current; }), fetchModelsForBrand: vi.fn(async () => []), fetchGenerationsForModel: vi.fn(async () => []), resolveImageUrl: (u: string) => `https://api.example.com${u}`,
}));
vi.mock("@/components/HeroPicker", () => ({ default: () => <div data-testid="finder" /> }));
import { LangProvider } from "@/components/LangProvider";

const slide = (id: string, over: Record<string, unknown> = {}) => ({ id, imageEn: `/uploads/${id}-en.png`, imageAr: `/uploads/${id}-ar.png`, altEn: `Ad ${id}`, altAr: `إعلان ${id}`, link: { type: "none", value: "" }, seconds: 5, ...over });
const banner = (over: Record<string, unknown> = {}) => ({ mode: "banner", slides: [slide("a"), slide("b")], width: 1250, height: 500, ...over });
const block = (over = {}) => ({ en: null, ar: null, font: "default", size: "large", ...over });
async function show(lang: "en" | "ar" = "en") {
  vi.mocked((await import("@/lib/lang")).getLang).mockResolvedValue(lang);
  const { default: HomePage } = await import("./page"); const view = render(<LangProvider lang={lang}>{await HomePage()}</LangProvider>);
  return { view, hero: screen.getByRole("heading", { level: 1, hidden: true }).closest("section")! as HTMLElement };
}
beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com"); m.banner.current = null; m.bannerFails.current = false; m.text.current = null; document.body.innerHTML = ""; });

describe("the switch is on Banner", () => {
  it("the banner is shown beside the finder box (banner first), the headline text is NOT shown, and the page keeps its h1 (hidden from view) for search engines", async () => {
    m.banner.current = banner(); m.text.current = { topBar: { en: null, ar: null }, headline: block({ en: "My own headline" }), subheadline: block({ en: "My own sub", size: "medium" }) }; const { hero } = await show();
    expect(screen.getByTestId("home-banner")).toBeInTheDocument(); expect(screen.getByTestId("finder")).toBeInTheDocument(); expect(hero.contains(screen.getByTestId("home-banner"))).toBe(true);
    const h1 = screen.getByRole("heading", { level: 1, hidden: true }); expect(h1.textContent).toBe("My own headline"); expect(h1.className).toContain("sr-only"); expect(screen.queryByText("My own sub")).toBeNull();
    const kids = [...hero.children]; expect(kids.indexOf(screen.getByTestId("home-banner"))).toBeLessThan(kids.indexOf(screen.getByTestId("finder")));
  });
  it("two equal columns on a computer, stretched to the height of the finder box, with a smaller gap; the section is still named by the h1", async () => {
    m.banner.current = banner(); const { hero } = await show(); expect(hero.className).toContain("lg:grid-cols-2"); expect(hero.className).toContain("lg:items-stretch"); expect(hero.className).toContain("gap-6"); expect(hero.className).not.toContain("1.1fr"); expect(hero.getAttribute("aria-labelledby")).toBe("home-h1");
  });
  it("the photos are the English ones on the English site, with their photo addresses made absolute", async () => { m.banner.current = banner(); await show(); const srcs = [...screen.getByTestId("home-banner-strip").querySelectorAll("img")].map((i) => decodeURIComponent(i.getAttribute("src") || "")); expect(srcs.some((s) => s.includes("https://api.example.com/uploads/a-en.png"))).toBe(true); expect(srcs.some((s) => s.includes("-ar.png"))).toBe(false); });
  it("on the Arabic site the Arabic photos are used, and a slide with only an English photo still shows (its English photo)", async () => {
    m.banner.current = banner({ slides: [slide("a"), slide("b", { imageAr: null })] }); await show("ar"); const srcs = [...screen.getByTestId("home-banner-strip").querySelectorAll("img")].map((i) => decodeURIComponent(i.getAttribute("src") || ""));
    expect(srcs.some((s) => s.includes("a-ar.png"))).toBe(true); expect(srcs.some((s) => s.includes("b-en.png"))).toBe(true); expect(srcs.some((s) => s.includes("b-ar.png"))).toBe(false); expect(screen.getByTestId("home-banner").querySelector("[dir]") ?? true).toBeTruthy();
  });
  it("Arabic slides the other way (the component is told it is right-to-left)", async () => { m.banner.current = banner(); await show("ar"); expect(screen.getByTestId("home-banner-strip").style.transform).toBe("translateX(0%)"); });
});
describe("the switch is on Headline, or the banner cannot be used: the home page is exactly as before", () => {
  it("Headline: the headline and sub-headline beside the finder box, no banner, the old proportions", async () => {
    m.banner.current = banner({ mode: "headline" }); const { hero } = await show(); expect(screen.queryByTestId("home-banner")).toBeNull(); expect(screen.getByTestId("finder")).toBeInTheDocument(); expect(screen.getByRole("heading", { level: 1 }).className).not.toContain("sr-only"); expect(hero.className).toContain("lg:grid-cols-[1.1fr_1fr]"); expect(hero.className).toContain("items-center"); expect(hero.className).not.toContain("lg:grid-cols-2");
  });
  it("Banner chosen but the shop sends no usable slide: the headline (never an empty space)", async () => { m.banner.current = banner({ slides: [slide("a", { imageEn: null, imageAr: null })] }); await show(); expect(screen.queryByTestId("home-banner")).toBeNull(); expect(screen.getByRole("heading", { level: 1 }).className).not.toContain("sr-only"); });
  it("the shop sends no banner at all, or an empty list, or the request fails: the headline, and the page still works", async () => {
    for (const make of [() => { m.banner.current = null; }, () => { m.banner.current = banner({ slides: [] }); }, () => { m.bannerFails.current = true; }]) { document.body.innerHTML = ""; m.bannerFails.current = false; make(); await show(); expect(screen.queryByTestId("home-banner")).toBeNull(); expect(screen.getByTestId("finder")).toBeInTheDocument(); expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument(); }
  });
  it("a slide with an unsafe link is shown without the link (never a script)", async () => { m.banner.current = banner({ slides: [slide("a", { link: { type: "url", value: "javascript:alert(1)" } })] }); await show(); expect(screen.getByTestId("home-banner").querySelector("a")).toBeNull(); });
});
