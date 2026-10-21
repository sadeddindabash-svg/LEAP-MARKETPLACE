import { describe, it, expect, vi, beforeEach } from "vitest";

// The six page addresses and the old misspelled one: each address shows its own page, and the old one goes to the right one.
const m = vi.hoisted(() => ({ lang: { current: "en" as "en" | "ar" }, redirect: vi.fn() }));
vi.mock("@/lib/lang", () => ({ getLang: vi.fn(async () => m.lang.current) }));
vi.mock("next/navigation", () => ({ permanentRedirect: (...a: unknown[]) => m.redirect(...a) }));
vi.mock("@/components/LegalPage", () => ({ default: () => null, legalMetadata: vi.fn(async (key: string) => ({ title: `meta for ${key}` })) }));
import LegalPage from "@/components/LegalPage";
import { PAGE_SLUGS, type PageKey } from "@/lib/footerContent";
beforeEach(() => { m.redirect.mockClear(); m.lang.current = "en"; });

describe.each(Object.entries(PAGE_SLUGS) as [PageKey, string][])("/%s", (key, slug) => {
  it(`the page at /${slug} is the "${key}" page, with its own search-result details`, async () => {
    const mod = await import(`./${slug}/page`); const element = mod.default() as { type: unknown; props: { pageKey: string } };
    expect(element.type).toBe(LegalPage); expect(element.props.pageKey).toBe(key); expect(await mod.generateMetadata()).toEqual({ title: `meta for ${key}` });
  });
});
describe("the old misspelled privacy address", () => {
  it("goes (permanently) to the right page", async () => { const { default: Page } = await import("./privecy-policy/page"); await Page(); expect(m.redirect).toHaveBeenCalledWith("/privacy-policy"); });
  it("keeps the visitor's language", async () => { m.lang.current = "ar"; const { default: Page } = await import("./privecy-policy/page"); await Page(); expect(m.redirect).toHaveBeenCalledWith("/ar/privacy-policy"); });
});
