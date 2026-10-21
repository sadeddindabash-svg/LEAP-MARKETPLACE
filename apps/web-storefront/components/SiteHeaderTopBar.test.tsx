import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

// The message in the top bar of the real header: the admin's text when there is one, the website's own wording when not, in the page's language.
const m = vi.hoisted(() => ({ fetchText: vi.fn() }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/api", () => ({
  fetchCategories: vi.fn(async () => Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, nameEn: `Section ${i}`, nameAr: `قسم ${i}`, photoUrl: null, sortOrder: i, commissionPercent: 10 }))),
  resolveImageUrl: (u: string) => u, fetchHomeText: (...a: unknown[]) => m.fetchText(...a),
}));
vi.mock("@/lib/net", () => ({ isShopReachable: vi.fn(async () => true) }));
vi.mock("./AccountMenu", () => ({ default: () => null }));
vi.mock("./CartIcon", () => ({ default: () => null }));
vi.mock("./CurrencySwitcher", () => ({ default: () => null }));
vi.mock("./HeaderSearch", () => ({ default: () => null }));
vi.mock("./LanguageSwitcher", () => ({ default: () => null }));
vi.mock("./NotificationBell", () => ({ default: () => null }));
vi.mock("./VehicleBar", () => ({ default: () => null }));
import SiteHeader from "./SiteHeader";
import { LangProvider } from "./LangProvider";

const topBar = async (lang: "en" | "ar") => { const view = render(<LangProvider lang={lang}>{await SiteHeader({ lang })}</LangProvider>); return view.container.querySelector("header > div:nth-of-type(1) span, header div.bg-navy-deep span")!.textContent; };
beforeEach(() => { m.fetchText.mockReset(); m.fetchText.mockResolvedValue(null); });

describe("the top bar message", () => {
  it("is the website's own wording until the admin sets one (or when the shop cannot be asked)", async () => {
    expect(await topBar("en")).toBe("Largest ready-to-ship warehouse for Chinese auto parts");
  });
  it("is the admin's text for the page's language", async () => {
    m.fetchText.mockResolvedValue({ topBar: { en: "Free shipping this week", ar: "شحن مجاني هذا الأسبوع" }, headline: {}, subheadline: {} });
    expect(await topBar("en")).toBe("Free shipping this week"); document.body.innerHTML = ""; expect(await topBar("ar")).toBe("شحن مجاني هذا الأسبوع");
  });
  it("an Arabic page with only an English text keeps its own Arabic wording", async () => {
    m.fetchText.mockResolvedValue({ topBar: { en: "English only", ar: null }, headline: {}, subheadline: {} });
    expect(await topBar("ar")).not.toBe("English only");
  });
  it("is shown as plain text, never as HTML", async () => {
    m.fetchText.mockResolvedValue({ topBar: { en: "<i>Sale</i>", ar: null }, headline: {}, subheadline: {} });
    expect(await topBar("en")).toBe("<i>Sale</i>");
  });
});
