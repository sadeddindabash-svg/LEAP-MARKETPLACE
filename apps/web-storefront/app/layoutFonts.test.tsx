import { describe, it, expect, vi } from "vitest";
import type { ReactElement } from "react";

// The root layout and the website's fonts: linked (not downloaded while the site is built), and the font variables set on the page.
vi.mock("@/lib/lang", () => ({ getLang: vi.fn(async () => "en") }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
import { SITE_FONTS_HREF, SITE_FONT_VARS } from "@/lib/siteFonts";

type El = ReactElement<{ children?: unknown; [k: string]: unknown }>;
const kids = (el: El) => ([] as unknown[]).concat(el.props.children as never).filter(Boolean) as El[];
describe("root layout: fonts", () => {
  it("the page has the three font variables and no font class from a build-time download", async () => {
    const { default: RootLayout } = await import("./layout"); const html = (await RootLayout({ children: null })) as El;
    expect(html.type).toBe("html"); expect(html.props.style).toEqual(SITE_FONT_VARS); expect(html.props.className).toBe("h-full antialiased");
  });
  it("the head connects early to Google Fonts and links the one stylesheet, before the body", async () => {
    const { default: RootLayout } = await import("./layout"); const html = (await RootLayout({ children: null })) as El; const [head, body] = kids(html); expect(head.type).toBe("head"); expect(body.type).toBe("body");
    const links = kids(head).map((l) => ({ rel: l.props.rel, href: l.props.href })); expect(links).toEqual([{ rel: "preconnect", href: "https://fonts.googleapis.com" }, { rel: "preconnect", href: "https://fonts.gstatic.com" }, { rel: "stylesheet", href: SITE_FONTS_HREF }]);
    expect(kids(head)[1].props.crossOrigin).toBe("anonymous");
  });
});
