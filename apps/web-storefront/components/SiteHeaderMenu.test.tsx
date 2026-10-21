import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// The Sections menu of the real header: four columns on a wide screen, placed against the whole navigation bar (so it can never run off the screen), each section with its photo tile beside the name.
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/api", () => ({
  fetchCategories: vi.fn(async () => Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, nameEn: `Section ${i}`, nameAr: `قسم ${i}`, photoUrl: null, sortOrder: i, commissionPercent: 10 }))),
  resolveImageUrl: (u: string) => u,
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

async function header() {
  const view = render(<LangProvider lang="en">{await SiteHeader({ lang: "en" })}</LangProvider>);
  const main = view.container.querySelector('nav[aria-label="Main"]') as HTMLElement;
  const dropdown = main.querySelector("[data-open]") as HTMLElement;
  return { main, bar: main.firstElementChild as HTMLElement, dropdown, panel: dropdown.querySelector("div[id]") as HTMLElement };
}

describe("the Sections menu", () => {
  it("has four columns on a wide screen, three on a tablet and two on a phone", async () => {
    const { panel } = await header(); const c = panel.className.split(" ");
    for (const k of ["grid-cols-2", "sm:grid-cols-3", "lg:grid-cols-4"]) expect(c).toContain(k);
  });
  it("is placed against the whole navigation bar, not against its own button (a wide panel would run off the screen)", async () => {
    const { bar, dropdown, panel } = await header();
    expect(bar.className.split(" ")).toContain("relative"); expect(dropdown.className.split(" ")).not.toContain("relative"); expect(panel.className).toContain("inset-x-0");
  });
  it("lists every section with its photo tile beside the name, and a link to all sections", async () => {
    const { panel } = await header(); const links = [...panel.querySelectorAll("a")];
    expect(links.filter((a) => a.getAttribute("href")?.startsWith("/search?category="))).toHaveLength(12);
    for (const a of links.slice(0, 12)) { expect(a.querySelector("svg")).not.toBeNull(); expect(a.textContent).toMatch(/^Section \d+$/); }
    expect(links[links.length - 1].getAttribute("href")).toBe("/search");
  });
});
