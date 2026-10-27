import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// A brand on the home page: a round photo with a fine ring, the name under it, no card.
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("next/image", () => ({ default: (p: { src: string; alt: string; className?: string }) => <img data-testid="photo" src={p.src} alt={p.alt} className={p.className} /> }));
vi.mock("@/lib/api", () => ({ resolveImageUrl: (u: string) => `https://api.example.com${u}` }));
import BrandTile from "./BrandTile";
import { LangProvider } from "./LangProvider";

const show = (props: Partial<React.ComponentProps<typeof BrandTile>> = {}, lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}><BrandTile href="/search?q=BYD" name="BYD" photo="/uploads/byd.png" {...props} /></LangProvider>);
describe("the brand tile", () => {
  it("is one link to the brand's parts with the name under the photo", () => { show(); const a = screen.getByTestId("brand-tile"); expect(a.getAttribute("href")).toBe("/search?q=BYD"); expect(screen.getByText("BYD")).toBeInTheDocument(); });
  it("in Arabic the link keeps /ar", () => { show({ name: "بي واي دي" }, "ar"); expect(screen.getByTestId("brand-tile").getAttribute("href")).toBe("/ar/search?q=BYD"); });
  it("the photo is a circle (76 px on a phone, 96 px from the small breakpoint up) with a fine ring, cropped to fill; there is NO card border around the tile", () => {
    show(); const c = screen.getByTestId("brand-tile-photo"); for (const k of ["rounded-full", "size-[76px]", "sm:size-24", "overflow-hidden", "bg-[#e6edf2]"]) expect(c.className.split(" "), k).toContain(k); expect(c.className).toContain("shadow-[0_0_0_3px_#fff,0_0_0_4px_#d3dae0]");
    expect(screen.getByTestId("photo").className).toContain("object-cover"); expect(screen.getByTestId("photo").getAttribute("alt")).toBe(""); const tile = screen.getByTestId("brand-tile").className; expect(tile).not.toMatch(/\bborder\b/); expect(tile).not.toContain("bg-white");
  });
  it("the ring turns gold when the tile is hovered", () => { show(); expect(screen.getByTestId("brand-tile-photo").className).toContain("group-hover:shadow-[0_0_0_3px_#fff,0_0_0_4px_#fab219]"); expect(screen.getByTestId("brand-tile").className).toContain("group"); });
  it("with no photo the circle shows the grey picture icon", () => { show({ photo: null }); expect(screen.queryByTestId("photo")).not.toBeInTheDocument(); expect(screen.getByTestId("brand-tile-photo").querySelector("svg")).not.toBeNull(); });
  it("a long name is cut after two lines", () => { show({ name: "An extremely long brand name that wraps" }); expect(screen.getByText(/An extremely long/).className).toContain("line-clamp-2"); });
});
