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

describe("equal columns, centered, and the phone", () => {
  it("the table has fixed layout, so every part column is the same width (no minimum widths of its own)", async () => { const { container } = await show("a,b,c,d"); const t = container.querySelector("table")!; expect(t.className).toContain("table-fixed"); expect(t.className).not.toContain("min-w-"); for (const th of container.querySelectorAll("thead th")) { expect(th.className).not.toContain("min-w-"); expect(th.className).not.toMatch(/(^|\s)w-/); } });
  it("the label column is narrower on a phone (w-28) than on a computer (md:w-40)", async () => { const { container } = await show("a,b"); const td = container.querySelector("thead td")!; expect(td.className).toContain("w-28"); expect(td.className).toContain("md:w-40"); });
  it("the photo and the name are centered in their column, other rows keep their start alignment", async () => { const { container } = await show("a,b"); for (const th of container.querySelectorAll("thead th")) { expect(th.className).toContain("text-center"); expect(th.querySelector("span.relative")!.className).toContain("mx-auto"); } for (const td of container.querySelectorAll("tbody td")) expect(td.className).not.toContain("text-center"); });
  it("ON A PHONE only the first 2 parts show: the 3rd and 4th columns are hidden below 768 px (max-md:hidden) in the header AND in every row; the first two never are", async () => {
    const { container } = await show("a,b,c,d"); const heads = [...container.querySelectorAll("thead th")]; expect(heads.map((h) => h.className.includes("max-md:hidden"))).toEqual([false, false, true, true]);
    for (const tr of container.querySelectorAll("tbody tr")) expect([...tr.querySelectorAll("td")].map((d) => d.className.includes("max-md:hidden")), tr.textContent).toEqual([false, false, true, true]);
  });
  it("with 2 parts nothing is hidden and there is no note; with 3 or 4 a note says 2 of N are shown (phone only)", async () => {
    let v = await show("a,b"); expect(v.container.querySelector('[data-testid="compare-phone-note"]')).toBeNull(); expect(v.container.querySelectorAll(".max-md\\:hidden")).toHaveLength(0); v.unmount();
    v = await show("a,b,c"); const note = v.container.querySelector('[data-testid="compare-phone-note"]')!; expect(note.textContent).toBe("Showing 2 of 3 parts. Open this page on a tablet or a computer to compare them all."); expect(note.className).toContain("md:hidden"); v.unmount();
    v = await show("a,b,c,d,e"); expect(v.container.querySelector('[data-testid="compare-phone-note"]')!.textContent).toContain("2 of 4"); v.unmount();
    v = await show("a,b,c", "ar"); expect(v.container.querySelector('[data-testid="compare-phone-note"]')!.textContent).toContain("3");
  });
  it("the table scrolls only if it must, and the whole thing is still inside its rounded frame", async () => { const { container } = await show("a,b,c,d"); expect(container.querySelector("div.overflow-x-auto")!.contains(container.querySelector("table"))).toBe(true); });
});
