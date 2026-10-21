import { describe, it, expect, vi } from "vitest";
import type { ReactElement } from "react";

// Every page has the back-to-top button: the root layout includes it, inside the language provider (the button needs the page's language for its label).
vi.mock("@/lib/lang", () => ({ getLang: vi.fn(async () => "en") }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/font/google", () => ({ Outfit: () => ({ variable: "f1" }), IBM_Plex_Sans_Arabic: () => ({ variable: "f2" }), JetBrains_Mono: () => ({ variable: "f3" }) }));

import BackToTop from "@/components/BackToTop";
import { LangProvider } from "@/components/LangProvider";
import SiteFooter from "@/components/SiteFooter";

type El = ReactElement<{ children?: unknown }>;
/** The chain of elements from the root down to the first element of `target` type, or null. */
function pathTo(node: unknown, target: unknown, trail: El[] = []): El[] | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) { for (const child of node) { const hit = pathTo(child, target, trail); if (hit) return hit; } return null; }
  const el = node as El; const here = [...trail, el];
  if (el.type === target) return here;
  return pathTo(el.props?.children, target, here);
}

describe("root layout: back to top", () => {
  it("includes the back-to-top button, inside the language provider, after the footer, on every page", async () => {
    const { default: RootLayout } = await import("./layout");
    const tree = await RootLayout({ children: null });
    const trail = pathTo(tree, BackToTop);
    expect(trail, "BackToTop is somewhere in the layout").not.toBeNull();
    expect(trail!.some((el) => el.type === LangProvider)).toBe(true);
    const parent = trail![trail!.length - 2]; const siblings = ([] as unknown[]).concat(parent.props.children as never) as El[];
    expect(siblings.findIndex((s) => s.type === BackToTop)).toBeGreaterThan(siblings.findIndex((s) => s.type === SiteFooter));
  });
});
