import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import type { ProductSummary } from "@/lib/api";

// A real product card is connected to the photo slideshow: it hands it ALL the photos of the part (made into full addresses), and the hover on the card (the li) moves through them.
const m = vi.hoisted(() => ({ cart: { current: null as unknown } }));
vi.mock("@/components/CartProvider", () => ({ useOptionalCart: () => m.cart.current }));
vi.mock("@/components/Price", () => ({ Price: ({ usd }: { usd: number }) => <span>${usd}</span> }));
vi.mock("./Price", () => ({ Price: ({ usd }: { usd: number }) => <span>${usd}</span> }));
vi.mock("@/lib/api", () => ({ resolveImageUrl: (u: string) => `https://api.example.com${u}` }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("next/image", () => ({ default: (p: { src: string; alt: string; className?: string }) => <img src={p.src} alt={p.alt} className={p.className} /> }));
import ProductCard from "./ProductCard";
import { LangProvider } from "./LangProvider";
import { HOVER_DELAY_MS, HOVER_STEP_MS } from "./CardPhotos";

const product = (over: Partial<ProductSummary> = {}): ProductSummary => ({ id: "p1", name: "Brake disc", images: ["/uploads/1.jpg", "/uploads/2.jpg", "/uploads/3.jpg"], price: 35, stockQuantity: 5, oemNumber: "6161", estimatedDeliveryDays: 7, ...over } as ProductSummary);
const show = (over: Partial<ProductSummary> = {}) => { const v = render(<LangProvider lang="en"><ul><ProductCard product={product(over)} lang="en" /></ul></LangProvider>); const li = v.container.querySelector("li")!; const photo = () => li.querySelector(".aspect-square img.opacity-100")!.getAttribute("src"); return { ...v, li, photo }; };
beforeEach(() => { vi.useFakeTimers(); m.cart.current = { addItem: vi.fn(async () => {}) }; window.matchMedia = vi.fn().mockImplementation((q: string) => ({ matches: q.includes("hover: hover"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as never; });
afterEach(() => { vi.useRealTimers(); });

describe("the card and its photos", () => {
  it("shows the first photo at rest, as a full address", () => { expect(show().photo()).toBe("https://api.example.com/uploads/1.jpg"); });
  it("while the pointer is on the CARD the other photos of the part show in turn, then round to the first; leaving returns to the first", () => {
    const v = show(); act(() => { v.li.dispatchEvent(new MouseEvent("mouseenter")); }); act(() => { vi.advanceTimersByTime(HOVER_DELAY_MS); }); expect(v.photo()).toBe("https://api.example.com/uploads/2.jpg");
    act(() => { vi.advanceTimersByTime(HOVER_STEP_MS); }); expect(v.photo()).toBe("https://api.example.com/uploads/3.jpg"); act(() => { vi.advanceTimersByTime(HOVER_STEP_MS); }); expect(v.photo()).toBe("https://api.example.com/uploads/1.jpg");
    act(() => { vi.advanceTimersByTime(HOVER_STEP_MS); }); act(() => { v.li.dispatchEvent(new MouseEvent("mouseleave")); }); expect(v.photo()).toBe("https://api.example.com/uploads/1.jpg");
  });
  it("a card with one photo does not move; a card with no photo still shows the icon (no slideshow)", () => {
    const one = show({ images: ["/uploads/1.jpg"] }); act(() => { one.li.dispatchEvent(new MouseEvent("mouseenter")); vi.advanceTimersByTime(5000); }); expect(one.photo()).toBe("https://api.example.com/uploads/1.jpg"); one.unmount();
    const none = show({ images: [] }); expect(none.container.querySelector(".aspect-square img")).toBeNull(); expect(none.container.querySelector(".aspect-square svg")).not.toBeNull();
  });
  it("the brand logo and the discount tag stay where they were while the photos change", () => {
    const v = show({ brandLogoUrl: "/uploads/b.png", brand: "BYD", price: 7, originalPrice: 10 } as never); act(() => { v.li.dispatchEvent(new MouseEvent("mouseenter")); vi.advanceTimersByTime(HOVER_DELAY_MS); }); expect(v.container.querySelector('[data-testid="brand-badge"]')).not.toBeNull(); expect(v.container.querySelector('[data-testid="discount-tag"]')).not.toBeNull();
  });
});
