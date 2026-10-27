import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// Where the header puts the "Shopping for" container: at the end of the menu row (computer) and in its own row under the menu (phone); the thin bar that used to sit under the menu is gone.
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/api", () => ({ fetchCategories: vi.fn(async () => []), resolveImageUrl: (u: string) => u, fetchHomeText: vi.fn(async () => null) }));
vi.mock("@/lib/net", () => ({ isShopReachable: vi.fn(async () => true) }));
vi.mock("./AccountMenu", () => ({ default: () => null }));
vi.mock("./CartIcon", () => ({ default: () => null }));
vi.mock("./CurrencySwitcher", () => ({ default: () => null }));
vi.mock("./HeaderSearch", () => ({ default: () => null }));
vi.mock("./LanguageSwitcher", () => ({ default: () => null }));
vi.mock("./NotificationBell", () => ({ default: () => null }));
vi.mock("./VehicleBar", () => ({ default: ({ where }: { where: string }) => <div data-testid={`vehicle-${where}`} /> }));
import SiteHeader from "./SiteHeader";
import { LangProvider } from "./LangProvider";

async function header(lang: "en" | "ar" = "en") {
  const view = render(<LangProvider lang={lang}>{await SiteHeader({ lang })}</LangProvider>);
  const nav = view.container.querySelector('nav[aria-label="Main"]') as HTMLElement;
  return { view, nav, row: nav.firstElementChild as HTMLElement };
}
describe("the Shopping for container in the header", () => {
  it("is the LAST thing of the menu row (after Home, Products, Find a part and Sections), so it sits beside the menus", async () => {
    const { row } = await header(); const last = row.lastElementChild as HTMLElement; expect(last.getAttribute("data-testid")).toBe("vehicle-menu");
    const names = [...row.children].map((c) => c.getAttribute("data-testid") ?? c.textContent!.trim()); expect(names.slice(0, 3)).toEqual(["Home", "Products", "Find a part"]); expect(names[names.length - 2]).toMatch(/Sections/); expect(names[names.length - 1]).toBe("vehicle-menu");
  });
  it("the menu row stays on ONE line from the large breakpoint up (so the container cannot drop under the menus), and may wrap below it", async () => { const { row } = await header(); const c = row.className.split(" "); expect(c).toContain("flex-wrap"); expect(c).toContain("lg:flex-nowrap"); });
  it("a second place, for phones, is its own row right under the menu (not inside it)", async () => {
    const { nav } = await header(); const next = nav.nextElementSibling as HTMLElement; expect(next.getAttribute("data-testid")).toBe("vehicle-row"); expect(nav.contains(next)).toBe(false);
  });
  it("there are exactly two places (the old thin bar under the menu is not drawn as a third)", async () => { const { view } = await header(); expect(view.container.querySelectorAll('[data-testid^="vehicle-"]')).toHaveLength(2); });
  it("the same in Arabic", async () => { const { row, nav } = await header("ar"); expect((row.lastElementChild as HTMLElement).getAttribute("data-testid")).toBe("vehicle-menu"); expect((nav.nextElementSibling as HTMLElement).getAttribute("data-testid")).toBe("vehicle-row"); });
});
