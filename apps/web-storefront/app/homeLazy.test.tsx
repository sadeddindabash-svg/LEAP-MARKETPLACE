import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

// The home page's "Newest parts": the first eight are drawn on the server and MORE LOAD AS YOU SCROLL, eight at a time, with no cap and no "see all" link. The grid is replaced by one that records its settings.
const m = vi.hoisted(() => ({ grid: vi.fn() }));
vi.mock("@/lib/lang", () => ({ getLang: vi.fn(async () => "en") }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/api", () => ({
  fetchCategories: vi.fn(async () => []), fetchVehicleBrands: vi.fn(async () => []), fetchAnnouncements: vi.fn(async () => []), fetchSiteStats: vi.fn(async () => null),
  fetchProducts: vi.fn(async () => Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, name: `Part ${i}` }))),
  fetchModelsForBrand: vi.fn(async () => []), fetchGenerationsForModel: vi.fn(async () => []), resolveImageUrl: (u: string) => u,
}));
vi.mock("@/components/HeroPicker", () => ({ default: () => <div /> }));
vi.mock("@/components/InfiniteProductGrid", () => ({ default: (props: Record<string, unknown>) => { m.grid(props); return <div data-testid="newest-grid" />; } }));

import { LangProvider } from "@/components/LangProvider";

beforeEach(() => { m.grid.mockClear(); vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com"); });

describe("home page: newest parts load as you scroll", () => {
  it("the grid starts with the first eight, asks for the newest, eight at a time, and has no cap and no see-all link", async () => {
    const { default: HomePage } = await import("./page");
    const view = render(<LangProvider lang="en">{await HomePage()}</LangProvider>);
    expect(view.getByTestId("newest-grid")).toBeInTheDocument();
    const props = m.grid.mock.calls[0][0] as { source: unknown; initial: { id: string }[]; total: unknown; pageSize: number; maxExtraPages?: number; seeAllHref?: string };
    expect(props.source).toEqual({ kind: "newest" }); expect(props.initial.map((p) => p.id)).toEqual(["p0", "p1", "p2", "p3", "p4", "p5", "p6", "p7"]);
    expect(props.total).toBeNull(); expect(props.pageSize).toBe(8);
    expect(props.maxExtraPages).toBeUndefined(); expect(props.seeAllHref).toBeUndefined();
  });
});
