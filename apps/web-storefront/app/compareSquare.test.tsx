import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { ProductDetail } from "@/lib/api";

// Compare: the photo of each part is in a SQUARE box (the whole photo, on white), and at most 4 parts are compared.
const m = vi.hoisted(() => ({ lang: { current: "en" as "en" | "ar" } }));
vi.mock("@/lib/lang", () => ({ getLang: async () => m.lang.current }));
vi.mock("@/lib/api", () => ({ fetchProductById: async (id: string) => (id === "gone" ? null : { id, name: `Part ${id}`, price: 10, rating: null, reviewCount: 0, stockQuantity: 3, images: id === "nophoto" ? [] : [`/uploads/${id}.png`], attributes: [] }), resolveImageUrl: (u: string) => `https://api.example.com${u}` }));
vi.mock("@/components/Price", () => ({ Price: ({ usd }: { usd: number }) => <span>${usd}</span> }));
vi.mock("@/components/LocLink", () => ({ default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => <a href={href} className={className}>{children}</a> }));
vi.mock("next/image", () => ({ default: (p: { src: string; alt: string; className?: string; sizes?: string }) => <img src={p.src} alt={p.alt} className={p.className} data-sizes={p.sizes} /> }));
import ComparePage from "./compare/page";
import { COMPARE_MAX } from "@/lib/compare";

const show = async (ids: string, lang: "en" | "ar" = "en") => { m.lang.current = lang; return render(await ComparePage({ searchParams: Promise.resolve({ ids }) })); };
const boxes = (c: HTMLElement) => [...c.querySelectorAll("thead th span.relative")];
beforeEach(() => { m.lang.current = "en"; });

describe("the photo boxes of the compared parts", () => {
  it("are SQUARE (aspect-square), on white with a thin border, at most 144 px wide, not the old wide 112 px high box", async () => {
    const { container } = await show("a,b"); const b = boxes(container); expect(b).toHaveLength(2);
    for (const box of b) { const c = box.className; expect(c).toContain("aspect-square"); expect(c).toContain("max-w-36"); expect(c).toContain("w-full"); expect(c).toContain("bg-white"); expect(c).toContain("border"); expect(c).not.toContain("h-28"); expect(c).not.toContain("bg-[#e6edf2]"); }
  });
  it("show the WHOLE photo (contained, with a small margin), never cut to fill the box", async () => {
    const { container } = await show("a,b"); for (const box of boxes(container)) { const img = box.querySelector("img")!; expect(img.className).toContain("object-contain"); expect(img.className).toContain("p-1.5"); expect(img.className).not.toContain("object-cover"); expect(img.getAttribute("data-sizes")).toBe("144px"); expect(img.getAttribute("src")).toContain("/uploads/"); }
  });
  it("a part without a photo has the empty square box (no broken picture)", async () => { const { container } = await show("a,nophoto"); const b = boxes(container); expect(b[1].querySelector("img")).toBeNull(); expect(b[1].className).toContain("aspect-square"); });
  it("the same in Arabic", async () => { const { container } = await show("a,b", "ar"); for (const box of boxes(container)) expect(box.className).toContain("aspect-square"); });
});
describe("how many parts can be compared", () => {
  it("at most 4 (2 to 4, like the app): a fifth is left out", async () => { const { container } = await show("a,b,c,d,e,f"); expect(COMPARE_MAX).toBe(4); expect(container.querySelectorAll("thead th")).toHaveLength(4); expect(container.textContent).not.toContain("Part e"); });
  it("a part that no longer exists is skipped", async () => { const { container } = await show("a,gone,b,c"); expect(container.querySelectorAll("thead th")).toHaveLength(3); });
});
