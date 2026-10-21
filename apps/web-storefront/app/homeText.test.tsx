import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// The home page's headline and sub-headline: the admin's text, font and size when they are set, the website's own wording and look when not. The shop's answers are replaced by fixed values.
const m = vi.hoisted(() => ({ text: { current: null as unknown } }));
vi.mock("@/lib/lang", () => ({ getLang: vi.fn(async () => "en") }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/homeFonts", () => ({ homeFontStyle: (font?: string) => (font && font !== "default" ? { fontFamily: `Font ${font}` } : undefined) }));
vi.mock("@/lib/api", () => ({
  fetchCategories: vi.fn(async () => []), fetchVehicleBrands: vi.fn(async () => []), fetchAnnouncements: vi.fn(async () => []), fetchProducts: vi.fn(async () => []), fetchSiteStats: vi.fn(async () => null), fetchHomePictures: vi.fn(async () => null),
  fetchHomeText: vi.fn(async () => m.text.current), fetchModelsForBrand: vi.fn(async () => []), fetchGenerationsForModel: vi.fn(async () => []), resolveImageUrl: (u: string) => u,
}));
vi.mock("@/components/HeroPicker", () => ({ default: () => <div /> }));
import { LangProvider } from "@/components/LangProvider";

const block = (over = {}) => ({ en: null, ar: null, font: "default", size: "large", ...over });
const text = (over: Record<string, unknown> = {}) => ({ topBar: { en: null, ar: null }, headline: block(), subheadline: block({ size: "medium" }), ...over });
async function show(lang: "en" | "ar" = "en") {
  vi.mocked((await import("@/lib/lang")).getLang).mockResolvedValue(lang);
  const { default: HomePage } = await import("./page");
  render(<LangProvider lang={lang}>{await HomePage()}</LangProvider>);
  const h1 = screen.getByRole("heading", { level: 1 }); return { h1, sub: h1.nextElementSibling as HTMLElement };
}
beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com"); m.text.current = null; });

describe("home page: the editable headline and sub-headline", () => {
  it("nothing set (or the shop cannot be reached): the website's own wording, size and font, exactly as before", async () => {
    for (const none of [null, text()]) {
      m.text.current = none; document.body.innerHTML = "";
      const { h1, sub } = await show();
      expect(h1.textContent).toBe("Find the right part for your car"); expect(h1.className).toContain("text-[clamp(34px,4.6vw,56px)]"); expect(h1.getAttribute("style")).toBeNull(); expect(h1.id).toBe("home-h1");
      expect(sub.textContent).toBe("Real parts from verified suppliers, matched to your vehicle."); expect(sub.className).toContain("text-lg"); expect(sub.getAttribute("style")).toBeNull();
    }
  });
  it("the admin's text replaces the wording, in the language of the page", async () => {
    m.text.current = text({ headline: block({ en: "Parts for every car", ar: "قطع لكل سيارة" }), subheadline: block({ en: "Shipped fast.", ar: "شحن سريع." }) });
    const en = await show("en"); expect(en.h1.textContent).toBe("Parts for every car"); expect(en.sub.textContent).toBe("Shipped fast."); document.body.innerHTML = "";
    const ar = await show("ar"); expect(ar.h1.textContent).toBe("قطع لكل سيارة"); expect(ar.sub.textContent).toBe("شحن سريع.");
  });
  it("one language never borrows the other: an Arabic page with only an English text keeps its own Arabic wording", async () => {
    m.text.current = text({ headline: block({ en: "English only" }) }); const { h1 } = await show("ar"); expect(h1.textContent).toBe("اعثر على القطعة المناسبة لسيارتك");
  });
  it("only the one that is set changes: a new headline leaves the sub-headline alone", async () => {
    m.text.current = text({ headline: block({ en: "New headline" }) }); const { h1, sub } = await show(); expect(h1.textContent).toBe("New headline"); expect(sub.textContent).toBe("Real parts from verified suppliers, matched to your vehicle.");
  });
  it("the chosen font is applied to the headline and to the sub-headline separately", async () => {
    m.text.current = text({ headline: block({ font: "poppins" }), subheadline: block({ font: "cairo", size: "medium" }) }); const { h1, sub } = await show();
    expect(h1.style.fontFamily.replace(/"/g, "")).toBe("Font poppins"); expect(sub.style.fontFamily.replace(/"/g, "")).toBe("Font cairo");
  });
  it("the chosen size is applied: each of the four sizes gives its own class, for both texts", async () => {
    const heads: Record<string, string> = { small: "text-[clamp(26px,3.4vw,40px)]", medium: "text-[clamp(30px,4vw,48px)]", large: "text-[clamp(34px,4.6vw,56px)]", xlarge: "text-[clamp(40px,5.6vw,68px)]" };
    const subs: Record<string, string> = { small: "text-base", medium: "text-lg", large: "text-xl", xlarge: "text-2xl" };
    for (const size of Object.keys(heads)) { document.body.innerHTML = ""; m.text.current = text({ headline: block({ size }), subheadline: block({ size }) }); const { h1, sub } = await show(); expect(h1.className).toContain(heads[size]); expect(sub.className.split(" ")).toContain(subs[size]); }
  });
  it("what the admin types is shown as plain text, never as HTML", async () => {
    m.text.current = text({ headline: block({ en: "<b>Sale</b> <script>alert(1)</script>" }) }); const { h1 } = await show();
    expect(h1.textContent).toBe("<b>Sale</b> <script>alert(1)</script>"); expect(h1.querySelector("b, script")).toBeNull();
  });
});
