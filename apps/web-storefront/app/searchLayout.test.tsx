import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// The products page: no left column, the vehicle in a strip ABOVE the results, four columns, and the chosen section as a chip that clears it.
const m = vi.hoisted(() => ({ lang: { current: "en" as "en" | "ar" } }));
vi.mock("@/lib/lang", () => ({ getLang: vi.fn(async () => m.lang.current) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/search" }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: null, isLoading: false }), getAuthToken: () => null }));
vi.mock("@/lib/api", () => ({
  fetchCategories: vi.fn(async () => [{ id: "brake", nameEn: "Brake System", nameAr: "نظام الفرامل", photoUrl: null, sortOrder: 1, commissionPercent: 10 }]),
  fetchProductsPaginated: vi.fn(async () => ({ items: [{ id: "p1", name: "Front Brake Disc" }], total: 1 })),
}));
vi.mock("@/components/VehicleFilter", () => ({ VehicleFilter: () => <div data-testid="vehicle-filter" /> }));
vi.mock("@/components/FitsMyCarToggle", () => ({ default: () => <div data-testid="fits-toggle" /> }));
vi.mock("@/components/InfiniteProductGrid", () => ({ default: ({ gridClassName }: { gridClassName: string }) => <div data-testid="results" className={gridClassName} /> }));

import SearchPage from "./search/page";
import { LangProvider } from "@/components/LangProvider";

async function show(searchParams: Record<string, string> = {}, lang: "en" | "ar" = "en") {
  m.lang.current = lang;
  return render(<LangProvider lang={lang}>{await SearchPage({ searchParams: Promise.resolve(searchParams) })}</LangProvider>);
}
const before = (a: HTMLElement, b: HTMLElement) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("the products page layout", () => {
  it("has no left column and no list of sections", async () => {
    const { container } = await show();
    expect(container.querySelector("aside")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Category" })).not.toBeInTheDocument(); expect(screen.queryByRole("link", { name: "Brake System" })).not.toBeInTheDocument();
  });
  it("the vehicle (the switch and the filter) sits in a strip BEFORE the results", async () => {
    await show();
    const results = screen.getByTestId("results");
    expect(before(screen.getByTestId("fits-toggle"), results)).toBe(true); expect(before(screen.getByTestId("vehicle-filter"), results)).toBe(true);
  });
  it("on a wide screen the switch and the vehicle card sit side by side and stretch to the SAME height", async () => {
    await show();
    const row = screen.getByTestId("fits-toggle").parentElement!.parentElement!;
    expect(row.className.split(" ")).toContain("lg:flex-row"); expect(row.className.split(" ")).toContain("lg:items-stretch");
    expect(row.contains(screen.getByTestId("vehicle-filter"))).toBe(true);
  });
  it("the parts are in four columns on a wide screen (three on a tablet, two on a phone)", async () => {
    await show();
    const cls = screen.getByTestId("results").className;
    expect(cls).toContain("grid-cols-2"); expect(cls).toContain("md:grid-cols-3"); expect(cls).toContain("lg:grid-cols-4");
  });
});

describe("the section chip", () => {
  it("shows the chosen section, and clearing it keeps the search words and the vehicle but drops the section", async () => {
    await show({ category: "brake", q: "disc", generationId: "g1", year: "2022", part: "Front Brake Disc" });
    const chip = screen.getByRole("link", { name: /Section: Brake System/ });
    const url = new URL(chip.getAttribute("href") as string, "http://x");
    expect(url.pathname).toBe("/search"); expect(url.searchParams.get("q")).toBe("disc"); expect(url.searchParams.get("generationId")).toBe("g1"); expect(url.searchParams.get("year")).toBe("2022");
    expect(url.searchParams.has("category")).toBe(false); expect(url.searchParams.has("part")).toBe(false);
  });
  it("is in Arabic on the Arabic site, with the Arabic section name", async () => {
    await show({ category: "brake" }, "ar");
    expect(screen.getByRole("link", { name: /القسم: نظام الفرامل/ })).toBeInTheDocument();
  });
  it("is not there when no section is chosen", async () => {
    await show();
    expect(screen.queryByRole("link", { name: /Section:/ })).not.toBeInTheDocument();
  });
});
