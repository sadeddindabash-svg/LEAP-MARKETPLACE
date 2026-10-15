import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { LangProvider } from "@/components/LangProvider";
import type { ProductSummary } from "@/lib/api";

// The home page and the root layout, rendered in each language. The API and the language lookup are replaced by fixed values.
const lang = { current: "en" as "en" | "ar" };
const product = (id: string, name: string): ProductSummary => ({ id, name, description: null, category: "brake", part: "Front Brake Disc", position: null, oemNumber: "34116792217", currencyCode: "USD", rating: null, reviewCount: 0, stockQuantity: 5, estimatedDeliveryDays: 7, weightKg: null, status: "active", price: 43, images: [] });

vi.mock("@/lib/lang", () => ({ getLang: vi.fn(async () => lang.current) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/font/google", () => ({ Outfit: () => ({ variable: "f1" }), IBM_Plex_Sans_Arabic: () => ({ variable: "f2" }), JetBrains_Mono: () => ({ variable: "f3" }) }));
vi.mock("@/lib/api", () => ({
  fetchCategories: vi.fn(async () => [{ id: "brake", nameEn: "Brake System", nameAr: "نظام الفرامل", photoUrl: null, sortOrder: 1, commissionPercent: 10 }]),
  fetchProducts: vi.fn(async () => [product("p1", "Front Brake Disc"), product("p2", "Oil Filter")]),
  fetchVehicleBrands: vi.fn(async () => [{ id: "b1", name: "BYD", nameAr: "بي واي دي", photoUrl: null }, { id: "b2", name: "Geely", nameAr: null, photoUrl: null }]),
  fetchModelsForBrand: vi.fn(async () => []),
  fetchGenerationsForModel: vi.fn(async () => []),
  resolveImageUrl: (u: string) => u,
}));

beforeEach(() => { lang.current = "en"; vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com"); });

async function renderHome(l: "en" | "ar") {
  lang.current = l;
  const { default: HomePage } = await import("./page");
  render(<LangProvider lang={l}>{await HomePage()}</LangProvider>);
}

describe("home page", () => {
  it("CRITICAL: in English it speaks English and links to the English pages", async () => {
    await renderHome("en");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Find the right part for your car");
    expect(screen.getByRole("heading", { name: "Shop by section" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Brake System" }).getAttribute("href")).toBe("/search?category=brake");
    expect(screen.getByRole("link", { name: "BYD" }).getAttribute("href")).toBe("/search?q=BYD");
    expect(screen.getAllByText(/Delivery in 7 days/).length).toBe(2);
  });

  it("CRITICAL: in Arabic everything is Arabic: the headings, the section and brand names the server has in Arabic, the cards, and every link is an /ar link", async () => {
    await renderHome("ar");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("اعثر على القطعة المناسبة لسيارتك");
    expect(screen.getByRole("heading", { name: "تسوق حسب القسم" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "أحدث القطع" })).toBeInTheDocument();
    const section = screen.getByRole("link", { name: "نظام الفرامل" });
    expect(section.getAttribute("href")).toBe("/ar/search?category=brake");
    expect(screen.getByRole("link", { name: "بي واي دي" })).toBeInTheDocument();             // the brand's Arabic name
    expect(screen.getByRole("link", { name: "Geely" })).toBeInTheDocument();                  // a brand with no Arabic name keeps its English one
    expect(screen.getAllByText(/التوصيل خلال 7 أيام/).length).toBe(2);
    expect(screen.getAllByText("متوفر").length).toBe(2);
    expect(screen.getByRole("button", { name: "اعرض القطع المناسبة" })).toBeInTheDocument();
    expect(screen.getByLabelText("الماركة")).toBeInTheDocument();
    for (const link of screen.getAllByRole("link")) {
      const href = link.getAttribute("href") || "";
      if (href.startsWith("/")) expect(href === "/ar" || href.startsWith("/ar/"), href).toBe(true);        // never an English link inside the Arabic site
    }
  });

  it("the stats are real counts (parts, brands, sections), not claims", async () => {
    await renderHome("en");
    const stats = within(screen.getByLabelText("Leap Auto Parts"));
    expect(stats.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["2parts", "2vehicle brands", "1sections"]);
  });
});

describe("root layout", () => {
  it("CRITICAL: the page is declared in its language and direction: Arabic is lang=ar dir=rtl, English lang=en dir=ltr", async () => {
    const { default: RootLayout } = await import("./layout");
    lang.current = "ar";
    const ar = (await RootLayout({ children: null })) as { type: string; props: { lang: string; dir: string } };
    expect(ar.type).toBe("html");
    expect(ar.props.lang).toBe("ar");
    expect(ar.props.dir).toBe("rtl");
    lang.current = "en";
    const en = (await RootLayout({ children: null })) as { props: { lang: string; dir: string } };
    expect(en.props.lang).toBe("en");
    expect(en.props.dir).toBe("ltr");
  });

  it("the title, description and share locale follow the language", async () => {
    const { generateMetadata } = await import("./layout");
    lang.current = "ar";
    const ar = await generateMetadata();
    expect(ar.description).toContain("قطع غيار السيارات");
    expect(ar.openGraph).toMatchObject({ locale: "ar_AR" });
    expect((ar.title as { template: string }).template).toBe("%s | ليب لقطع السيارات");
    lang.current = "en";
    const en = await generateMetadata();
    expect(en.openGraph).toMatchObject({ locale: "en_US" });
    expect((en.title as { template: string }).template).toBe("%s | Leap Auto Parts");
  });
});
