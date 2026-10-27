import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// A section on the home page: a wide tile, the name beside an angled photo (mirrored in Arabic).
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("next/image", () => ({ default: (p: { src: string; alt: string; className?: string }) => <img data-testid="photo" src={p.src} alt={p.alt} className={p.className} /> }));
vi.mock("@/lib/api", () => ({ resolveImageUrl: (u: string) => `https://api.example.com${u}` }));
import SectionTile from "./SectionTile";
import { LangProvider } from "./LangProvider";

const show = (props: Partial<React.ComponentProps<typeof SectionTile>> = {}, lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}><SectionTile href="/search?category=brake" name="Brake System" photo="/uploads/brake.png" {...props} /></LangProvider>);
describe("the section tile", () => {
  it("is one link to the section's search, with the name as its text", () => { show(); const a = screen.getByTestId("section-tile"); expect(a.tagName).toBe("A"); expect(a.getAttribute("href")).toBe("/search?category=brake"); expect(screen.getByText("Brake System")).toBeInTheDocument(); });
  it("in Arabic the link keeps /ar", () => { show({ name: "نظام الفرامل" }, "ar"); expect(screen.getByTestId("section-tile").getAttribute("href")).toBe("/ar/search?category=brake"); });
  it("is 80 px high on a phone and 104 px from the small breakpoint up, rounded and bordered, white", () => { const c = screen.queryByTestId("x") ?? (show(), screen.getByTestId("section-tile")); for (const k of ["h-20", "sm:h-[104px]", "rounded-[14px]", "border", "bg-white", "overflow-hidden"]) expect(c.className.split(" "), k).toContain(k); });
  it("the photo fills an ANGLED panel (the angle mirrored in Arabic), 44% of the tile, cropped to fill, as decoration", () => {
    show(); const panel = screen.getByTestId("section-tile-photo"); for (const k of ["w-[44%]", "[clip-path:polygon(22%_0,100%_0,100%_100%,0_100%)]", "rtl:[clip-path:polygon(0_0,78%_0,100%_100%,0_100%)]"]) expect(panel.className.split(" "), k).toContain(k);
    const img = screen.getByTestId("photo"); expect(img.getAttribute("src")).toBe("https://api.example.com/uploads/brake.png"); expect(img.getAttribute("alt")).toBe(""); expect(img.className).toContain("object-cover");
  });
  it("with no photo the panel shows the grey picture icon (and no image)", () => { show({ photo: null }); expect(screen.queryByTestId("photo")).not.toBeInTheDocument(); expect(screen.getByTestId("section-tile-photo").querySelector("svg")!.getAttribute("aria-hidden")).toBe("true"); expect(screen.getByTestId("section-tile-photo").className).toContain("bg-[#e6edf2]"); });
  it("a long name is cut after two lines and never pushes the photo out", () => { show({ name: "A very very long section name that goes on and on" }); const n = screen.getByText(/A very very long/); expect(n.className).toContain("line-clamp-2"); expect(n.className).toContain("min-w-0"); expect(n.className).toContain("[overflow-wrap:anywhere]"); });
});
